/**
 * Response Validation Middleware
 * Validates API responses against defined schemas using Joi.
 * Logs validation errors but does not block responses (non-blocking validation).
 */

const Joi = require('joi');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Response schemas based on REST API spec
const responseSchemas = {
  '/health': Joi.object({
    status: Joi.string().valid('healthy').required(),
    timestamp: Joi.string().isoDate().required(),
  }),

  '/api/documents/upload': Joi.object({
    message: Joi.string().required(),
    fileName: Joi.string().required(),
    size: Joi.number().integer().min(0).required(),
    status: Joi.string().required(),
    trustToken: Joi.object().required(),
    metadata: Joi.object().optional(),
    sanitizedContent: Joi.string().optional(),
  }),

  '/api/trust-tokens/validate': Joi.alternatives().try(
    Joi.object({
      valid: Joi.boolean().valid(true).required(),
      message: Joi.string().required(),
    }),
    Joi.object({
      valid: Joi.boolean().valid(false).required(),
      error: Joi.string().required(),
    }),
  ),

  '/api/webhook/n8n': Joi.object({
    result: Joi.string().required(),
  }),
};

/**
 * Response validation middleware
 * Intercepts res.json() calls to validate response data against schemas
 */
const responseValidationMiddleware = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;

  // Override res.json to validate response
  res.json = function (data) {
    // Get the endpoint path
    const endpoint = req.originalUrl.split('?')[0]; // Remove query params

    // Find matching schema
    const schemaKey = Object.keys(responseSchemas).find((key) => {
      if (key === '/health' && endpoint === '/health') return true;
      if (endpoint.startsWith(key)) return true;
      return false;
    });

    if (schemaKey && responseSchemas[schemaKey]) {
      const schema = responseSchemas[schemaKey];
      const validation = schema.validate(data, { abortEarly: false });

      if (validation.error) {
        // Log validation errors but don't block response
        logger.warn('Response validation failed', {
          endpoint,
          schema: schemaKey,
          errors: validation.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          })),
          responseData: data,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Log successful validation (optional, can be removed for performance)
        logger.debug('Response validation passed', {
          endpoint,
          schema: schemaKey,
        });
      }
    }

    // Call original json method
    return originalJson.call(this, data);
  };

  next();
};

module.exports = responseValidationMiddleware;
