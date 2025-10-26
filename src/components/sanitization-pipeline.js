const UnicodeNormalization = require('./SanitizationPipeline/unicode-normalization.js');
const SymbolStripping = require('./SanitizationPipeline/symbol-stripping.js');
const EscapeNeutralization = require('./SanitizationPipeline/escape-neutralization.js');
const PatternRedaction = require('./SanitizationPipeline/pattern-redaction.js');
const DataIntegrityValidator = require('./DataIntegrityValidator');
const TrustTokenGenerator = require('./TrustTokenGenerator');
const winston = require('winston');

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

    // Initialize trust token generator (lazy initialization)
    this.trustTokenGenerator = null;
    this.trustTokenOptions = options.trustTokenOptions || {};
  }

  /**
   * Sanitizes the input data by running it through all pipeline steps with integrity validation.
   * @param {string} data - The input string to sanitize.
   * @param {Object} options - Sanitization options
   * @param {string} options.classification - Destination classification ('llm', 'non-llm', 'unclear')
   * @param {boolean} options.skipValidation - Skip integrity validation
   * @param {Object} options.validationOptions - Options for integrity validation
   * @param {boolean} options.generateTrustToken - Generate trust token for sanitized content
   * @returns {string|Object} - The sanitized result or {sanitizedData, trustToken} if generateTrustToken is true
   */
  async sanitize(data, options = {}) {
    const {
      classification = 'unclear',
      skipValidation = false,
      validationOptions = {},
      generateTrustToken = false,
    } = options;

    // For security, default to full sanitization if classification is unclear
    if (classification === 'non-llm') {
      // Skip sanitization for non-LLM traffic
      logger.info('Sanitization bypassed for non-LLM traffic', {
        classification,
        dataLength: data.length,
      });

      // Still validate if enabled and not explicitly skipped
      if (this.enableValidation && !skipValidation) {
        const validationResult = await this.integrityValidator.validateData(data, {
          source: 'non-llm-bypass',
          ...validationOptions,
        });

        if (!validationResult.isValid) {
          logger.warn('Data integrity validation failed for bypassed sanitization', {
            validationId: validationResult.validationId,
            errors: validationResult.errors,
          });
        }
      }

      return data;
    }

    // Apply full sanitization for LLM-bound or unclear traffic
    logger.info('Applying full sanitization pipeline', { classification, dataLength: data.length });

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
