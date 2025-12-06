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
   * Sanitizes the input data by running it through all pipeline steps with integrity validation.
   * Handles both string and structured JSON data.
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

    const trustTokensEnabled = config.features.trustTokens.enabled;
    generateTrustToken = generateTrustToken && trustTokensEnabled;

    // Zero-trust: Always perform full sanitization, trust tokens are for validation only
    // Note: Trust tokens can still be generated for future validation, but we never skip sanitization
    if (trustToken && trustTokensEnabled) {
      if (!this.trustTokenGenerator) {
        this.trustTokenGenerator = new TrustTokenGenerator(this.trustTokenOptions);
      }
      const validation = this.trustTokenGenerator.validateToken(trustToken);
      if (validation.isValid) {
        logger.info('Trust token validated, proceeding with full sanitization', {
          contentHash: trustToken.contentHash,
        });
      } else {
        logger.warn('Invalid trust token provided, proceeding with sanitization anyway', {
          error: validation.error,
        });
      }
    }

    // Log risk assessment decision (always sanitize unless cached)
    const decisionType = riskLevel === 'high' ? 'detection' : 'classification';
    const assessedRiskLevel =
      riskLevel ||
      (classification === 'non-llm' ? 'Low' : classification === 'llm' ? 'High' : 'Unknown');
    await this.auditLogger.logRiskAssessmentDecision(
      decisionType,
      assessedRiskLevel,
      {
        riskScore: options.riskScore || 0,
        triggers: options.triggers || [],
      },
      {
        userId: options.userId,
        resourceId: options.resourceId || 'unknown',
        stage: 'risk-assessment',
      },
    );

    // Log high-risk or unknown-risk cases with ML-optimized fields if thresholds met
    const confidence = options.riskScore || 0;
    if (assessedRiskLevel === 'High' && confidence > 0.8) {
      // High-Level Risk: confidence > 0.8 with known threat patterns
      const mlFields = {
        threatPatternId:
          options.threatPatternId ||
          (options.triggers && options.triggers.length > 0 ? options.triggers[0] : 'unknown'),
        confidenceScore: confidence,
        mitigationActions: options.mitigationActions || ['sanitization_applied'],
        featureVector: options.featureVector || { riskIndicators: options.triggers || [] },
        trainingLabels: options.trainingLabels || { supervised: 'high_risk' },
        anomalyScore: options.anomalyScore || confidence,
        detectionTimestamp: new Date().toISOString(),
      };
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
    let isJsonData = false;
    if (typeof result === 'object' && result !== null) {
      isJsonData = true;
      if (!isJsonString) {
        logger.info('Detected JSON data, applying recursive sanitization');
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

        // Continue with sanitization but log the issues
      }
    }

    // Track applied rules for trust token
    const appliedRules = [];

    // Apply sanitization steps based on mode (skip for already sanitized JSON data)
    if (typeof result === 'string') {
      const activeSteps = this.modes[mode] || this.modes.standard;
      for (const step of activeSteps) {
        result = step.sanitize(result);
      }
    } else {
      // For JSON data, we've already applied sanitization via sanitizeObject
      appliedRules.push('RecursiveObjectSanitization');
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
    if (generateTrustToken) {
      if (!this.trustTokenGenerator) {
        this.trustTokenGenerator = new TrustTokenGenerator(this.trustTokenOptions);
      }
      const startTime = process.hrtime.bigint();
      // Ensure trust token generator gets a string if it expects one
      const tokenContent = typeof result === 'string' ? result : JSON.stringify(result);
      // But wait, if result is object, we probably want to hash the object content.
      // Assuming generator uses update(content), we should pass string.
      const trustToken = this.trustTokenGenerator.generateToken(tokenContent, data, appliedRules);
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      recordTokenGeneration(durationMs);
      return {
        sanitizedData: result,
        trustToken,
      };
    }

    // Return just the sanitized data if validation is disabled or trust token not requested
    return result;
  }
}

module.exports = SanitizationPipeline;
