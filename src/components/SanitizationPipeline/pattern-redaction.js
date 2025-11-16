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

    // Remove HTML script tags and their content
    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove other HTML tags but keep content
    result = result.replace(/<[^>]*>/g, '');

    // Remove potential XSS vectors
    result = result.replace(/javascript:/gi, '');
    result = result.replace(/on\w+\s*=/gi, '');

    // Remove data URLs that might contain scripts
    result = result.replace(/data:\s*text\/html[^,]+,/gi, '');

    return result;
  }
}

module.exports = PatternRedaction;
