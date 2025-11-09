/**
 * TrainingDataValidator handles validation of training data for AI model consumption.
 * Ensures completeness, accuracy, and quality of training data against defined schema.
 * Integrates with audit logging for compliance and traceability.
 */

const Joi = require('joi');
const SchemaValidator = require('./SchemaValidator');
const AuditLogger = require('./AuditLogger');

class TrainingDataValidator {
  constructor(options = {}) {
    this.schemaValidator = new SchemaValidator();
    this.auditLogger = options.auditLogger || new AuditLogger();

    // Define training data schema
    this.trainingDataSchema = Joi.object({
      inputData: Joi.object({
        content: Joi.string().required(),
        contentType: Joi.string().valid('text', 'html', 'json', 'pdf').required(),
        size: Joi.number().integer().min(0).required(),
        hash: Joi.string().required(),
      }).required(),

      processingSteps: Joi.array()
        .items(
          Joi.object({
            step: Joi.string().required(),
            action: Joi.string().required(),
            timestamp: Joi.string().isoDate().required(),
            parameters: Joi.object().optional(),
            result: Joi.object().optional(),
          }),
        )
        .min(1)
        .required(),

      decisionOutcome: Joi.object({
        riskLevel: Joi.string().valid('High', 'Unknown', 'Low', 'Safe').required(),
        actionsTaken: Joi.array().items(Joi.string()).required(),
        confidenceScore: Joi.number().min(0).max(1).optional(),
        riskScore: Joi.number().min(0).max(100).optional(),
      }).required(),

      featureVector: Joi.object({
        contentLength: Joi.number().integer().min(0).required(),
        specialCharsCount: Joi.number().integer().min(0).required(),
        scriptTagsCount: Joi.number().integer().min(0).required(),
        suspiciousPatternsCount: Joi.number().integer().min(0).required(),
        entropyScore: Joi.number().min(0).max(1).required(),
        languageFeatures: Joi.object().optional(),
        structuralFeatures: Joi.object().optional(),
      }).required(),

      trainingLabels: Joi.object({
        riskCategory: Joi.string().valid('malicious', 'suspicious', 'safe', 'unknown').required(),
        threatTypes: Joi.array().items(Joi.string()).optional(),
        confidence: Joi.number().min(0).max(1).required(),
        humanVerified: Joi.boolean().optional(),
        verificationTimestamp: Joi.string().isoDate().optional(),
      }).required(),

      metadata: Joi.object({
        collectionTimestamp: Joi.string().isoDate().required(),
        provenance: Joi.string().required(),
        source: Joi.string().required(),
        version: Joi.string().required(),
        processingDuration: Joi.number().min(0).optional(),
        environment: Joi.string().optional(),
      }).required(),
    });

    // Quality metrics thresholds
    this.qualityThresholds = {
      minContentLength: 10,
      maxContentLength: 1000000, // 1MB
      minProcessingSteps: 1,
      maxProcessingSteps: 100,
      minConfidenceScore: 0.1,
      requiredFeatureFields: ['contentLength', 'specialCharsCount', 'entropyScore'],
      requiredMetadataFields: ['collectionTimestamp', 'provenance', 'source', 'version'],
    };
  }

