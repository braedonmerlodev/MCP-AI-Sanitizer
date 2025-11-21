const TrainingDataValidator = require('./TrainingDataValidator');
const AuditLogger = require('./AuditLogger');

/**
 * TrainingDataCollector captures comprehensive context during risk assessments
 * for AI training data collection. Collects input data, processing steps, and decision outcomes
 * in a structured format optimized for machine learning consumption.
 */
class TrainingDataCollector {
  constructor(options = {}) {
    this.validator = new TrainingDataValidator(options);
    this.auditLogger = options.auditLogger || new AuditLogger();
    this.enableCollection = options.enableCollection !== false;
    this.collectionThresholds = {
      minRiskScore: options.minRiskScore || 0.1, // Only collect for assessments above this threshold
      maxCollectionRate: options.maxCollectionRate || 1.0, // Sample rate (1.0 = 100%)
    };
  }

  /**
   * Collects comprehensive training data from a risk assessment
   * @param {Object} assessmentData - Risk assessment data
   * @param {Object} context - Collection context
   * @returns {Promise<Object>} - Collected training data or null if not collected
   */
  async collectTrainingData(assessmentData, context = {}) {
    if (!this.enableCollection) {
      return null;
    }

    // Handle null or invalid assessment data
    if (!assessmentData || typeof assessmentData !== 'object') {
      return null;
    }

    // Check collection thresholds
    if (assessmentData.riskScore < this.collectionThresholds.minRiskScore) {
      return null; // Skip low-risk assessments
    }

    if (Math.random() > this.collectionThresholds.maxCollectionRate) {
      return null; // Skip based on sampling rate
    }

    try {
      const collectionStart = Date.now();
      const trainingData = this.buildTrainingDataObject(assessmentData, context);
      const collectionTime = Date.now() - collectionStart;

      // Validate the collected data
      const validationResult = await this.validator.validateTrainingData(trainingData, {
        ...context,
        collectionTime,
        collector: 'TrainingDataCollector',
      });

      if (!validationResult.isValid) {
        // Log validation failure and return null
        await this.auditLogger.logOperation(
          'training_data_collection_validation_failed',
          {
            trainingDataId: trainingData.id,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
          },
          {
            ...context,
            severity: 'warning',
          },
        );
        return null;
      }

      // Log successful collection
      await this.auditLogger.logOperation(
        'training_data_collected',
        {
          trainingDataId: trainingData.id,
          riskScore: assessmentData.riskScore,
          riskLevel: assessmentData.riskLevel,
          collectionTime,
          validationPassed: validationResult.isValid,
        },
        {
          ...context,
          severity: 'info',
        },
      );

      return {
        ...trainingData,
        metadata: {
          ...trainingData.metadata,
          collectionTime,
          validationResult: {
            isValid: validationResult.isValid,
            errorCount: validationResult.errors.length,
            warningCount: validationResult.warnings.length,
          },
        },
      };
    } catch (error) {
      // Log collection error
      await this.auditLogger.logOperation(
        'training_data_collection_error',
        {
          error: error.message,
          assessmentData: this.sanitizeAssessmentData(assessmentData),
        },
        {
          ...context,
          severity: 'error',
        },
      );

      return null;
    }
  }

  /**
   * Builds the training data object from assessment data
   * @param {Object} assessmentData - Raw assessment data
   * @param {Object} context - Collection context
   * @returns {Object} - Structured training data matching validator schema
   */
  buildTrainingDataObject(assessmentData, context) {
    const id = this.generateTrainingDataId();
    const timestamp = new Date().toISOString();

    // Build inputData for validator
    const inputData = this.buildInputData(assessmentData.inputData);

    // Build processingSteps for validator
    const processingSteps = this.buildProcessingSteps(assessmentData.processingContext);

    // Build decisionOutcome for validator
    const decisionOutcome = this.buildDecisionOutcome(assessmentData);

    // Build featureVector for validator
    const featureVector = this.buildFeatureVector(assessmentData);

    // Build trainingLabels for validator
    const trainingLabels = this.buildTrainingLabels(assessmentData);

    // Build metadata for validator
    const metadata = this.buildMetadata(assessmentData, context, timestamp);

    return {
      id,
      inputData,
      processingSteps,
      decisionOutcome,
      featureVector,
      trainingLabels,
      metadata,
    };
  }

  /**
   * Builds inputData for validator schema
   * @param {Object} inputData - Input data from assessment
   * @returns {Object} - Input data object
   */
  buildInputData(inputData) {
    if (!inputData) {
      return {
        content: '',
        contentType: 'unknown',
        size: 0,
        hash: this.generateHash(''),
      };
    }

    const content = inputData.content || '';
    return {
      content,
      contentType: inputData.contentType || 'text',
      size: content.length,
      hash: this.generateHash(content),
    };
  }

