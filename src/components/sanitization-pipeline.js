const crypto = require('node:crypto');
const UnicodeNormalization = require('./SanitizationPipeline/unicode-normalization.js');
const SymbolStripping = require('./SanitizationPipeline/symbol-stripping.js');
const EscapeNeutralization = require('./SanitizationPipeline/escape-neutralization.js');
const PatternRedaction = require('./SanitizationPipeline/pattern-redaction.js');
const DataIntegrityValidator = require('./DataIntegrityValidator');
const TrustTokenGenerator = require('./TrustTokenGenerator');
const AuditLogger = require('./data-integrity/AuditLogger');
const winston = require('winston');
const config = require('../config');
const { recordTokenGeneration } = require('../utils/monitoring');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * SanitizationPipeline orchestrates the sanitization steps with data integrity validation.
 * Processes data through normalization, stripping, neutralization, redaction, and validation.
 */
class SanitizationPipeline {
  constructor(options = {}) {
    this.steps = [
      new UnicodeNormalization(),
      new SymbolStripping(),
      new EscapeNeutralization(),
      new PatternRedaction(),
    ];

    // Configure sanitization modes
    this.modes = {
      standard: [...this.steps],
      final: [...this.steps], // Start with same steps, can add final validation later
    };

    // Configure sanitization modes
    this.modes = {
      standard: [...this.steps],
      final: [...this.steps], // Start with same steps, can add final validation later
    };

    // Initialize data integrity validator
    this.integrityValidator = new DataIntegrityValidator(options.integrityOptions || {});
    this.enableValidation = options.enableValidation !== false;

    // Initialize audit logger
    this.auditLogger = options.auditLogger || new AuditLogger(options.auditOptions || {});

    // Initialize trust token generator (lazy initialization)
    this.trustTokenGenerator = null;
    this.trustTokenOptions = options.trustTokenOptions || {};

    // Initialize trust token cache for sanitized content
    this.trustTokenCache = new Map();
    this.cacheOrder = [];
    this.cacheMaxSize = options.cacheMaxSize || 1000;
    this.cacheTTL = options.cacheTTL || 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Recursively sanitizes string values in an object or array (similar to jobWorker sanitizeObject)
   * @param {any} data - The data to sanitize
   * @returns {any} - The sanitized data
   */
  sanitizeObject(data) {
    if (typeof data === 'string') {
      // Apply string sanitization using pipeline steps
      let result = data;
      for (const step of this.steps) {
        result = step.sanitize(result);
      }
      return result;
    } else if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeObject(item));
    } else if (data && typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip sanitizing certain metadata fields that should remain intact
        if (
          ['trustToken', 'timestamp', 'requestId', 'correlationId', 'validationId'].includes(key)
        ) {
          sanitized[key] = value;
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
      return sanitized;
    }
    return data;
  }