  /**
   * Validates training data against schema and quality metrics
   * @param {Object} trainingData - Training data object to validate
   * @param {Object} context - Validation context (userId, sessionId, etc.)
   * @returns {Promise<Object>} - Validation result with detailed feedback
   */
  async validateTrainingData(trainingData, context = {}) {
    const validationStart = Date.now();
    const validationId = this.generateValidationId();

    try {
      // Schema validation
      const schemaResult = this.schemaValidator.validate(trainingData, this.trainingDataSchema);

      // Quality validation
      const qualityResult = this.validateQualityMetrics(trainingData);

      // Combine results
      const isValid = schemaResult.isValid && qualityResult.isValid;
      const allErrors = [...(schemaResult.errors || []), ...(qualityResult.errors || [])];
      const allWarnings = [...(qualityResult.warnings || [])];

      const validationResult = {
        validationId,
        isValid,
        schemaValid: schemaResult.isValid,
        qualityValid: qualityResult.isValid,
        errors: allErrors,
        warnings: allWarnings,
        details: {
          schemaValidation: schemaResult.details,
          qualityValidation: qualityResult.details,
          processingTime: Date.now() - validationStart,
        },
        timestamp: new Date().toISOString(),
      };

      // Log validation result to audit trail
      await this.auditLogger.logValidation(validationResult, {
        ...context,
        validationType: 'training_data_quality',
        dataId: trainingData.id || validationId,
      });

      return validationResult;
    } catch (error) {
      // Log validation error
      await this.auditLogger.logValidation(
        {
          validationId,
          isValid: false,
          errors: [`Validation system error: ${error.message}`],
          details: { error: error.message, stack: error.stack },
        },
        {
          ...context,
          validationType: 'training_data_quality',
          severity: 'error',
        },
      );

      return {
        validationId,
        isValid: false,
        errors: [`Validation system error: ${error.message}`],
        details: { error: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validates quality metrics for training data
   * @param {Object} trainingData - Training data to check
   * @returns {Object} - Quality validation result
   */
  validateQualityMetrics(trainingData) {
    const errors = [];
    const warnings = [];
    const details = {};

    try {
      // Check content length
      const contentLength = trainingData.inputData?.size || 0;
      if (contentLength < this.qualityThresholds.minContentLength) {
        errors.push(
          `Content length ${contentLength} is below minimum threshold ${this.qualityThresholds.minContentLength}`,
        );
      } else if (contentLength > this.qualityThresholds.maxContentLength) {
        warnings.push(
          `Content length ${contentLength} exceeds recommended maximum ${this.qualityThresholds.maxContentLength}`,
        );
      }

      // Check processing steps count
      const processingStepsCount = trainingData.processingSteps?.length || 0;
      if (processingStepsCount < this.qualityThresholds.minProcessingSteps) {
        errors.push(
          `Processing steps count ${processingStepsCount} is below minimum ${this.qualityThresholds.minProcessingSteps}`,
        );
      } else if (processingStepsCount > this.qualityThresholds.maxProcessingSteps) {
        warnings.push(
          `Processing steps count ${processingStepsCount} exceeds recommended maximum ${this.qualityThresholds.maxProcessingSteps}`,
        );
      }

      // Check confidence scores
      const decisionConfidence = trainingData.decisionOutcome?.confidenceScore;
      if (
        decisionConfidence !== undefined &&
        decisionConfidence < this.qualityThresholds.minConfidenceScore
      ) {
        warnings.push(
          `Decision confidence score ${decisionConfidence} is below recommended minimum ${this.qualityThresholds.minConfidenceScore}`,
        );
      }

      const labelConfidence = trainingData.trainingLabels?.confidence;
      if (
        labelConfidence !== undefined &&
        labelConfidence < this.qualityThresholds.minConfidenceScore
      ) {
        warnings.push(
          `Label confidence score ${labelConfidence} is below recommended minimum ${this.qualityThresholds.minConfidenceScore}`,
        );
      }

      // Check required feature fields
      const featureVector = trainingData.featureVector || {};
      const missingFeatures = this.qualityThresholds.requiredFeatureFields.filter(
        (field) => featureVector[field] === undefined || featureVector[field] === null,
      );
      if (missingFeatures.length > 0) {
        errors.push(`Missing required feature fields: ${missingFeatures.join(', ')}`);
      }

      // Check feature value ranges
      if (featureVector.contentLength !== undefined && featureVector.contentLength < 0) {
        errors.push('Feature contentLength cannot be negative');
      }
      if (
        featureVector.entropyScore !== undefined &&
        (featureVector.entropyScore < 0 || featureVector.entropyScore > 1)
      ) {
        errors.push('Feature entropyScore must be between 0 and 1');
      }

      // Check metadata completeness
      const metadata = trainingData.metadata || {};
      const missingMetadata = this.qualityThresholds.requiredMetadataFields.filter(
        (field) => !metadata[field],
      );
      if (missingMetadata.length > 0) {
        errors.push(`Missing required metadata fields: ${missingMetadata.join(', ')}`);
      }

      // Check timestamp validity
      if (metadata.collectionTimestamp) {
        const collectionTime = new Date(metadata.collectionTimestamp);
        const now = new Date();
        if (collectionTime > now) {
          errors.push('Collection timestamp cannot be in the future');
        }
        if (collectionTime < new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)) {
          // 1 year ago
          warnings.push('Collection timestamp is more than 1 year old');
        }
      }

      // Check data consistency
      if (trainingData.inputData?.size !== featureVector.contentLength) {
        warnings.push('Input data size does not match feature vector contentLength');
      }

      details.contentLength = contentLength;
      details.processingStepsCount = processingStepsCount;
      details.decisionConfidence = decisionConfidence;
      details.labelConfidence = labelConfidence;
      details.missingFeatures = missingFeatures;
      details.missingMetadata = missingMetadata;
    } catch (error) {
      errors.push(`Quality validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details,
    };
  }

  /**
   * Validates a batch of training data records
   * @param {Array} trainingDataBatch - Array of training data objects
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} - Batch validation results
   */
  async validateTrainingDataBatch(trainingDataBatch, context = {}) {
    const batchId = this.generateValidationId();
    const results = [];
    let totalValid = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const [index, trainingData] of trainingDataBatch.entries()) {
      const result = await this.validateTrainingData(trainingData, {
        ...context,
        batchId,
        recordIndex: index,
        totalRecords: trainingDataBatch.length,
      });

      results.push(result);

      if (result.isValid) totalValid++;
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    }

    const batchResult = {
      batchId,
      totalRecords: trainingDataBatch.length,
      validRecords: totalValid,
      invalidRecords: trainingDataBatch.length - totalValid,
      totalErrors,
      totalWarnings,
      successRate: (totalValid / trainingDataBatch.length) * 100,
      results,
      timestamp: new Date().toISOString(),
    };

    // Log batch validation summary
    await this.auditLogger.logValidation(
      {
        validationId: batchId,
        isValid: totalValid === trainingDataBatch.length,
        validationType: 'training_data_batch',
        errors: totalErrors > 0 ? [`${totalErrors} validation errors across batch`] : [],
        warnings: totalWarnings > 0 ? [`${totalWarnings} validation warnings across batch`] : [],
        details: {
          batchSummary: batchResult,
        },
      },
      {
        ...context,
        batchSize: trainingDataBatch.length,
      },
    );

    return batchResult;
  }

  /**
   * Gets validation statistics from audit logs
   * @param {Object} filters - Optional filters for statistics
   * @returns {Object} - Validation statistics
   */
  getValidationStatistics(filters = {}) {
    const auditEntries = this.auditLogger.getAuditEntries({
      operation: 'validation',
      ...filters,
    });

    const stats = {
      totalValidations: auditEntries.length,
      validCount: 0,
      invalidCount: 0,
      errorCount: 0,
      warningCount: 0,
      averageProcessingTime: 0,
      timeRange: {},
    };

    let totalProcessingTime = 0;

    for (const entry of auditEntries) {
      if (entry.details.isValid) stats.validCount++;
      else stats.invalidCount++;

      stats.errorCount += entry.details.errors?.length || 0;
      stats.warningCount += entry.details.warnings?.length || 0;
      totalProcessingTime += entry.details.processingTime || 0;
    }

    if (auditEntries.length > 0) {
      stats.averageProcessingTime = totalProcessingTime / auditEntries.length;
      stats.timeRange.start = auditEntries[0]?.timestamp;
      stats.timeRange.end = auditEntries[auditEntries.length - 1]?.timestamp;
    }

    return stats;
  }

  /**
   * Generates a unique validation ID
   * @returns {string} - Unique validation ID
   */
  generateValidationId() {
    return `tdv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Updates quality thresholds (admin function)
   * @param {Object} newThresholds - New threshold values
   */
  updateQualityThresholds(newThresholds) {
    this.qualityThresholds = { ...this.qualityThresholds, ...newThresholds };
  }
}

module.exports = TrainingDataValidator;
