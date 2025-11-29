const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * JSON Repair Utility
 * Handles common JSON parsing issues in AI-generated content
 */
class JSONRepair {
  constructor(options = {}) {
    this.maxRepairAttempts = options.maxRepairAttempts || 3;
    this.logger = logger;
  }

  /**
   * Main repair function - attempts to fix malformed JSON
   * @param {string} jsonString - The potentially malformed JSON string
   * @param {Object} options - Repair options
   * @returns {Object} - {success: boolean, data: any, repairs: string[]}
   */
  repair(jsonString, options = {}) {
    if (!jsonString || typeof jsonString !== 'string') {
      return { success: false, data: null, repairs: [], error: 'Invalid input: not a string' };
    }

    const repairs = [];
    let currentString = jsonString.trim();

    // Attempt multiple repair strategies
    for (let attempt = 0; attempt < this.maxRepairAttempts; attempt++) {
      try {
        // Try parsing as-is first
        const result = JSON.parse(currentString);
        return { success: true, data: result, repairs };
      } catch (parseError) {
        this.logger.debug(`JSON parse attempt ${attempt + 1} failed:`, parseError.message);

        // Apply repair strategies based on error
        const repairResult = this.applyRepairStrategy(currentString, parseError, repairs);

        if (!repairResult.repaired) {
          break; // No more repairs possible
        }

        currentString = repairResult.string;
        repairs.push(repairResult.description);
      }
    }

    // Final fallback: try to extract partial valid JSON
    const partialResult = this.extractPartialJSON(currentString);
    if (partialResult.success) {
      repairs.push('Extracted partial valid JSON structure');
      return { success: true, data: partialResult.data, repairs };
    }

    // New fallback: try to extract partial array
    const partialArrayResult = this.extractPartialArray(currentString);
    if (partialArrayResult.success) {
      repairs.push('Extracted partial array');
      return { success: true, data: partialArrayResult.data, repairs };
    }

    return {
      success: false,
      data: null,
      repairs,
      error: 'Unable to repair JSON after all attempts',
    };
  }

