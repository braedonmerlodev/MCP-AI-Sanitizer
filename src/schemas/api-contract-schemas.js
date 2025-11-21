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
      provider: Joi.string().optional(),
      // AI-specific metadata fields
      processingTime: Joi.number().optional(),
      tokens: Joi.object({
        prompt: Joi.number().optional(),
        completion: Joi.number().optional(),
        total: Joi.number().optional(),
      }).optional(),
      model: Joi.string().optional(),
      finish_reason: Joi.string().optional(),
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
};

module.exports = {
  requestSchemas,
  responseSchemas,
};
