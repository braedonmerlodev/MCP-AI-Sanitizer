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
const AuditLoggerAccess = require('../components/AuditLoggerAccess');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Initialize TrustTokenGenerator
const trustTokenGenerator = new TrustTokenGenerator();

// Initialize Audit Logger for Access Events
const auditLoggerAccess = new AuditLoggerAccess({
  secret: process.env.AUDIT_SECRET || 'default-audit-secret-change-in-production',
});

/**
 * Middleware function to validate trust tokens for AI agent access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function accessValidationMiddleware(req, res, next) {
  try {
    // Allow token generation and data export endpoints without trust token
    if (
      (req.path === '/sanitize/json' && req.method === 'POST') ||
      (req.path === '/export/training-data' && req.method === 'POST') ||
      (req.path === '/documents/upload' && req.method === 'POST')
    ) {
      return next();
    }

    // Extract trust token from request headers
    const trustTokenHeader = req.headers['x-trust-token'];

    if (!trustTokenHeader) {
      logger.warn('Missing trust token header', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      // Allow admin override to bypass trust token requirement when active
      try {
        if (
          globalThis.adminOverrideController &&
          globalThis.adminOverrideController.isOverrideActive()
        ) {
          const activeOverride = globalThis.adminOverrideController.getActiveOverride();
          logger.info('Bypassing trust token requirement via admin override', {
            overrideId: activeOverride.id,
            adminId: activeOverride.adminId,
          });
          // Attach a synthetic validation object indicating override bypass
          req.trustTokenValidation = { isValid: true, bypass: 'admin_override' };
          req.trustToken = { override: activeOverride };
          return next();
        }
      } catch (e) {
        logger.warn('Error checking admin override in middleware', { error: e.message });
      }

      // Log missing token attempt (guard logging errors so validation still returns)
      try {
        auditLoggerAccess.logValidationAttempt(
          {},
          { isValid: false, error: 'Trust token required' },
          {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        );
      } catch (logErr) {
        logger.warn('Audit logger failed during missing token log', { error: logErr.message });
      }

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

      // Log invalid format attempt (guard logging errors so validation returns)
      try {
        auditLoggerAccess.logValidationAttempt(
          {},
          { isValid: false, error: 'Invalid trust token format' },
          {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        );
      } catch (logErr) {
        logger.warn('Audit logger failed during invalid format log', { error: logErr.message });
      }

      return res.status(403).json({
        error: 'Invalid trust token format',
        message: 'Trust token must be valid JSON',
      });
    }

    // If parsed token is not an object (null, string, number, array), treat as malformed
    if (typeof trustToken !== 'object' || trustToken === null || Array.isArray(trustToken)) {
      logger.warn('Invalid trust token format (parsed non-object)', {
        method: req.method,
        path: req.path,
      });

      try {
        auditLoggerAccess.logValidationAttempt(
          {},
          { isValid: false, error: 'Invalid trust token format' },
          {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        );
      } catch (logErr) {
        logger.warn('Audit logger failed during invalid format (non-object) log', {
          error: logErr.message,
        });
      }

      return res.status(403).json({
        error: 'Invalid trust token format',
        message: 'Trust token must be a JSON object',
      });
    }

    // Validate token with timing
    const validationStart = process.hrtime.bigint();
    const validation = trustTokenGenerator.validateToken(trustToken);
    const validationEnd = process.hrtime.bigint();
    const validationTime = Number(validationEnd - validationStart) / 1e6; // Convert to milliseconds

    // Add timing to validation result
    validation.validationTime = validationTime;

    if (!validation.isValid) {
      logger.warn('Invalid trust token', {
        method: req.method,
        path: req.path,
        error: validation.error,
      });

      // Log failed validation attempt (guard against audit logger failures)
      try {
        auditLoggerAccess.logValidationAttempt(trustToken, validation, {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      } catch (logErr) {
        logger.warn('Audit logger failed during failed validation log', { error: logErr.message });
      }

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

    // Log successful validation attempt (guard audit logger failures)
    try {
      auditLoggerAccess.logValidationAttempt(trustToken, validation, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (logErr) {
      logger.warn('Audit logger failed during success validation log', { error: logErr.message });
    }

    next();
  } catch (error) {
    logger.error('Trust token validation error', {
      error: error.message,
      method: req.method,
      path: req.path,
    });

    // Log validation error (guard against audit logger throwing)
    try {
      auditLoggerAccess.logValidationError(error, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (logErr) {
      logger.warn('Audit logger failed during validation error log', { error: logErr.message });
    }

    return res.status(500).json({
      error: 'Validation service error',
      message: 'An error occurred during trust token validation',
    });
  }
}

module.exports = accessValidationMiddleware;