  /**
   * Extract valid objects from a truncated array
   */
  extractPartialArray(jsonString) {
    if (!jsonString.trim().startsWith('[')) return { success: false };

    const objects = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            const substr = jsonString.substring(start, i + 1);
            const obj = JSON.parse(substr);
            objects.push(obj);
          } catch (e) {
            // Ignore invalid objects
          }
          start = -1;
        }
      }
    }

    if (objects.length > 0) {
      return { success: true, data: objects };
    }

    return { success: false };
  }

  /**
   * Apply repair strategy based on parse error
   */
  applyRepairStrategy(jsonString, parseError, repairs) {
    const errorMessage = parseError.message;

    // Strategy 1: Fix unterminated strings (missing closing quotes)
    if (errorMessage.includes('Unterminated string')) {
      return this.fixUnterminatedString(jsonString);
    }

    // Strategy 2: Fix truncated JSON (missing closing braces/brackets)
    if (
      errorMessage.includes('Unexpected end of JSON input') ||
      (errorMessage.includes('Expected') && errorMessage.includes('but end of input found')) ||
      (errorMessage.includes('Expected') && errorMessage.includes('after property value'))
    ) {
      return this.fixTruncatedJSON(jsonString);
    }

    // Strategy 3: Fix trailing commas (causing "Expected double-quoted property name")
    if (
      errorMessage.includes('Expected double-quoted property name') ||
      (errorMessage.includes('Unexpected token') && errorMessage.includes(','))
    ) {
      return this.fixTrailingCommas(jsonString);
    }

    // Strategy 4: Fix unescaped quotes in strings
    if (errorMessage.includes('Unexpected string') || errorMessage.includes('Invalid string')) {
      return this.fixUnescapedQuotes(jsonString);
    }

    // Strategy 5: Fix missing commas between elements
    if (errorMessage.includes('Unexpected token') && !errorMessage.includes(',')) {
      return this.fixMissingCommas(jsonString);
    }

    return { repaired: false };
  }

  /**
   * Fix unterminated strings (missing closing quotes)
   */
  fixUnterminatedString(jsonString) {
    let fixed = jsonString;

    // Find the last unterminated string and add closing quote
    let inString = false;
    let escapeNext = false;
    let lastStringStart = -1;

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        if (!inString) {
          inString = true;
          lastStringStart = i;
        } else {
          inString = false;
          lastStringStart = -1;
        }
      }
    }

    // If we're still in a string at the end, add closing quote
    if (inString) {
      fixed += '"';
      return {
        repaired: true,
        string: fixed,
        description: 'Added missing closing quote for unterminated string',
      };
    }

    return { repaired: false };
  }

  /**
   * Fix truncated JSON (missing closing braces/brackets)
   */
  fixTruncatedJSON(jsonString) {
    let fixed = jsonString;

    // Simple counting approach - count braces and brackets
    let openBraces = 0;
    let closeBraces = 0;
    let openBrackets = 0;
    let closeBrackets = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') openBraces++;
      if (char === '}') closeBraces++;
      if (char === '[') openBrackets++;
      if (char === ']') closeBrackets++;
    }

    // Add missing closing braces
    for (let i = 0; i < openBraces - closeBraces; i++) {
      fixed += '}';
    }

    // Add missing closing brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      fixed += ']';
    }

    // Handle unclosed strings
    if (inString) {
      fixed += '"';
    }

    const wasRepaired = fixed !== jsonString;

    return {
      repaired: wasRepaired,
      string: fixed,
      description: 'Added missing closing braces/brackets and quotes',
    };
  }

  /**
   * Fix unterminated strings (missing closing quotes)
   */
  fixUnterminatedString(jsonString) {
    let fixed = jsonString;

    // Find the last unterminated string and add closing quote
    let inString = false;
    let escapeNext = false;
    let lastStringStart = -1;

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        if (!inString) {
          inString = true;
          lastStringStart = i;
        } else {
          inString = false;
          lastStringStart = -1;
        }
      }
    }

    // If we're still in a string at the end, add closing quote
    if (inString) {
      fixed += '"';
      return {
        repaired: true,
        string: fixed,
        description: 'Added missing closing quote for unterminated string',
      };
    }

    return { repaired: false };
  }

  /**
   * Fix unescaped quotes in string values
   */
  fixUnescapedQuotes(jsonString) {
    // This is complex - we'll use a simple approach to escape unescaped quotes
    // More sophisticated parsing would be needed for production
    let fixed = jsonString.replace(
      /([^\\])"([^"]*)"([^,}\]]*[^\\])"([^,}\]]*)/g,
      '$1"$2\\"$3\\"$4',
    );

    return {
      repaired: fixed !== jsonString,
      string: fixed,
      description: 'Escaped unescaped quotes in string values',
    };
  }

  /**
   * Fix trailing commas before closing braces/brackets
   */
  fixTrailingCommas(jsonString) {
    let fixed = jsonString
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/,(\s*),/g, ','); // Remove duplicate commas

    return {
      repaired: fixed !== jsonString,
      string: fixed,
      description: 'Removed trailing commas',
    };
  }

  /**
   * Fix missing commas between array/object elements
   */
  fixMissingCommas(jsonString) {
    // This is a simplistic approach - in practice, this would need more sophisticated parsing
    let fixed = jsonString
      .replace(/}(\s*"){/g, '},$1{') // Add commas between objects
      .replace(/](\s*)\[/g, '],$1[') // Add commas between arrays
      .replace(/](\s*){/g, '],$1{') // Add commas between array and object
      .replace(/}(\s*)\[/g, '},$1['); // Add commas between object and array

    return {
      repaired: fixed !== jsonString,
      string: fixed,
      description: 'Added missing commas between elements',
    };
  }

  /**
   * Extract partial valid JSON when full repair fails
   */
  extractPartialJSON(jsonString) {
    try {
      // Try to find the largest valid JSON substring
      const startBrace = jsonString.indexOf('{');
      const startBracket = jsonString.indexOf('[');

      if (startBrace === -1 && startBracket === -1) {
        return { success: false };
      }

      const start = Math.min(
        startBrace !== -1 ? startBrace : Infinity,
        startBracket !== -1 ? startBracket : Infinity,
      );

      // Find matching closing brace/bracket
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = start; i < jsonString.length; i++) {
        const char = jsonString[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;

        // If we have balanced braces/brackets, try parsing
        if (braceCount === 0 && bracketCount === 0 && i > start) {
          try {
            const partial = jsonString.substring(start, i + 1);
            const parsed = JSON.parse(partial);
            return { success: true, data: parsed };
          } catch (e) {
            // Continue searching
          }
        }
      }

      return { success: false };
    } catch (e) {
      return { success: false };
    }
  }

  /**
   * Validate if a string is valid JSON
   */
  isValidJSON(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = JSONRepair;
