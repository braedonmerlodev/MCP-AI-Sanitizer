/**
 * JSON transformation utilities for smart sanitization
 */

// Simple LRU cache for transformation results
const transformationCache = new Map();
const MAX_CACHE_SIZE = 100;

/**
 * Cache key generator for transformation results
 */
function getCacheKey(obj, operation, params) {
  // Simple cache key - in production, you'd want a more sophisticated approach
  return `${operation}_${JSON.stringify(params)}_${JSON.stringify(obj).length}`;
}

/**
 * Cache management - remove oldest entries when cache is full
 */
function manageCache() {
  if (transformationCache.size > MAX_CACHE_SIZE) {
    const firstKey = transformationCache.keys().next().value;
    transformationCache.delete(firstKey);
  }
}

// Pre-compiled RegExp patterns for better performance
const REGEX_PATTERNS = {
  camelCase: /[-_]([a-z])/g,
  snakeCase: /([A-Z])/g,
  kebabCase: /([A-Z])/g,
  pascalCase: /[-_]([a-z])/g,
  customDelimiter: /([A-Z])/g,
};

/**
 * Recursively normalizes object keys to various case formats
 * @param {any} obj - The object to transform
 * @param {string|object} targetCase - 'camelCase', 'snake_case', 'kebab-case', 'PascalCase', or {delimiter: string}
 * @param {object} options - Performance and caching options
 * @returns {any} - Transformed object
 */
function normalizeKeys(obj, targetCase, options = {}) {
  // Input validation
  if (targetCase === undefined || targetCase === null) {
    throw new TypeError('normalizeKeys: targetCase parameter is required');
  }

  if (
    typeof targetCase === 'object' &&
    (!targetCase.delimiter || typeof targetCase.delimiter !== 'string')
  ) {
    throw new TypeError('normalizeKeys: custom delimiter must be a non-empty string');
  }

  if (
    typeof targetCase === 'string' &&
    !['camelCase', 'snake_case', 'kebab-case', 'PascalCase'].includes(targetCase)
  ) {
    throw new Error(
      `normalizeKeys: unsupported targetCase '${targetCase}'. Supported: camelCase, snake_case, kebab-case, PascalCase, or {delimiter: string}`,
    );
  }
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => normalizeKeys(item, targetCase, options));

  // Check cache if enabled
  if (options.useCache) {
    const cacheKey = getCacheKey(obj, 'normalizeKeys', { targetCase });
    if (transformationCache.has(cacheKey)) {
      return transformationCache.get(cacheKey);
    }
  }

  const normalized = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let newKey = key;

      switch (targetCase) {
        case 'camelCase': {
          // Convert snake_case/kebab-case to camelCase
          newKey = key.replaceAll(REGEX_PATTERNS.camelCase, (match, letter) =>
            letter.toUpperCase(),
          );
          break;
        }
        case 'snake_case': {
          // Convert camelCase/PascalCase/kebab-case to snake_case
          newKey = key
            .replaceAll(REGEX_PATTERNS.snakeCase, '_$1')
            .replaceAll('-', '_')
            .toLowerCase();
          break;
        }
        case 'kebab-case': {
          // Convert camelCase/PascalCase/snake_case to kebab-case
          newKey = key
            .replaceAll(REGEX_PATTERNS.kebabCase, '-$1')
            .replaceAll('_', '-')
            .toLowerCase();
          break;
        }
        case 'PascalCase': {
          // Convert other formats to PascalCase
          newKey = key.replaceAll(REGEX_PATTERNS.pascalCase, (match, letter) =>
            letter.toUpperCase(),
          );
          newKey = newKey.charAt(0).toUpperCase() + newKey.slice(1);
          break;
        }
        default: {
          if (typeof targetCase === 'object' && targetCase.delimiter) {
            // Custom delimiter support
            const delimiter = targetCase.delimiter;
            newKey = key
              .replaceAll(REGEX_PATTERNS.customDelimiter, `${delimiter}$1`)
              .replaceAll('_', delimiter)
              .replaceAll('-', delimiter)
              .toLowerCase();
          }
          break;
        }
      }

      normalized[newKey] = normalizeKeys(obj[key], targetCase, options);
    }
  }

  // Cache result if enabled
  if (options.useCache) {
    const cacheKey = getCacheKey(obj, 'normalizeKeys', { targetCase });
    transformationCache.set(cacheKey, normalized);
    manageCache();
  }

  return normalized;
}

/**
 * Recursively removes fields from object based on patterns
 * @param {any} obj - The object to transform
 * @param {string[]|RegExp[]} patterns - Array of field patterns to remove (exact match or regex)
 * @param {object} options - Additional filtering options
 * @returns {any} - Transformed object
 */
