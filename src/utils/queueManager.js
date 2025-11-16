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
  static queue = null;

  getQueue() {
    if (!QueueManager.queue) {
      logger.info('Creating better-queue with promise mode', { config: queueConfig });
      QueueManager.queue = new Queue(processJob, queueConfig);
      logger.info('Queue created successfully');
    }
    return QueueManager.queue;
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

    const queueOptions = {};
    if (options.priority !== undefined) {
      queueOptions.priority = options.priority;
    }

    await this.getQueue().push(jobData, queueOptions);
    logger.info('Job added to queue', { jobId });
    return jobId;
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
