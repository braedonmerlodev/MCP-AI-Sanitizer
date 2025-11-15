const queueManager = require('../utils/queueManager');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * AsyncSanitizationController handles asynchronous sanitization job submissions.
 * Provides centralized logic for submitting jobs and managing async processing.
 */
class AsyncSanitizationController {
  /**
   * Submits a sanitization job to the queue.
   * @param {string} content - Content to sanitize
   * @param {Object} options - Sanitization options
   * @returns {Promise<string>} - Job ID
   */
  async submitSanitizationJob(content, options = {}) {
    try {
      const jobData = content;
      const jobOptions = {
        classification: options.classification || 'llm',
        generateTrustToken: true,
        ...options,
      };

      const taskId = await queueManager.addJob(jobData, jobOptions);
      logger.info('Async sanitization job submitted', { taskId, contentLength: content.length });
      return taskId;
    } catch (error) {
      logger.error('Failed to submit async sanitization job', { error: error.message });
      throw error;
    }
  }

  /**
   * Submits a PDF upload job to the queue.
   * @param {Buffer} fileBuffer - PDF file buffer
   * @param {string} fileName - Original file name
   * @param {Object} options - Processing options
   * @returns {Promise<string>} - Job ID
   */
  async submitPDFUploadJob(fileBuffer, fileName, options = {}) {
    try {
      const jobData = {
        type: 'upload-pdf',
        fileBuffer: fileBuffer.toString('base64'),
        fileName,
      };
      const jobOptions = {
        classification: 'llm',
        generateTrustToken: true,
        ...options,
      };

      const taskId = await queueManager.addJob(jobData, jobOptions);
      logger.info('Async PDF upload job submitted', {
        taskId,
        fileSize: fileBuffer.length,
        fileName,
      });
      return taskId;
    } catch (error) {
      logger.error('Failed to submit async PDF upload job', { error: error.message });
      throw error;
    }
  }

  /**
   * Checks if a request should be processed asynchronously.
   * @param {Object} criteria - Criteria to check
   * @returns {boolean} - True if async processing is needed
   */
  shouldProcessAsync(criteria) {
    const { fileSize, processingTime, forceAsync } = criteria;

    // Force async if explicitly requested
    if (forceAsync) return true;

    // File size threshold
    if (fileSize && fileSize > 10485760) return true; // 10MB

    // Processing time threshold (if available)
    if (processingTime && processingTime > 5000) return true; // 5 seconds

    return false;
  }
}

module.exports = AsyncSanitizationController;