  /**
   * Sanitizes the given data using the configured pipeline.
   * @param {string|Object} data - The input data to sanitize.
   * @param {boolean} options.generateTrustToken - Generate trust token for sanitized content
   * @param {string} options.mode - Sanitization mode ('standard' or 'final')
   * @returns {string|Object} - The sanitized result or {sanitizedData, trustToken} if generateTrustToken is true
   */
  async sanitize(data, options = {}) {
    const startTime = Date.now();
    const {
      classification = 'unclear',
      riskLevel,
      skipValidation = false,
      validationOptions = {},
      trustToken,
      mode = 'standard',
    } = options;
    let generateTrustToken = options.generateTrustToken || false;

    let result = data;
    let isJsonData = false;

    // Try to parse string data as JSON first
    let isJsonString = false;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
          result = parsed;
          isJsonString = true;
          isJsonData = true;
        }
      } catch (e) {
        // Not JSON, proceed as string
      }
    } else if (typeof data === 'object' && data !== null) {
      isJsonData = true;
    }

    // Handle JSON data by recursively sanitizing object structure
    if (isJsonData) {
      result = this.sanitizeObject(result);
      if (isJsonString) {
        result = JSON.stringify(result);
      }
    }

    // Apply sanitization steps based on mode
    if (typeof result === 'string') {
      const activeSteps = this.modes[mode] || this.modes.standard;
      for (const step of activeSteps) {
        result = step.sanitize(result);
      }
    }

    // Generate trust token if requested
    let trustTokenResult = null;
    if (generateTrustToken) {
      trustTokenResult = await this.generateTrustToken(result, {
        classification,
        riskLevel: riskLevel || 'medium',
        appliedRules: [],
        processingTime: Date.now() - startTime,
        operation: 'sanitization',
      });
    }

    // Return result
    if (generateTrustToken) {
      return {
        sanitizedData: result,
        trustToken: trustTokenResult,
        appliedRules: [],
        processingTime: Date.now() - startTime,
      };
    }

    return result;
  }
        resourceId: options.resourceId || 'unknown',
        stage: 'risk-assessment',
      },
    return result;
  }
      await this.auditLogger.logHighRiskCase(
        {
          userId: options.userId,
          resourceId: options.resourceId || 'unknown',
          sessionId: options.sessionId,
          stage: 'high_risk_detection',
        },
        mlFields,
      );
    } else if (assessedRiskLevel === 'Unknown' && confidence < 0.3) {
      // Unknown Risk: confidence < 0.3 requiring HITL
      const mlFields = {
        threatPatternId: options.threatPatternId || 'unknown_pattern',
        confidenceScore: confidence,
        mitigationActions: options.mitigationActions || ['hitl_required'],
        featureVector: options.featureVector || { riskIndicators: ['unclear_threat'] },
        trainingLabels: options.trainingLabels || { supervised: 'unknown_risk' },
        anomalyScore: options.anomalyScore || 1 - confidence,
        detectionTimestamp: new Date().toISOString(),
      };
      await this.auditLogger.logUnknownRiskCase(
        {
          userId: options.userId,
          resourceId: options.resourceId || 'unknown',
          sessionId: options.sessionId,
          stage: 'unknown_risk_detection',
        },
        mlFields,
      );
    }

    // Apply full sanitization pipeline (default behavior)
    logger.info('Applying full sanitization pipeline', {
      classification,
      riskLevel,
      dataLength: typeof data === 'string' ? data.length : JSON.stringify(data).length,
      dataType: typeof data,
    });

    let result = data;

    // Try to parse string data as JSON first
    let isJsonString = false;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
          result = parsed;
          isJsonString = true;
          logger.info('Detected JSON string, applying recursive sanitization');
        }
      } catch (e) {
        // Not JSON, proceed as string
      }
    }

    // Handle JSON data by recursively sanitizing object structure
    if (isJsonData) {
      logger.info('Detected JSON data, applying recursive sanitization');
      result = this.sanitizeObject(result);

      if (isJsonString) {
        result = JSON.stringify(result);
        // Note: isJsonData remains true so we skip the string sanitization loop
        // but result is now a string.
      }
    }
    }
    }
      result = this.sanitizeObject(result);

      if (isJsonString) {
        result = JSON.stringify(result);
        // Note: isJsonData remains true so we skip the string sanitization loop
        // but result is now a string.
      }
    }

    // Pre-validation hook
    if (this.enableValidation && !skipValidation) {
      const preValidation = await this.integrityValidator.validateData(result, {
        source: 'pre-sanitization',
        ...validationOptions,
      });

      if (!preValidation.isValid) {
        logger.warn('Pre-sanitization validation failed', {
          validationId: preValidation.validationId,
          errors: preValidation.errors,
        });
      }
    }

    // Post-validation hook
    if (this.enableValidation && !skipValidation) {
      const postValidation = await this.integrityValidator.validateData(result, {
        source: 'post-sanitization',
        ...validationOptions,
      });

      if (!postValidation.isValid) {
        logger.warn('Post-sanitization validation failed', {
          validationId: postValidation.validationId,
          errors: postValidation.errors,
        });
      }
    }

    // Post-validation hook
    if (this.enableValidation && !skipValidation) {
      const postValidation = await this.integrityValidator.validateData(result, {
        source: 'post-sanitization',
        ...validationOptions,
      });

      if (!postValidation.isValid) {
        logger.error('Post-sanitization validation failed', {
          validationId: postValidation.validationId,
          errors: postValidation.errors,
        });
      }
    }

    // Cache the sanitized result
    const contentToHash = typeof result === 'string' ? result : JSON.stringify(result);
    const contentHash = crypto.createHash('sha256').update(contentToHash).digest('hex');
    this.trustTokenCache.set(contentHash, {
      sanitizedData: result,
      timestamp: Date.now(),
    });
    this.cacheOrder.push(contentHash);
    // Maintain cache size (LRU)
    if (this.trustTokenCache.size > this.cacheMaxSize) {
      const oldestKey = this.cacheOrder.shift();
      this.trustTokenCache.delete(oldestKey);
    }

    // Log high-fidelity data collection for AI training
    const processingTime = Date.now() - startTime;
    const inputDataForHash = typeof data === 'string' ? data : JSON.stringify(data);
    const inputDataHash = crypto.createHash('sha256').update(inputDataForHash).digest('hex');
    const decisionOutcome = {
      decision: 'sanitized',
      reasoning: assessedRiskLevel,
      riskScore: confidence,
    };
    const inputDataForLength = typeof data === 'string' ? data : JSON.stringify(data);
    const contextMetadata = {
      inputLength: inputDataForLength.length,
      outputLength: typeof result === 'string' ? result.length : JSON.stringify(result).length,
      processingTime,
    };
    const processingSteps = appliedRules;
    await this.auditLogger.logHighFidelityDataCollection(
      inputDataHash,
      processingSteps,
      decisionOutcome,
      contextMetadata,
      {
        userId: options.userId,
        resourceId: options.resourceId || 'unknown',
        sessionId: options.sessionId,
      },
    );

    // Generate trust token if requested
    let trustTokenResult = null;
    if (generateTrustToken) {
      trustTokenResult = await this.generateTrustToken(result, {
        classification,
        riskLevel: assessedRiskLevel,
        appliedRules,
        processingTime: Date.now() - startTime,
        operation: 'sanitization',
      });
    }

    // Return result
    if (generateTrustToken) {
      return {
        sanitizedData: result,
        trustToken: trustTokenResult,
        appliedRules,
        processingTime: Date.now() - startTime,
      };
    }

    return result;
  }

module.exports = SanitizationPipeline;
