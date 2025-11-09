const Joi = require('joi');

/**
 * Schema for high-fidelity training data collection optimized for AI model consumption.
 * Captures complete risk assessment context including input data, processing steps, and decision outcomes.
 */
const trainingDataSchema = Joi.object({
  // Metadata
  id: Joi.string().required().description('Unique training data identifier'),
  timestamp: Joi.date().iso().required().description('When the data was collected'),
  sessionId: Joi.string().required().description('Session correlation ID'),

  // Input Data Features
  inputFeatures: Joi.object({
    length: Joi.number().integer().min(0).required().description('Input data length in characters'),
    type: Joi.string()
      .valid('text', 'json', 'binary', 'unknown')
      .required()
      .description('Input data type'),
    encoding: Joi.string().optional().description('Character encoding if applicable'),
    hasSpecialChars: Joi.boolean().required().description('Presence of special characters'),
    hasUnicode: Joi.boolean().required().description('Presence of Unicode characters'),
    languageDetected: Joi.string().optional().description('Detected language if applicable'),
  })
    .required()
    .description('Structured features extracted from input data'),

  // Processing Steps Features
  processingFeatures: Joi.object({
    steps: Joi.array()
      .items(Joi.string())
      .required()
      .description('Sequence of processing steps applied'),
    sanitizationApplied: Joi.boolean().required().description('Whether sanitization was applied'),
    sanitizationLevel: Joi.string()
      .valid('none', 'basic', 'advanced', 'full')
      .required()
      .description('Level of sanitization applied'),
    validationPassed: Joi.boolean().required().description('Whether input validation passed'),
    provenanceValidated: Joi.boolean().required().description('Whether provenance check passed'),
    processingTimeMs: Joi.number()
      .integer()
      .min(0)
      .required()
      .description('Total processing time in milliseconds'),
  })
    .required()
    .description('Features from processing pipeline'),

  // Risk Assessment Features
  riskFeatures: Joi.object({
    riskScore: Joi.number().min(0).max(1).required().description('Calculated risk score (0-1)'),
    confidenceScore: Joi.number()
      .min(0)
      .max(1)
      .required()
      .description('Model confidence in risk assessment'),
    anomalyScore: Joi.number().min(0).max(1).required().description('Anomaly detection score'),
    threatPatternId: Joi.string().optional().description('Identified threat pattern ID'),
    riskCategory: Joi.string()
      .valid('Low', 'Unknown', 'High')
      .required()
      .description('Categorized risk level'),
    featureVector: Joi.object().optional().description('ML feature vector for model input'),
  })
    .required()
    .description('Risk assessment specific features'),

  // Decision Outcome Labels
  labels: Joi.object({
    finalDecision: Joi.string()
      .valid('allow', 'block', 'sanitize', 'escalate')
      .required()
      .description('Final system decision'),
    riskLevel: Joi.string()
      .valid('Low', 'Unknown', 'High')
      .required()
      .description('Risk level label'),
    actionTaken: Joi.string().required().description('Specific action taken'),
    effectivenessScore: Joi.number()
      .min(0)
      .max(1)
      .optional()
      .description('Effectiveness of the decision'),
    trainingLabels: Joi.object().optional().description('Additional training labels'),
  })
    .required()
    .description('Structured labels for supervised learning'),

  // Context and Metadata
  context: Joi.object({
    userId: Joi.string().optional().description('Anonymized user identifier'),
    destination: Joi.string().optional().description('Intended destination system'),
    source: Joi.string().required().description('Source of the request (e.g., n8n)'),
    ipAddress: Joi.string().optional().description('Anonymized IP address'),
    userAgent: Joi.string().optional().description('User agent string'),
  })
    .required()
    .description('Additional context for training'),

  // Quality Assurance
  quality: Joi.object({
    dataCompleteness: Joi.number()
      .min(0)
      .max(1)
      .required()
      .description('Completeness score of collected data'),
    validationErrors: Joi.array()
      .items(Joi.string())
      .optional()
      .description('Any validation errors encountered'),
    isValidForTraining: Joi.boolean()
      .required()
      .description('Whether this data is valid for model training'),
  })
    .required()
    .description('Data quality metrics'),
})
  .required()
  .description('High-fidelity training data schema for AI model consumption');

module.exports = trainingDataSchema;
