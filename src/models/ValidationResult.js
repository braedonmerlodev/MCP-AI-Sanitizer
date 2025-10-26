/**
 * ValidationResult model represents the outcome of data integrity validation checks.
 */
class ValidationResult {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.dataId = data.dataId;
    this.validationType = data.validationType || 'unknown';
    this.status = data.status || 'unknown'; // PASS, FAIL, WARNING
    this.details = data.details || {};
    this.hashReference = data.hashReference;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Generates a unique ID for the validation result
   * @returns {string} - Unique ID
   */
  generateId() {
    return `vr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Checks if the validation passed
   * @returns {boolean} - True if validation passed
   */
  isPassed() {
    return this.status === 'PASS';
  }

  /**
   * Checks if the validation failed
   * @returns {boolean} - True if validation failed
   */
  isFailed() {
    return this.status === 'FAIL';
  }

  /**
   * Gets validation errors
   * @returns {Array} - List of errors
   */
  getErrors() {
    return this.details.errors || [];
  }

  /**
   * Gets validation warnings
   * @returns {Array} - List of warnings
   */
  getWarnings() {
    return this.details.warnings || [];
  }

  /**
   * Converts to plain object for storage/serialization
   * @returns {Object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      dataId: this.dataId,
      validationType: this.validationType,
      status: this.status,
      details: this.details,
      hashReference: this.hashReference,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Creates ValidationResult from plain object
   * @param {Object} obj - Plain object
   * @returns {ValidationResult} - ValidationResult instance
   */
  static fromObject(obj) {
    return new ValidationResult(obj);
  }
}

module.exports = ValidationResult;
