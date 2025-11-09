const fs = require('node:fs');
const path = require('node:path');

/**
 * Configuration for sanitization risk mappings.
 * Maps destination classifications to risk levels.
 */
class SanitizationConfig {
  constructor() {
    this.riskMappings = this.loadRiskMappings();
  }

  /**
   * Loads risk mappings from environment variable or config file.
   * Falls back to secure defaults if invalid or missing.
   * @returns {Object} Risk mappings object
   */
  loadRiskMappings() {
    const defaultMappings = {
      llm: 'high',
      'non-llm': 'low',
      unclear: 'medium',
      internal: 'low',
      external: 'high',
    };

    let mappings = null;

    // Try environment variable first
    const envMappings = process.env.SANITIZATION_RISK_MAPPINGS;
    if (envMappings) {
      try {
        mappings = JSON.parse(envMappings);
      } catch (error) {
        console.warn('Invalid SANITIZATION_RISK_MAPPINGS JSON, using defaults', error.message);
      }
    }

    // Try config file if env not set or invalid
    if (!mappings) {
      const configPath = path.join(__dirname, 'sanitization-config.json');
      if (fs.existsSync(configPath)) {
        try {
          const fileContent = fs.readFileSync(configPath, 'utf8');
          mappings = JSON.parse(fileContent);
        } catch (error) {
          console.warn('Invalid sanitization-config.json, using defaults', error.message);
        }
      }
    }

    // Validate and merge with defaults
    if (mappings && this.validateMappings(mappings)) {
      return { ...defaultMappings, ...mappings };
    }

    return defaultMappings;
  }

  /**
   * Validates the risk mappings object.
   * @param {Object} mappings - The mappings to validate
   * @returns {boolean} True if valid
   */
  validateMappings(mappings) {
    if (typeof mappings !== 'object' || mappings === null) {
      return false;
    }

    const validRiskLevels = new Set(['low', 'medium', 'high']);

    for (const [key, value] of Object.entries(mappings)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        return false;
      }
      if (!validRiskLevels.has(value.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets the risk level for a given classification.
   * @param {string} classification - The destination classification
   * @returns {string} Risk level ('low', 'medium', 'high')
   */
  getRiskLevel(classification) {
    return this.riskMappings[classification] || this.riskMappings['unclear'] || 'medium';
  }
}

module.exports = new SanitizationConfig();
