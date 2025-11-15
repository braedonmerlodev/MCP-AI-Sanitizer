const Queue = require('better-queue');
const queueConfig = require('../config/queueConfig');
const processJob = require('../workers/jobWorker');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * QueueManager handles job queue operations using better-queue with SQLite persistence.
 * Follows proxy pattern similar to ProxySanitizer.
 */
class QueueManager {
  constructor() {
    this.queue = null;
  }

  getQueue() {
    if (!this.queue) {
      this.queue = new Queue(processJob, queueConfig);
    }
    return this.queue;
  }

  /**
   * Adds a job to the queue.
   * @param {string} data - The data to process
   * @param {Object} options - Job options
   * @returns {Promise<string>} - Job ID
   */
  addJob(data, options = {}) {
    const jobData = { data, options, id: Date.now().toString() };

    return new Promise((resolve, reject) => {
      this.getQueue().push(jobData, (err) => {
        if (err) {
          logger.error('Failed to add job', { error: err.message });
          reject(err);
        } else {
          logger.info('Job added to queue', { jobId: jobData.id });
          resolve(jobData.id);
        }
      });
    });
  }

  /**
   * Gets queue statistics.
   * @returns {Object} - Queue stats
   */
  getStats() {
    return this.getQueue().getStats();
  }
}

module.exports = new QueueManager();
