/**
 * UnicodeNormalization component for normalizing Unicode text.
 * Ensures consistent Unicode representation to prevent bypass attempts.
 */
class UnicodeNormalization {
  /**
   * Sanitizes the input data by normalizing Unicode.
   * @param {string} data - The input string to sanitize.
   * @returns {string} - The normalized string.
   */
  sanitize(data) {
    // Ensure data is a string before normalizing
    const str = typeof data === 'string' ? data : String(data || '');
    return str.normalize('NFC');
  }
}

module.exports = UnicodeNormalization;
