/**
 * Access Validation Middleware
 *
 * Validates trust tokens for AI agent document access.
 * Intercepts requests to ensure only documents with valid trust tokens can be accessed by AI agents.
 *
 * Validation Process:
 * - Extract trust token from 'x-trust-token' header
 * - Parse JSON token
 * - Validate using TrustTokenGenerator
 * - Return 403 for invalid/missing tokens
 * - Attach validation result to request for downstream use
 */

const winston = require('winston');
const TrustTokenGenerator = require('../components/TrustTokenGenerator');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Initialize TrustTokenGenerator
const trustTokenGenerator = new TrustTokenGenerator();

/**
 * Middleware function to validate trust tokens for AI agent access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function accessValidationMiddleware(req, res, next) {
  try {
    // Extract trust token from request headers
    const trustTokenHeader = req.headers['x-trust-token'];

    if (!trustTokenHeader) {
      logger.warn('Missing trust token header', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Trust token required',
        message: 'Access denied: Trust token is required for AI agent document access',
      });
    }

    // Parse trust token JSON
    let trustToken;
    try {
      trustToken = JSON.parse(trustTokenHeader);
    } catch (parseError) {
      logger.warn('Invalid trust token format', {
        method: req.method,
        path: req.path,
        error: parseError.message,
      });
      return res.status(403).json({
        error: 'Invalid trust token format',
        message: 'Trust token must be valid JSON',
      });
    }

    // Validate token
    const validation = trustTokenGenerator.validateToken(trustToken);

    if (!validation.isValid) {
      logger.warn('Invalid trust token', {
        method: req.method,
        path: req.path,
        error: validation.error,
      });
      return res.status(403).json({
        error: 'Invalid trust token',
        message: validation.error,
      });
    }

    // Attach validation result to request
    req.trustTokenValidation = validation;
    req.trustToken = trustToken;

    logger.info('Trust token validated successfully', {
      method: req.method,
      path: req.path,
      contentHash: trustToken.contentHash,
    });

    next();
  } catch (error) {
    logger.error('Trust token validation error', {
      error: error.message,
      method: req.method,
      path: req.path,
    });
    return res.status(500).json({
      error: 'Validation service error',
      message: 'An error occurred during trust token validation',
    });
  }
}

module.exports = accessValidationMiddleware;
