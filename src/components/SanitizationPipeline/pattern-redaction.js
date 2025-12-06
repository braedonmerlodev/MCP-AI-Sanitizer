const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * PatternRedaction component for redacting sensitive patterns.
 * Removes or masks sensitive information like credit card numbers, SSNs, etc.
 */
class PatternRedaction {
  /**
   * Sanitizes the input data by redacting sensitive patterns.
   * @param {string} data - The input string to sanitize.
   * @returns {string} - The redacted string.
   */
  sanitize(data) {
    let result = data;

    // Helper for logging redactions
    const logRedaction = (patternName, original, redacted) => {
      if (original !== redacted) {
        // Calculate number of replacements by length difference or regex match count
        // This is a rough estimation for logging purposes
        logger.info(`PatternRedaction: Redacted ${patternName}`, {
          pattern: patternName,
          dataLength: original.length,
          redactedLength: redacted.length,
          preview: original.substring(0, 50) + '...',
        });
      }
    };

    const initialData = result;

    // Remove HTML script tags and their content
    result = result.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Aggressive HTML tag stripping causing data loss - relying on symbol stripping instead
    // result = result.replaceAll(/<[^>]*>/g, '');

    // Remove potential XSS vectors - complete removal of dangerous URLs and handlers
    result = result.replaceAll(/javascript:[^'"\s]*/gi, '');
    result = result.replaceAll(/vbscript:[^'"\s]*/gi, '');
    result = result.replaceAll(/data:text\/html[^'"\s]*/gi, '');
    result = result.replaceAll(/data:text\/javascript[^'"\s]*/gi, '');
    result = result.replaceAll(/on\w+\s*=\s*[^'">\s]*/gi, '');

    // Remove data URLs that might contain scripts - comprehensive removal
    result = result.replaceAll(/data:\s*text\/html[^'"\s,]*,[^'"\s]*/gi, '');
    result = result.replaceAll(/data:\s*text\/javascript[^'"\s,]*,[^'"\s]*/gi, '');
    result = result.replaceAll(/data:\s*application\/javascript[^'"\s,]*,[^'"\s]*/gi, '');

    // Remove email addresses
    result = result.replaceAll(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      'EMAIL_REDACTED',
    );

    // Remove phone numbers (various formats) - using negative lookbehind simulation/robust patterns
    // Matches: 123-456-7890, 123.456.7890, 1234567890
    const phoneRegex = /(?<!\d)\d{3}[-.]?\d{3}[-.]?\d{4}(?!\d)/g;
    if (phoneRegex.test(result)) {
      logger.info('PatternRedaction: Phone number pattern detected', {
        matchPreview: result.match(phoneRegex)?.slice(0, 3),
      });
      result = result.replaceAll(phoneRegex, 'PHONE_REDACTED');
    }

    result = result.replaceAll(/(?<!\d)\(\d{3}\)\s*\d{3}[-.]?\d{4}(?!\d)/g, 'PHONE_REDACTED');

    // Remove SSN patterns
    // Matches: 123-45-6789, 123456789
    const ssnRegex = /(?<!\d)\d{3}[-]?\d{2}[-]?\d{4}(?!\d)/g;
    if (ssnRegex.test(result)) {
      logger.info('PatternRedaction: SSN pattern detected', {
        matchPreview: result.match(ssnRegex)?.slice(0, 3),
      });
      result = result.replaceAll(ssnRegex, 'SSN_REDACTED');
    }

    // Remove credit card numbers (basic pattern)
    result = result.replaceAll(
      /(?<!\d)\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}(?!\d)/g,
      'CC_REDACTED',
    );

    // Remove potential malicious Unicode sequences and symbols
    result = result.replaceAll(/[\u200B-\u200F\u2028-\u2029\uFEFF]/g, ''); // Zero-width and control chars

    // Remove HTML entities
    result = result.replaceAll(/&(lt|gt|quot|apos|amp);/gi, '');

    // Remove suspicious symbol sequences and special characters that might be obfuscation
    // Includes: < > ( ) { } [ ] \ | ~ ` " ' ; : = ? ! @ # $ % ^ & * + , - . /
    result = result.replaceAll(/[<>(){}[\]\\|~`"';:=?!@#$%^&*+,\-./]/g, '');

    if (initialData !== result) {
      // logger.info('PatternRedaction: Content was modified');
    }

    return result;
  }
}

module.exports = PatternRedaction;
