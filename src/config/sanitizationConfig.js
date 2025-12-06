const fs = require('node:fs');
const path = require('node:path');

/**
 * Configuration for sanitization risk mappings and final sanitization settings.
 * Maps destination classifications to risk levels and manages final sanitization configuration.
 */
class SanitizationConfig {
  constructor() {
    this.riskMappings = this.loadRiskMappings();
    this.finalSanitization = this.loadFinalSanitizationConfig();
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
   * Loads final sanitization configuration from environment variables.
   * @returns {Object} Final sanitization configuration
   */
  loadFinalSanitizationConfig() {
    const defaultConfig = {
      enabled: true,
      defaultMode: 'final',
      allowRuntimeOverride: true,
      strictValidation: false,
    };

    let config = null;

    // Try environment variable first
    const envConfig = process.env.SANITIZATION_FINAL_CONFIG;
    if (envConfig) {
      try {
        config = JSON.parse(envConfig);
      } catch (error) {
        console.warn('Invalid SANITIZATION_FINAL_CONFIG JSON, using defaults:', error.message);
      }
    }

    // Individual environment variables override
    const finalConfig = { ...defaultConfig, ...config };

    // Override with individual env vars if set
    if (process.env.SANITIZATION_FINAL_MODE !== undefined) {
      finalConfig.enabled = process.env.SANITIZATION_FINAL_MODE !== 'false';
    }
    if (process.env.SANITIZATION_DEFAULT_MODE) {
      finalConfig.defaultMode = process.env.SANITIZATION_DEFAULT_MODE;
    }
    if (process.env.SANITIZATION_ALLOW_RUNTIME_OVERRIDE !== undefined) {
      finalConfig.allowRuntimeOverride = process.env.SANITIZATION_ALLOW_RUNTIME_OVERRIDE === 'true';
    }
    if (process.env.SANITIZATION_STRICT_VALIDATION !== undefined) {
      finalConfig.strictValidation = process.env.SANITIZATION_STRICT_VALIDATION === 'true';
    }

    return this.validateFinalConfig(finalConfig);
  }

  /**
   * Validates final sanitization configuration.
   * @param {Object} config - Configuration to validate
   * @param {boolean} strict - Whether to use strict validation (reject invalid values)
   * @returns {Object} Validated configuration
   * @throws {Error} If strict validation is enabled and config is invalid
   */
  validateFinalConfig(config, strict) {
    if (strict === undefined) strict = false;

    const validated = { ...config };
    const errors = [];

    // Validate enabled
    if (typeof validated.enabled !== 'boolean') {
      if (strict) {
        errors.push('enabled must be a boolean, got ' + typeof validated.enabled);
      } else {
        console.warn('Invalid final sanitization enabled value, defaulting to true');
        validated.enabled = true;
      }
    }

    // Validate defaultMode
    const validModes = ['standard', 'final'];
    if (!validModes.includes(validated.defaultMode)) {
      if (strict) {
        errors.push(
          'defaultMode must be one of ' +
            validModes.join(', ') +
            ", got '" +
            validated.defaultMode +
            "'",
        );
      } else {
        console.warn("Invalid default mode '" + validated.defaultMode + "', defaulting to 'final'");
        validated.defaultMode = 'final';
      }
    }

    // Validate allowRuntimeOverride
    if (typeof validated.allowRuntimeOverride !== 'boolean') {
      if (strict) {
        errors.push(
          'allowRuntimeOverride must be a boolean, got ' + typeof validated.allowRuntimeOverride,
        );
      } else {
        console.warn('Invalid allowRuntimeOverride value, defaulting to true');
        validated.allowRuntimeOverride = true;
      }
    }

    // Validate strictValidation
    if (typeof validated.strictValidation !== 'boolean') {
      if (strict) {
        errors.push('strictValidation must be a boolean, got ' + typeof validated.strictValidation);
      } else {
        console.warn('Invalid strictValidation value, defaulting to false');
        validated.strictValidation = false;
      }
    }

    // Throw errors if strict validation and we have errors
    if (strict && errors.length > 0) {
      throw new Error('Configuration validation failed: ' + errors.join(', '));
    }

    return validated;
  }

  /**
   * Gets the risk level for a given classification.
   * @param {string} classification - The destination classification
   * @returns {string} Risk level ('low', 'medium', 'high')
   */
  getRiskLevel(classification) {
    return this.riskMappings[classification] || this.riskMappings['unclear'] || 'medium';
  }

  /**
   * Gets the final sanitization configuration.
   * @returns {Object} Final sanitization config
   */
  getFinalSanitizationConfig() {
    return { ...this.finalSanitization };
  }

  /**
   * Updates final sanitization configuration at runtime.
   * @param {Object} newConfig - New configuration to apply
   * @returns {boolean} Success status
   */
  updateFinalSanitizationConfig(newConfig) {
    if (!this.finalSanitization.allowRuntimeOverride) {
      console.warn('Runtime configuration updates are disabled');
      return false;
    }

    try {
      const validatedConfig = this.validateFinalConfig({ ...this.finalSanitization, ...newConfig });
      this.finalSanitization = validatedConfig;
      console.info('Final sanitization configuration updated at runtime');
      return true;
    } catch (error) {
      console.error('Failed to update final sanitization configuration:', error.message);
      return false;
    }
  }
}

module.exports = new SanitizationConfig();
