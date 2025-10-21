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
   * @returns {string} - The fully sanitized string.
   */
  sanitize(data) {
    let result = data;
    for (const step of this.steps) {
      result = step.sanitize(result);
    }
    return result;
  }
}

module.exports = SanitizationPipeline;
