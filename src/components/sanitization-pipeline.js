const UnicodeNormalization = require('./SanitizationPipeline/unicode-normalization.js');
const SymbolStripping = require('./SanitizationPipeline/symbol-stripping.js');
const EscapeNeutralization = require('./SanitizationPipeline/escape-neutralization.js');
const PatternRedaction = require('./SanitizationPipeline/pattern-redaction.js');

/**
 * SanitizationPipeline orchestrates the sanitization steps.
 * Processes data through normalization, stripping, neutralization, and redaction.
 */
class SanitizationPipeline {
  constructor() {
    this.steps = [
      new UnicodeNormalization(),
      new SymbolStripping(),
      new EscapeNeutralization(),
      new PatternRedaction(),
    ];
  }

  /**
   * Sanitizes the input data by running it through all pipeline steps.
   * @param {string} data - The input string to sanitize.
   * @param {Object} options - Sanitization options
   * @param {string} options.classification - Destination classification ('llm', 'non-llm', 'unclear')
   * @returns {string} - The sanitized string (or original if not LLM-bound).
   */
  sanitize(data, options = {}) {
    const { classification = 'unclear' } = options;

    // For security, default to full sanitization if classification is unclear
    if (classification === 'non-llm') {
      // Skip sanitization for non-LLM traffic
      return data;
    }

    // Apply full sanitization for LLM-bound or unclear traffic
    let result = data;
    for (const step of this.steps) {
      result = step.sanitize(result);
    }
    return result;
  }
}

module.exports = SanitizationPipeline;