function removeFields(obj, patterns, options = {}) {
  // Input validation
  if (!Array.isArray(patterns)) {
    throw new TypeError('removeFields: patterns parameter must be an array');
  }

  for (const pattern of patterns) {
    if (typeof pattern !== 'string' && !(pattern instanceof RegExp)) {
      throw new TypeError('removeFields: all patterns must be strings or RegExp objects');
    }
  }

  // Convert string patterns that look like regex to RegExp objects
  const processedPatterns = patterns.map((pattern) => {
    if (typeof pattern === 'string' && pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
      // Looks like a regex string like "/pattern/flags"
      const lastSlash = pattern.lastIndexOf('/');
      const regexBody = pattern.slice(1, lastSlash);
      const flags = pattern.slice(lastSlash + 1);
      try {
        return new RegExp(regexBody, flags);
      } catch (e) {
        // If it's not a valid regex, treat as literal string
        return pattern;
      }
    }
    return pattern;
  });

  if (options.conditionalFilter && typeof options.conditionalFilter.condition !== 'function') {
    throw new Error('removeFields: conditionalFilter.condition must be a function');
  }
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => removeFields(item, patterns, options));

  const filtered = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Check if key should be removed
      let shouldRemove = false;

      for (const pattern of processedPatterns) {
        if (typeof pattern === 'string') {
          // Exact string match
          if (key === pattern) {
            shouldRemove = true;
            break;
          }
        } else if (
          pattern instanceof RegExp && // Regex pattern match
          pattern.test(key)
        ) {
          shouldRemove = true;
          break;
        }
      }

      // Conditional filtering based on value
      if (!shouldRemove && options.conditionalFilter) {
        const { condition } = options.conditionalFilter;
        if (condition && typeof condition === 'function') {
          shouldRemove = condition(key, obj[key]);
        }
      }

      if (!shouldRemove) {
        filtered[key] = removeFields(obj[key], patterns, options);
      }
    }
  }
  return filtered;
}

/**
 * Recursively applies type coercion to object values
 * @param {any} obj - The object to transform
 * @param {object} typeMap - Mapping of field names to target types
 * @returns {any} - Transformed object with coerced types
 */
function coerceTypes(obj, typeMap) {
  // Input validation
  if (typeof typeMap !== 'object' || typeMap === null) {
    throw new Error('coerceTypes: typeMap parameter must be an object');
  }

  const validTypes = ['number', 'boolean', 'date', 'string'];
  for (const [field, type] of Object.entries(typeMap)) {
    if (!validTypes.includes(type)) {
      throw new Error(
        `coerceTypes: invalid type '${type}' for field '${field}'. Supported types: ${validTypes.join(', ')}`,
      );
    }
  }
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => coerceTypes(item, typeMap));

  const coerced = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let value = obj[key];

      // Apply type coercion if specified for this field
      if (typeMap[key]) {
        const targetType = typeMap[key];
        value = Array.isArray(value)
          ? value.map((item) => coerceValue(item, targetType))
          : coerceValue(value, targetType);
      }

      // Recursively process nested objects (but not arrays we've already handled)
      if (!Array.isArray(value) || !typeMap[key]) {
        value = coerceTypes(value, typeMap);
      }

      coerced[key] = value;
    }
  }
  return coerced;
}

/**
 * Coerces a single value to the specified type
 * @param {any} value - The value to coerce
 * @param {string} targetType - Target type ('number', 'boolean', 'date', 'string')
 * @returns {any} - Coerced value
 */
function coerceValue(value, targetType) {
  if (value === null || value === undefined) return value;

  try {
    switch (targetType) {
      case 'number': {
        if (typeof value === 'string') {
          const num = Number.parseFloat(value);
          if (Number.isNaN(num)) {
            throw new TypeError(`Cannot coerce '${value}' to number`);
          }
          return num;
        }
        if (typeof value === 'number') return value;
        const num = Number.parseFloat(value);
        return Number.isNaN(num) ? value : num;
      }

      case 'boolean': {
        if (typeof value === 'string') {
          const lower = value.toLowerCase().trim();
          if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') return true;
          if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') return false;
          throw new Error(
            `Cannot coerce '${value}' to boolean - use true/false, 1/0, yes/no, on/off`,
          );
        }
        return typeof value === 'boolean' ? value : Boolean(value);
      }

      case 'date': {
        if (typeof value === 'string') {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            throw new TypeError(`Cannot parse '${value}' as date`);
          }
          return date.toISOString();
        }
        return value instanceof Date ? value.toISOString() : value;
      }

      case 'string': {
        return String(value);
      }

      default: {
        return value;
      }
    }
  } catch (error) {
    // In strict mode, re-throw the error; otherwise, return original value
    if (globalThis.TRANSFORM_STRICT_MODE) {
      throw error;
    }
    console.warn(`Type coercion warning: ${error.message}`);
    return value;
  }
}

