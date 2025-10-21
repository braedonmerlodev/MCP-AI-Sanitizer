/**
 * SymbolStripping component for sanitizing zero-width and non-printing characters.
 * Removes control characters and zero-width Unicode symbols to prevent hidden instructions.
 */
class SymbolStripping {
  /**
   * Sanitizes the input data by removing zero-width and non-printing characters.
   * @param {string} data - The input string to sanitize.
   * @returns {string} - The sanitized string.
   */
  sanitize(data) {
    // Define zero-width characters
    const zeroWidthChars = '\u200B\u200C\u200D\u200E\u200F\u2028\u2029\uFEFF';
    // Define control characters (excluding tab, LF, CR)
    const controlChars =
      '\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u000B\u000C\u000E\u000F\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001A\u001B\u001C\u001D\u001E\u001F\u007F\u0080\u0081\u0082\u0083\u0084\u0085\u0086\u0087\u0088\u0089\u008A\u008B\u008C\u008D\u008E\u008F\u0090\u0091\u0092\u0093\u0094\u0095\u0096\u0097\u0098\u0099\u009A\u009B\u009C\u009D\u009E\u009F';
    // Create regex to match these characters
    const regex = new RegExp(`[${zeroWidthChars}${controlChars}]`, 'g');
    return data.replaceAll(regex, '');
  }
}

module.exports = SymbolStripping;
