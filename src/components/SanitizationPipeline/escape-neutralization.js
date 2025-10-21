/**
 * EscapeNeutralization component for neutralizing ANSI escape sequences.
 * Removes ANSI escape codes to prevent terminal control sequences from executing.
 */
class EscapeNeutralization {
  /**
   * Sanitizes the input data by neutralizing ANSI escape sequences.
   * @param {string} data - The input string to sanitize.
   * @returns {string} - The sanitized string.
   */
  sanitize(data) {
    // Regex to match ANSI escape sequences: \x1B[ followed by parameters and ending letter
    const ansiEscapeRegex = /\u001B\[[0-9;]*[A-Za-z]/g;
    return data.replaceAll(ansiEscapeRegex, '');
  }
}

module.exports = EscapeNeutralization;
