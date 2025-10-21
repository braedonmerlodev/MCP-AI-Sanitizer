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
    return data.normalize('NFC');
  }
}

module.exports = UnicodeNormalization;
