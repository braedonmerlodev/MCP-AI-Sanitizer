/**
 * JSON transformation utilities for smart sanitization
 */

/**
 * Recursively normalizes object keys to various case formats
 * @param {any} obj - The object to transform
 * @param {string|object} targetCase - 'camelCase', 'snake_case', 'kebab-case', 'PascalCase', or {delimiter: string}
 * @returns {any} - Transformed object
 */
function normalizeKeys(obj, targetCase) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => normalizeKeys(item, targetCase));

  const normalized = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let newKey = key;

      if (targetCase === 'camelCase') {
        // Convert snake_case/kebab-case to camelCase
        newKey = key.replaceAll(/[-_]([a-z])/g, (match, letter) => letter.toUpperCase());
      } else if (targetCase === 'snake_case') {
        // Convert camelCase/PascalCase/kebab-case to snake_case
        newKey = key
          .replaceAll(/([A-Z])/g, '_$1')
          .replaceAll(/-/g, '_')
          .toLowerCase();
      } else if (targetCase === 'kebab-case') {
        // Convert camelCase/PascalCase/snake_case to kebab-case
        newKey = key
          .replaceAll(/([A-Z])/g, '-$1')
          .replaceAll(/_/g, '-')
          .toLowerCase();
      } else if (targetCase === 'PascalCase') {
        // Convert other formats to PascalCase
        newKey = key.replaceAll(/[-_]([a-z])/g, (match, letter) => letter.toUpperCase());
        newKey = newKey.charAt(0).toUpperCase() + newKey.slice(1);
      } else if (typeof targetCase === 'object' && targetCase.delimiter) {
        // Custom delimiter support
        const delimiter = targetCase.delimiter;
        newKey = key
          .replaceAll(/([A-Z])/g, `${delimiter}$1`)
          .replaceAll(/_/g, delimiter)
          .replaceAll(/-/g, delimiter)
          .toLowerCase();
      }

      normalized[newKey] = normalizeKeys(obj[key], targetCase);
    }
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
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => removeFields(item, patterns, options));

  const filtered = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Check if key should be removed
      let shouldRemove = false;

      for (const pattern of patterns) {
        if (typeof pattern === 'string') {
          // Exact string match
          if (key === pattern) {
            shouldRemove = true;
            break;
          }
        } else if (pattern instanceof RegExp) {
          // Regex pattern match
          if (pattern.test(key)) {
            shouldRemove = true;
            break;
          }
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
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => coerceTypes(item, typeMap));

  const coerced = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let value = obj[key];

      // Apply type coercion if specified for this field
      if (typeMap[key]) {
        const targetType = typeMap[key];
        if (Array.isArray(value)) {
          // Handle arrays of values
          value = value.map((item) => coerceValue(item, targetType));
        } else {
          value = coerceValue(value, targetType);
        }
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

  switch (targetType) {
    case 'number':
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      }
      return typeof value === 'number' ? value : parseFloat(value) || value;

    case 'boolean':
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
        return value; // Keep original if not recognizable
      }
      return typeof value === 'boolean' ? value : Boolean(value);

    case 'date':
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toISOString();
      }
      return value instanceof Date ? value.toISOString() : value;

    case 'string':
      return String(value);

    default:
      return value;
  }
}

module.exports = {
  normalizeKeys,
  removeFields,
  coerceTypes,
};
