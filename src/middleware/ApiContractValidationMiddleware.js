/**
 * API Contract Validation Middleware
 *
 * Validates incoming requests and outgoing responses against Joi schemas.
 * Performs non-blocking validation: logs errors but does not block processing.
 *
 * @param {Object} requestSchema - Joi schema for request validation
 * @param {Object} responseSchema - Joi schema for response validation
 * @returns {Function} Express middleware function
 */

const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Creates API contract validation middleware
 * @param {Object} requestSchema - Joi schema for validating request body
 * @param {Object} responseSchema - Joi schema for validating response data
 */
function apiContractValidationMiddleware(requestSchema, responseSchema) {
  return (req, res, next) => {
    // Validate request body if schema provided
    if (requestSchema) {
      const requestValidation = requestSchema.validate(req.body, { abortEarly: false });

      if (requestValidation.error) {
        logger.warn('Request validation failed', {
          endpoint: req.originalUrl,
          method: req.method,
          errors: requestValidation.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          })),
          requestBody: req.body,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        });

        // Reject invalid requests with 400 Bad Request
        return res.status(400).json({
          error: 'Request validation failed',
          details: requestValidation.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
      } else {
        logger.info('Request validation passed', {
          endpoint: req.originalUrl,
          method: req.method,
        });
      }
    }

    // Store original res.json method
    const originalJson = res.json;

    // Override res.json to validate response
    res.json = function (data) {
      // Validate response data if schema provided
      if (responseSchema) {
        const responseValidation = responseSchema.validate(data, { abortEarly: false });

        if (responseValidation.error) {
          logger.warn('Response validation failed', {
            endpoint: req.originalUrl,
            method: req.method,
            errors: responseValidation.error.details.map((detail) => ({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value,
            })),
            responseData: data,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
          });
        } else {
          logger.info('Response validation passed', {
            endpoint: req.originalUrl,
            method: req.method,
          });
        }
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = apiContractValidationMiddleware;
