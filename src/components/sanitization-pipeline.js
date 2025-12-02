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
   * Sanitizes the input data by running it through all pipeline steps with integrity validation.
   * @param {string} data - The input string to sanitize.
   * @param {Object} options - Sanitization options
   * @param {string} options.classification - Destination classification ('llm', 'non-llm', 'unclear')
   * @param {string} options.riskLevel - Risk level ('low', 'medium', 'high')
   * @param {boolean} options.skipValidation - Skip integrity validation
   * @param {Object} options.validationOptions - Options for integrity validation
   * @param {boolean} options.generateTrustToken - Generate trust token for sanitized content
   * @param {Object} options.trustToken - Trust token to validate for caching
   * @returns {string|Object} - The sanitized result or {sanitizedData, trustToken} if generateTrustToken is true
   */
  async sanitize(data, options = {}) {
    const startTime = Date.now();
    let {
      classification = 'unclear',
      riskLevel,
      skipValidation = false,
      validationOptions = {},
      generateTrustToken = false,
      trustToken,
    } = options;

    const trustTokensEnabled = config.features.trustTokens.enabled;
    generateTrustToken = generateTrustToken && trustTokensEnabled;

    // Check for valid trust token and return cached result if available
    if (trustToken && trustTokensEnabled) {
      if (!this.trustTokenGenerator) {
        this.trustTokenGenerator = new TrustTokenGenerator(this.trustTokenOptions);
      }
      const validation = this.trustTokenGenerator.validateToken(trustToken);
      if (validation.isValid) {
        // Check cache for sanitized content
        const cached = this.trustTokenCache.get(trustToken.contentHash);
        if (cached && cached.timestamp + this.cacheTTL > Date.now()) {
          // Move to end for LRU
          const index = this.cacheOrder.indexOf(trustToken.contentHash);
          if (index !== -1) {
            this.cacheOrder.splice(index, 1);
            this.cacheOrder.push(trustToken.contentHash);
          }
          logger.info('Returning cached sanitized content via trust token', {
            contentHash: trustToken.contentHash,
            cacheAge: Date.now() - cached.timestamp,
          });
          // Log audit for cached sanitization
          await this.auditLogger.logRiskAssessmentDecision(
            'cached',
            'Low',
            { riskScore: 0, triggers: ['trust_token_valid'] },
            {
              userId: options.userId,
              resourceId: options.resourceId || 'unknown',
              stage: 'trust-token-cache',
            },
          );
          return cached.sanitizedData;
        }
      } else {
        logger.warn('Invalid trust token provided', { error: validation.error });
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
      dataLength: data.length,
    });

    let result = data;

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

    // Apply sanitization steps
    for (const step of this.steps) {
      result = step.sanitize(result);
      appliedRules.push(step.constructor.name);
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
    const contentHash = crypto.createHash('sha256').update(result).digest('hex');
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
    const inputDataHash = crypto.createHash('sha256').update(data).digest('hex');
    const decisionOutcome = {
      decision: 'sanitized',
      reasoning: assessedRiskLevel,
      riskScore: confidence,
    };
    const contextMetadata = {
      inputLength: data.length,
      outputLength: result.length,
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
      const trustToken = this.trustTokenGenerator.generateToken(result, data, appliedRules);
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
