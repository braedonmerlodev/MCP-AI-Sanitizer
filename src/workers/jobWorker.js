const winston = require('winston');
const JobStatus = require('../models/JobStatus');

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
  const jobId = job.id;
  logger.info('Processing job', { jobId });

  try {
    // Update status to processing
    const jobStatus = await JobStatus.load(jobId);
    if (jobStatus) {
      await jobStatus.updateStatus('processing');
    }

    const ProxySanitizer = require('../components/proxy-sanitizer');
    const sanitizer = new ProxySanitizer();
    const result = await sanitizer.sanitize(job.data, job.options);

    // Update status to completed
    if (jobStatus) {
      await jobStatus.updateStatus('completed');
    }

    logger.info('Job processed successfully', { jobId });
    cb(null, result);
  } catch (error) {
    // Update status to failed
    try {
      const jobStatus = await JobStatus.load(jobId);
      if (jobStatus) {
        await jobStatus.updateStatus('failed', error.message);
      }
    } catch (statusError) {
      logger.error('Failed to update job status', { jobId, error: statusError.message });
    }

    logger.error('Job processing failed', { jobId, error: error.message });
    cb(error);
  }
}

module.exports = processJob;
