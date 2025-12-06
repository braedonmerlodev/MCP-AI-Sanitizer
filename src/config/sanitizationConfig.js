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

// Define final sanitization methods
SanitizationConfig.prototype.loadFinalSanitizationConfig = function () {
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
};

SanitizationConfig.prototype.validateFinalConfig = function (config) {
  const validated = { ...config };

  // Validate enabled
  if (typeof validated.enabled !== 'boolean') {
    console.warn('Invalid final sanitization enabled value, defaulting to true');
    validated.enabled = true;
  }

  // Validate defaultMode
  const validModes = ['standard', 'final'];
  if (!validModes.includes(validated.defaultMode)) {
    console.warn(`Invalid default mode '${validated.defaultMode}', defaulting to 'final'`);
    validated.defaultMode = 'final';
  }

  // Validate allowRuntimeOverride
  if (typeof validated.allowRuntimeOverride !== 'boolean') {
    console.warn('Invalid allowRuntimeOverride value, defaulting to true');
    validated.allowRuntimeOverride = true;
  }

  // Validate strictValidation
  if (typeof validated.strictValidation !== 'boolean') {
    console.warn('Invalid strictValidation value, defaulting to false');
    validated.strictValidation = false;
  }

  return validated;
};

SanitizationConfig.prototype.getFinalSanitizationConfig = function () {
  return { ...this.finalSanitization };
};

SanitizationConfig.prototype.updateFinalSanitizationConfig = function (newConfig) {
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
};

// Create instance and initialize
const configInstance = new SanitizationConfig();
configInstance.finalSanitization = configInstance.loadFinalSanitizationConfig();

module.exports = configInstance;
