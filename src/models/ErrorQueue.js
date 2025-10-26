/**
 * ErrorQueue model represents records that failed validation and are queued for review.
 */
class ErrorQueue {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.dataId = data.dataId;
    this.errorType = data.errorType || 'unknown';
    this.errorDetails = data.errorDetails || {};
    this.retryCount = data.retryCount || 0;
    this.status = data.status || 'queued'; // queued, processing, resolved, abandoned
    this.queuedAt = data.queuedAt || new Date().toISOString();
    this.lastAttempt = data.lastAttempt;
    this.resolvedAt = data.resolvedAt;
    this.resolution = data.resolution;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Generates a unique ID for the error queue entry
   * @returns {string} - Unique ID
   */
  generateId() {
    return `eq_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Checks if the error can be retried
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {boolean} - True if can retry
   */
  canRetry(maxRetries = 3) {
    return this.retryCount < maxRetries && this.status === 'queued';
  }

  /**
   * Increments retry count
   */
  incrementRetry() {
    this.retryCount++;
    this.lastAttempt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Marks the error as resolved
   * @param {string} resolution - Resolution details
   */
  resolve(resolution = '') {
    this.status = 'resolved';
    this.resolution = resolution;
    this.resolvedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Marks the error as abandoned
   * @param {string} reason - Reason for abandonment
   */
  abandon(reason = '') {
    this.status = 'abandoned';
    this.resolution = reason;
    this.resolvedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Checks if the error is expired
   * @param {number} maxAgeHours - Maximum age in hours
   * @returns {boolean} - True if expired
   */
  isExpired(maxAgeHours = 24) {
    const queuedTime = new Date(this.queuedAt);
    const now = new Date();
    const ageHours = (now - queuedTime) / (1000 * 60 * 60);
    return ageHours > maxAgeHours;
  }

  /**
   * Gets error priority based on type
   * @returns {string} - Priority level
   */
  getPriority() {
    const priorities = {
      cryptographic: 'critical',
      atomic_operation: 'high',
      referential: 'high',
      schema: 'medium',
      null_value: 'low',
    };
    return priorities[this.errorType] || 'medium';
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
      errorType: this.errorType,
      errorDetails: this.errorDetails,
      retryCount: this.retryCount,
      status: this.status,
      queuedAt: this.queuedAt,
      lastAttempt: this.lastAttempt,
      resolvedAt: this.resolvedAt,
      resolution: this.resolution,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Creates ErrorQueue from plain object
   * @param {Object} obj - Plain object
   * @returns {ErrorQueue} - ErrorQueue instance
   */
  static fromObject(obj) {
    return new ErrorQueue(obj);
  }
}

module.exports = ErrorQueue;
