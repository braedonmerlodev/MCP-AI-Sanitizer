const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Processes a job asynchronously.
 * @param {Object} job - The job data
 * @param {Function} cb - Callback to call when done
 */
async function processJob(job, cb) {
  logger.info('Processing job', { jobId: job.id });

  try {
    const ProxySanitizer = require('../components/proxy-sanitizer');
    const sanitizer = new ProxySanitizer();
    const result = await sanitizer.sanitize(job.data, job.options);

    logger.info('Job processed successfully', { jobId: job.id });
    cb(null, result);
  } catch (error) {
    logger.error('Job processing failed', { jobId: job.id, error: error.message });
    cb(error);
  }
}

module.exports = processJob;
