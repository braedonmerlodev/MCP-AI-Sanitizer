const Queue = require('better-queue');
const queueConfig = require('../config/queueConfig');
const processJob = require('../workers/jobWorker');
const JobStatus = require('../models/JobStatus');
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
   * @param {Object} options - Job options including priority
   * @returns {Promise<string>} - Job ID
   */
  async addJob(data, options = {}) {
    const jobId = Date.now().toString();
    const jobData = { data, options, id: jobId };

    // Create job status entry
    const jobStatus = new JobStatus({ jobId });
    await jobStatus.save();

    return new Promise((resolve, reject) => {
      const queueOptions = {};
      if (options.priority !== undefined) {
        queueOptions.priority = options.priority;
      }

      this.getQueue().push(jobData, queueOptions, (err) => {
        if (err) {
          logger.error('Failed to add job', { error: err.message, jobId });
          reject(err);
        } else {
          logger.info('Job added to queue', { jobId });
          resolve(jobId);
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