  /**
   * Builds processingSteps for validator schema
   * @param {Object} processingContext - Processing context
   * @returns {Array} - Processing steps array
   */
  buildProcessingSteps(processingContext) {
    const steps = processingContext?.steps || [];
    const timestamp = new Date().toISOString();

    return steps.map((step, index) => ({
      step: `step_${index + 1}`,
      action: step,
      timestamp,
      parameters: processingContext?.parameters || {},
      result: processingContext?.results?.[index] || {},
    }));
  }

  /**
   * Builds decisionOutcome for validator schema
   * @param {Object} assessmentData - Assessment data
   * @returns {Object} - Decision outcome object
   */
  buildDecisionOutcome(assessmentData) {
    const actionsTaken = assessmentData.actionsTaken || [];
    const riskLevel = assessmentData.riskLevel || 'Unknown';

    return {
      riskLevel,
      actionsTaken,
      confidenceScore: assessmentData.confidenceScore,
      riskScore: assessmentData.riskScore,
    };
  }

  /**
   * Builds featureVector for validator schema
   * @param {Object} assessmentData - Assessment data
   * @returns {Object} - Feature vector object
   */
  buildFeatureVector(assessmentData) {
    const inputData = assessmentData.inputData || {};
    const content = inputData.content || '';

    return {
      contentLength: content.length,
      specialCharsCount: (content.match(/[^a-zA-Z0-9\s]/g) || []).length,
      scriptTagsCount: (content.match(/<script[^>]*>.*?<\/script>/gi) || []).length,
      suspiciousPatternsCount: (content.match(/(alert|eval|javascript:|on\w+\s*=)/gi) || []).length,
      entropyScore: this.calculateEntropy(content),
      languageFeatures: assessmentData.languageFeatures || {},
      structuralFeatures: assessmentData.structuralFeatures || {},
    };
  }

  /**
   * Builds trainingLabels for validator schema
   * @param {Object} assessmentData - Assessment data
   * @returns {Object} - Training labels object
   */
  buildTrainingLabels(assessmentData) {
    const riskLevel = assessmentData.riskLevel || 'Unknown';
    const actionsTaken = assessmentData.actionsTaken || [];

    let riskCategory = 'unknown';
    if (riskLevel === 'High') riskCategory = 'malicious';
    else if (riskLevel === 'Low') riskCategory = 'safe';
    else if (actionsTaken.includes('sanitize')) riskCategory = 'suspicious';

    return {
      riskCategory,
      threatTypes: assessmentData.threatTypes || [],
      confidence: assessmentData.confidenceScore || 0,
      humanVerified: assessmentData.humanVerified || false,
      verificationTimestamp: assessmentData.verificationTimestamp,
    };
  }

  /**
   * Builds metadata for validator schema
   * @param {Object} assessmentData - Assessment data
   * @param {Object} context - Collection context
   * @param {string} timestamp - Collection timestamp
   * @returns {Object} - Metadata object
   */
  buildMetadata(assessmentData, context, timestamp) {
    return {
      collectionTimestamp: timestamp,
      provenance: context.source || 'risk_assessment',
      source: context.source || 'unknown',
      version: '1.0',
      processingDuration: assessmentData.processingTime || 0,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Calculates entropy score for content
   * @param {string} content - Content string
   * @returns {number} - Entropy score (0-1)
   */
  calculateEntropy(content) {
    if (!content) return 0;

    const charCounts = {};
    for (const char of content) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }

    let entropy = 0;
    const len = content.length;
    for (const count of Object.values(charCounts)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    // Normalize to 0-1 range (max entropy for ASCII is ~7 bits)
    return Math.min(entropy / 4, 1);
  }

  /**
   * Generates hash for content
   * @param {string} content - Content to hash
   * @returns {string} - SHA256 hash
   */
  generateHash(content) {
    return require('crypto').createHash('sha256').update(content).digest('hex');
  }

  /**
   * Sanitizes assessment data for logging
   * @param {Object} assessmentData - Raw assessment data
   * @returns {Object} - Sanitized data
   */
  sanitizeAssessmentData(assessmentData) {
    const sanitized = { ...assessmentData };
    // Remove or redact sensitive input data
    if (sanitized.inputData?.content) {
      sanitized.inputData.content = '[REDACTED]';
    }
    return sanitized;
  }

  /**
   * Redacts PII from strings
   * @param {string} input - Input string
   * @returns {string} - Redacted string
   */
  redactPII(input) {
    if (typeof input !== 'string') return input;
    return input
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL_REDACTED]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
  }

  /**
   * Generates a unique training data ID
   * @returns {string} - Unique ID
   */
  generateTrainingDataId() {
    return `train_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Gets collection statistics
   * @returns {Object} - Collection statistics
   */
  getCollectionStats() {
    return this.validator.getValidationStatistics({
      validationType: 'training_data_quality',
    });
  }
}

module.exports = TrainingDataCollector;
