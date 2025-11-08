/**
 * API Contract Validation Schemas
 *
 * Defines Joi validation schemas for request and response formats
 * for API contract validation middleware.
 */

const Joi = require('joi');

// Request schemas for API endpoints
const requestSchemas = {
  '/health': Joi.object({}), // GET request, no body

  '/api/webhook/n8n': Joi.object({
    data: Joi.string().required(),
  }),

  '/api/documents/upload': Joi.object({}), // Multipart form-data, validation handled by multer

  '/api/trust-tokens/validate': Joi.object({
    contentHash: Joi.string().required(),
    originalHash: Joi.string().required(),
    sanitizationVersion: Joi.string().required(),
    rulesApplied: Joi.array().items(Joi.string()).required(),
    timestamp: Joi.string().required(),
    expiresAt: Joi.string().required(),
    signature: Joi.string().required(),
  }),
};

// Response schemas for API endpoints
const responseSchemas = {
  '/health': Joi.object({
    status: Joi.string().valid('healthy').required(),
    timestamp: Joi.string().isoDate().required(),
  }),

  '/api/webhook/n8n': Joi.object({
    result: Joi.object({
      sanitizedData: Joi.string().required(),
      trustToken: Joi.object().optional(),
    }).required(),
  }),

  '/api/documents/upload': Joi.object({
    message: Joi.string().required(),
    fileName: Joi.string().required(),
    size: Joi.number().integer().min(0).required(),
    metadata: Joi.object().required(),
    status: Joi.string().valid('processed').required(),
    sanitizedContent: Joi.string().required(),
    trustToken: Joi.object().required(),
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
};

module.exports = {
  requestSchemas,
  responseSchemas,
};
