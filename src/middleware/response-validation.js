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
    // Allow unknown fields for flexibility in processing metadata
    message: Joi.string().required(),
    fileName: Joi.string().required(),
    size: Joi.number().integer().min(0).required(),
    metadata: Joi.object().required(),
    // processingMetadata may be attached when AI transformation runs or falls back
    processingMetadata: Joi.object({
      aiError: Joi.string().optional(),
      aiProcessed: Joi.boolean().optional(),
      transformationType: Joi.string().optional(),
      // AI-specific metadata fields
      processingTime: Joi.number().optional(),
      tokens: Joi.object({
        prompt: Joi.number().optional(),
        completion: Joi.number().optional(),
        total: Joi.number().optional(),
      }).optional(),
      model: Joi.string().optional(),
      finish_reason: Joi.string().optional(),
      provider: Joi.string().optional(),
    }).optional(),
    status: Joi.string().valid('processed').required(),
    sanitizedContent: Joi.alternatives()
      .try(
        Joi.string(), // For non-AI processing
        Joi.object(), // For AI structured output
      )
      .required(),
    trustToken: Joi.object().required(),
  }).unknown(true),

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
    result: Joi.object({
      sanitizedData: Joi.string().required(),
      trustToken: Joi.object().optional(),
    }).required(),
  }),
};

/**
 * Response validation middleware
 * Intercepts res.json() calls to validate response data against schemas
 */
const responseValidationMiddleware = (req, res, next) => {
  // Store original methods
  const originalJson = res.json;
  const originalStatus = res.status;

  // Override res.json to validate response
  res.json = function (data) {
    try {
      // Skip validation for error responses or if headers already sent
      if (res.headersSent || (res.statusCode && res.statusCode >= 400)) {
        return originalJson.call(res, data);
      }

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

      // Call original json method with proper context
      return originalJson.call(res, data);
    } catch (error) {
      logger.error('Error in response validation middleware', {
        error: error.message,
        stack: error.stack,
        endpoint: req.originalUrl,
      });
      // Fallback to original method if something goes wrong
      return originalJson.call(res, data);
    }
  };

  // Ensure status method is preserved
  res.status = originalStatus;

  next();
};

module.exports = responseValidationMiddleware;
