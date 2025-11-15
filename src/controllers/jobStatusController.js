const JobStatus = require('../models/JobStatus');
const JobResult = require('../models/JobResult');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Job Status Controller
 * Handles job status checking and result retrieval endpoints
 */
const JobStatusController = {
  /**
   * GET /api/jobs/{taskId}/status
   * Returns job status and progress information
   */
  getStatus: async (req, res) => {
    const { taskId } = req.params;

    try {
      const jobStatus = await JobStatus.load(taskId);
      if (!jobStatus) {
        return res.status(404).json({
          error: 'Job not found',
          taskId,
        });
      }

      // Check if job has expired
      if (jobStatus.isExpired()) {
        return res.status(410).json({
          error: 'Job has expired',
          taskId,
          expiredAt: jobStatus.expiresAt,
        });
      }

      const response = {
        taskId: jobStatus.jobId,
        status: jobStatus.status,
        progress: jobStatus.progress,
        currentStep: jobStatus.currentStep,
        totalSteps: jobStatus.totalSteps,
        createdAt: jobStatus.createdAt,
        updatedAt: jobStatus.updatedAt,
        expiresAt: jobStatus.expiresAt,
      };

      // Add estimated completion time for processing jobs
      if (jobStatus.status === 'processing' && jobStatus.progress > 0) {
        const elapsed = Date.now() - new Date(jobStatus.createdAt).getTime();
        const estimatedTotal = elapsed / (jobStatus.progress / 100);
        const remaining = estimatedTotal - elapsed;
        response.estimatedCompletion = new Date(Date.now() + remaining).toISOString();
      }

      logger.info('Job status retrieved', {
        taskId,
        status: jobStatus.status,
        progress: jobStatus.progress,
      });
      res.set('X-API-Version', '1.1');
      res.set('X-Async-Processing', 'true');
      res.json(response);
    } catch (err) {
      logger.error('Error retrieving job status', { taskId, error: err.message });
      res.status(500).json({ error: 'Failed to retrieve job status' });
    }
  },

  /**
   * GET /api/jobs/{taskId}/result
   * Returns job results when complete
   */
  getResult: async (req, res) => {
    const { taskId } = req.params;

    try {
      const jobStatus = await JobStatus.load(taskId);
      if (!jobStatus) {
        return res.status(404).json({
          error: 'Job not found',
          taskId,
        });
      }

      // Check if job has expired
      if (jobStatus.isExpired()) {
        return res.status(410).json({
          error: 'Job has expired',
          taskId,
          expiredAt: jobStatus.expiresAt,
        });
      }

      // Only return results for completed jobs
      if (jobStatus.status !== 'completed') {
        return res.status(409).json({
          error: 'Job not completed',
          taskId,
          status: jobStatus.status,
          progress: jobStatus.progress,
        });
      }

      // Try to get result from cache first
      let jobResult = await JobResult.load(taskId);
      let resultData;

      if (jobResult && !jobResult.isExpired()) {
        resultData = jobResult.result;
        logger.info('Job result retrieved from cache', { taskId });
      } else if (jobStatus.result) {
        // Fallback to job status result and cache it
        resultData = jobStatus.result;
        jobResult = new JobResult({
          jobId: taskId,
          result: resultData,
        });
        await jobResult.save();
        logger.info('Job result cached', { taskId });
      } else {
        return res.status(404).json({
          error: 'No result available',
          taskId,
        });
      }

      const response = {
        taskId: jobStatus.jobId,
        status: jobStatus.status,
        result: resultData,
        completedAt: jobStatus.updatedAt,
        processingTime: new Date(jobStatus.updatedAt) - new Date(jobStatus.createdAt),
      };

      logger.info('Job result retrieved', {
        taskId,
        resultSize: JSON.stringify(jobStatus.result).length,
      });
      res.set('X-API-Version', '1.1');
      res.set('X-Async-Processing', 'true');
      res.json(response);
    } catch (err) {
      logger.error('Error retrieving job result', { taskId, error: err.message });
      res.status(500).json({ error: 'Failed to retrieve job result' });
    }
  },

  /**
   * DELETE /api/jobs/{taskId}
   * Cancels a job if possible
   */
  cancelJob: async (req, res) => {
    const { taskId } = req.params;

    try {
      const jobStatus = await JobStatus.load(taskId);
      if (!jobStatus) {
        return res.status(404).json({
          error: 'Job not found',
          taskId,
        });
      }

      // Check if job has expired
      if (jobStatus.isExpired()) {
        return res.status(410).json({
          error: 'Job has expired',
          taskId,
          expiredAt: jobStatus.expiresAt,
        });
      }

      // Only allow cancellation of queued or processing jobs
      if (jobStatus.status !== 'queued' && jobStatus.status !== 'processing') {
        return res.status(409).json({
          error: 'Job cannot be cancelled',
          taskId,
          status: jobStatus.status,
        });
      }

      await jobStatus.cancel();

      logger.info('Job cancelled', { taskId });
      res.set('X-API-Version', '1.1');
      res.set('X-Async-Processing', 'true');
      res.json({
        taskId: jobStatus.jobId,
        status: 'cancelled',
        cancelledAt: jobStatus.updatedAt,
      });
    } catch (err) {
      logger.error('Error cancelling job', { taskId, error: err.message });
      res.status(500).json({ error: 'Failed to cancel job' });
    }
  },
};

module.exports = JobStatusController;