// Predefined transformation presets for common use cases
const TRANSFORMATION_PRESETS = {
  // AI Processing: Convert to snake_case, remove sensitive fields, coerce types
  aiProcessing: {
    normalizeKeys: 'snake_case',
    removeFields: [/password|token|secret|session/i],
    coerceTypes: {
      confidence_score: 'number',
      is_active_status: 'boolean',
      created_at: 'date',
      updated_at: 'date',
    },
  },

  // API Response: Convert to camelCase, clean up response data
  apiResponse: {
    normalizeKeys: 'camelCase',
    removeFields: ['_id', '__v', 'password', 'salt'],
    coerceTypes: {
      totalCount: 'number',
      isActive: 'boolean',
      createdAt: 'date',
    },
  },

  // Data Export: Convert to snake_case, ensure consistent types
  dataExport: {
    normalizeKeys: 'snake_case',
    removeFields: [],
    coerceTypes: {
      export_quantity: 'number',
      unit_price: 'number',
      is_available: 'boolean',
      export_date: 'date',
    },
  },

  // Database Storage: Convert to snake_case, prepare for storage
  databaseStorage: {
    normalizeKeys: 'snake_case',
    removeFields: ['tempId', 'clientOnlyField'],
    coerceTypes: {
      user_id: 'string',
      account_id: 'string',
      balance: 'number',
      is_verified: 'boolean',
      created_at: 'date',
      updated_at: 'date',
    },
  },
};

/**
 * Applies a predefined transformation preset
 * @param {any} obj - The object to transform
 * @param {string} presetName - Name of the preset to apply
 * @param {object} customOptions - Custom options to override preset
 * @returns {any} - Transformed object
 */
function applyPreset(obj, presetName, customOptions = {}) {
  const preset = TRANSFORMATION_PRESETS[presetName];
  if (!preset) {
    throw new Error(
      `Unknown preset '${presetName}'. Available presets: ${Object.keys(TRANSFORMATION_PRESETS).join(', ')}`,
    );
  }

  // Merge custom options with preset
  const options = { ...preset, ...customOptions };

  let result = obj;

  // Apply transformations in logical order: remove fields first, then normalize, then coerce
  if (options.removeFields) {
    result = removeFields(result, options.removeFields);
  }

  if (options.normalizeKeys) {
    result = normalizeKeys(result, options.normalizeKeys);
  }

  if (options.coerceTypes) {
    result = coerceTypes(result, options.coerceTypes);
  }

  return result;
}

/**
 * Validates a transformation preset configuration
 * @param {object} preset - The preset configuration to validate
 * @returns {boolean} - True if valid
 */
function validatePreset(preset) {
  try {
    if (typeof preset !== 'object' || preset === null) {
      throw new Error('Preset must be an object');
    }

    if (
      preset.normalizeKeys &&
      typeof preset.normalizeKeys !== 'string' &&
      (typeof preset.normalizeKeys !== 'object' || !preset.normalizeKeys.delimiter)
    ) {
      throw new Error('normalizeKeys must be a string or object with delimiter');
    }

    if (preset.removeFields && !Array.isArray(preset.removeFields)) {
      throw new Error('removeFields must be an array');
    }

    if (preset.coerceTypes && typeof preset.coerceTypes !== 'object') {
      throw new Error('coerceTypes must be an object');
    }

    return true;
  } catch (error) {
    console.error('Preset validation error:', error.message);
    return false;
  }
}

/**
 * Creates a transformation chain for fluent API
 * @param {any} initialData - The initial data to transform
 * @returns {Object} - Chainable transformation object
 */
function createChain(initialData) {
  let data = initialData;

  return {
    normalizeKeys: (targetCase, options) => {
      data = normalizeKeys(data, targetCase, options);
      return createChain(data);
    },

    removeFields: (patterns, options) => {
      data = removeFields(data, patterns, options);
      return createChain(data);
    },

    coerceTypes: (typeMap) => {
      data = coerceTypes(data, typeMap);
      return createChain(data);
    },

    applyPreset: (presetName, customOptions) => {
      data = applyPreset(data, presetName, customOptions);
      return createChain(data);
    },

    value: () => data,

    validate: () => {
      // Basic validation - can be extended
      if (typeof data !== 'object' || data === null) {
        throw new Error('Validation failed: data must be an object');
      }
      return createChain(data);
    },
  };
}

module.exports = {
  normalizeKeys,
  removeFields,
  coerceTypes,
  applyPreset,
  validatePreset,
  TRANSFORMATION_PRESETS,
  createChain,
};
