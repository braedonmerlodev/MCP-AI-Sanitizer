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

      // Generate human-readable message based on status and progress
      let message;
      switch (jobStatus.status) {
        case 'queued': {
          message = 'Queued for processing...';
          break;
        }
        case 'processing': {
          message = jobStatus.currentStep
            ? `Processing: ${jobStatus.currentStep}...`
            : 'Processing...';
          break;
        }
        case 'completed': {
          message = 'Completed successfully';
          break;
        }
        case 'failed': {
          message = jobStatus.errorMessage || 'Processing failed';
          break;
        }
        case 'cancelled': {
          message = 'Job cancelled';
          break;
        }
        default: {
          message = 'Unknown status';
        }
      }

      const response = {
        taskId: jobStatus.jobId,
        status: jobStatus.status,
        progress: jobStatus.progress,
        message,
        createdAt: jobStatus.createdAt,
        updatedAt: jobStatus.updatedAt,
        expiresAt: jobStatus.expiresAt,
      };

      // Include result for completed jobs
      if (jobStatus.status === 'completed' && jobStatus.result) {
        response.result = jobStatus.result;
        response.completedAt = jobStatus.updatedAt;
      }

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
      logger.info('Loading job status for result', { taskId });
      const jobStatus = await JobStatus.load(taskId);
      if (!jobStatus) {
        logger.warn('Job status not found', { taskId });
        return res.status(404).json({
          error: 'Job not found',
          taskId,
        });
      }
      logger.info('Job status loaded', { taskId, status: jobStatus.status });

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
      let jobResult;
      let resultData;

      try {
        jobResult = await JobResult.load(taskId);
      } catch (loadError) {
        logger.warn('Error loading job result from cache', { taskId, error: loadError.message });
        jobResult = null;
      }

      if (jobResult && !jobResult.isExpired()) {
        resultData = jobResult.result;
        logger.info('Job result retrieved from cache', { taskId });
      } else if (jobStatus.result) {
        // Fallback to job status result and cache it
        resultData = jobStatus.result;
        try {
          jobResult = new JobResult({
            jobId: taskId,
            result: resultData,
          });
          await jobResult.save();
          logger.info('Job result cached', { taskId });
        } catch (cacheError) {
          logger.warn('Failed to cache job result', { taskId, error: cacheError.message });
        }
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

      let resultSize = 0;
      try {
        const str = JSON.stringify(resultData);
        resultSize = str ? str.length : 0;
      } catch (error) {
        resultSize = 0;
        // If result is circular, we can't send it as JSON, so set to a placeholder
        response.result = '[Circular structure detected]';
      }

      logger.info('Job result retrieved', {
        taskId,
        resultSize,
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
   * Cancels or deletes a job
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

      let action;
      if (jobStatus.status === 'queued' || jobStatus.status === 'processing') {
        // Cancel active jobs
        await jobStatus.cancel();
        action = 'cancelled';
      } else {
        // For completed, failed, or already cancelled jobs, treat as deletion
        // Mark as cancelled to indicate it's been removed
        jobStatus.status = 'cancelled';
        jobStatus.updatedAt = new Date().toISOString();
        await jobStatus.save();
        action = 'deleted';
      }

      // Also try to delete the job result if it exists
      try {
        const jobResult = await JobResult.load(taskId);
        if (jobResult) {
          // Note: JobResult doesn't have a delete method, so we just mark it as expired
          jobResult.expiresAt = new Date().toISOString();
          await jobResult.save();
        }
      } catch (resultError) {
        // Ignore errors when deleting job result
        logger.warn('Could not delete job result', { taskId, error: resultError.message });
      }

      logger.info(`Job ${action}`, { taskId, previousStatus: jobStatus.status });
      res.set('X-API-Version', '1.1');
      res.set('X-Async-Processing', 'true');
      res.json({
        taskId: jobStatus.jobId,
        status: 'cancelled',
        message: action === 'cancelled' ? 'Job cancelled successfully' : 'Job deleted successfully',
      });
    } catch (err) {
      logger.error('Error cancelling/deleting job', { taskId, error: err.message });
      res.status(500).json({ error: 'Failed to cancel/delete job' });
    }
  },
};

module.exports = JobStatusController;
