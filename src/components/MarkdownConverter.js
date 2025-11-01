const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * MarkdownConverter converts plain text to structured Markdown format.
 * Implements heuristics to detect headings, lists, and preserve document structure.
 */
class MarkdownConverter {
  /**
   * Converts plain text to Markdown format.
   * @param {string} text - The plain text to convert
   * @returns {string} - The converted Markdown text
   */
  convert(text) {
    try {
      logger.info('Starting Markdown conversion', { textLength: text.length });

      if (!text || typeof text !== 'string') {
        return text;
      }

      // Split into lines for processing
      const lines = text.split('\n');
      const convertedLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1]?.trim() || '';

        // Skip empty lines
        if (!line) {
          convertedLines.push('');
          continue;
        }

        // Detect headings (heuristic: short lines, all caps, or followed by blank line)
        if (this.isHeading(line, nextLine)) {
          const headingLevel = this.determineHeadingLevel(line);
          convertedLines.push(`${'#'.repeat(headingLevel)} ${line}`);
          continue;
        }

        // Detect lists
        if (this.isListItem(line)) {
          convertedLines.push(this.convertListItem(line));
          continue;
        }

        // Regular paragraph text - leave unchanged
        convertedLines.push(lines[i]); // Keep original formatting
      }

      const result = convertedLines.join('\n');
      logger.info('Markdown conversion completed', { resultLength: result.length });
      return result;
    } catch (error) {
      logger.error('Markdown conversion failed', { error: error.message });
      // Fallback: return original text
      return text;
    }
  }

  /**
   * Determines if a line appears to be a heading.
   * @param {string} line - The current line
   * @param {string} nextLine - The next line
   * @returns {boolean} - True if line is likely a heading
   */
  isHeading(line) {
    // Very short lines (likely titles) - under 25 chars, not ending with punctuation
    if (line.length < 25 && line.length > 3 && !/[.!?]$/.test(line)) {
      return true;
    }

    // All caps lines that are reasonably short and contain only letters/spaces
    if (
      line === line.toUpperCase() &&
      line.length > 5 &&
      line.length < 35 &&
      /^[A-Z\s]+$/.test(line)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Determines the heading level based on line characteristics.
   * @param {string} line - The heading line
   * @returns {number} - Heading level (1-3)
   */
  determineHeadingLevel(line) {
    // All caps are likely H2
    if (line === line.toUpperCase() && /^[A-Z\s]+$/.test(line)) {
      return 2;
    }

    // Very short lines are likely main titles (H1)
    if (line.length < 20) {
      return 1;
    }

    // Default to H3 for other cases
    return 3;
  }

  /**
   * Determines if a line is a list item.
   * @param {string} line - The line to check
   * @returns {boolean} - True if line is a list item
   */
  isListItem(line) {
    // Numbered lists: 1. 2. 3. etc.
    if (/^\d+\.\s/.test(line)) {
      return true;
    }

    // Bulleted lists: - * •
    if (/^[-*•]\s/.test(line)) {
      return true;
    }

    return false;
  }

  /**
   * Converts a list item to Markdown format.
   * @param {string} line - The list item line
   * @returns {string} - The converted list item
   */
  convertListItem(line) {
    // Already in Markdown format for numbered lists
    if (/^\d+\.\s/.test(line)) {
      return line;
    }

    // Convert bullets to Markdown
    if (/^[-*•]\s/.test(line)) {
      return `- ${line.slice(2)}`;
    }

    return line;
  }
}

module.exports = MarkdownConverter;
