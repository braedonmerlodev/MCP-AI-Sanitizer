/**
 * JSON transformation utilities for smart sanitization
 */

/**
 * Recursively normalizes object keys to camelCase or snake_case
 * @param {any} obj - The object to transform
 * @param {string} targetCase - 'camelCase' or 'snake_case'
 * @returns {any} - Transformed object
 */
function normalizeKeys(obj, targetCase) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => normalizeKeys(item, targetCase));

  const normalized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      let newKey = key;
      if (targetCase === 'camelCase') {
        newKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      } else if (targetCase === 'snake_case') {
        newKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      }
      normalized[newKey] = normalizeKeys(obj[key], targetCase);
    }
  }
  return normalized;
}

/**
 * Recursively removes fields from object based on patterns
 * @param {any} obj - The object to transform
 * @param {string[]} patterns - Array of field patterns to remove (exact match for now)
 * @returns {any} - Transformed object
 */
function removeFields(obj, patterns) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => removeFields(item, patterns));

  const filtered = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (!patterns.includes(key)) {
        filtered[key] = removeFields(obj[key], patterns);
      }
    }
  }
  return filtered;
}

module.exports = {
  normalizeKeys,
  removeFields,
};
