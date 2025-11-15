/**
 * JobStatus model represents the status of jobs in the queue.
 * Provides tracking for job lifecycle.
 */
class JobStatus {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.jobId = data.jobId;
    this.status = data.status || 'queued'; // queued, processing, completed, failed
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.retryCount = data.retryCount || 0;
    this.errorMessage = data.errorMessage;
  }

  /**
   * Generates a unique ID for the job status entry
   * @returns {string} - Unique ID
   */
  generateId() {
    return `js_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Updates the status and updatedAt
   * @param {string} status - New status
   * @param {string} errorMessage - Error message if failed
   */
  updateStatus(status, errorMessage = null) {
    this.status = status;
    this.updatedAt = new Date().toISOString();
    if (errorMessage) {
      this.errorMessage = errorMessage;
    }
  }

  /**
   * Increments retry count
   */
  incrementRetry() {
    this.retryCount++;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Converts to plain object for storage/serialization
   * @returns {Object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      jobId: this.jobId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      retryCount: this.retryCount,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Creates JobStatus from plain object
   * @param {Object} obj - Plain object
   * @returns {JobStatus} - JobStatus instance
   */
  static fromObject(obj) {
    return new JobStatus(obj);
  }
}

module.exports = JobStatus;
