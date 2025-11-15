const express = require('express');
const Joi = require('joi');
const JobStatus = require('../models/JobStatus');
const winston = require('winston');

const router = express.Router();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Validation schema for job ID
const jobIdSchema = Joi.object({
  taskId: Joi.string().pattern(/^\d+$/).required(),
});

/**
 * GET /api/jobs/{taskId}
 * Retrieves the status and result of an async job.
 */
router.get('/:taskId', async (req, res) => {
  const { error, value } = jobIdSchema.validate({ taskId: req.params.taskId });
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const jobStatus = await JobStatus.load(value.taskId);
    if (!jobStatus) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const response = {
      taskId: jobStatus.jobId,
      status: jobStatus.status,
      createdAt: jobStatus.createdAt,
      updatedAt: jobStatus.updatedAt,
    };

    if (jobStatus.status === 'completed' && jobStatus.result) {
      response.result = jobStatus.result;
      response.completedAt = jobStatus.updatedAt;
    } else if (jobStatus.status === 'failed') {
      response.error = jobStatus.errorMessage;
    } else if (jobStatus.status === 'processing') {
      response.estimatedTime = 'TBD'; // Could calculate based on job type
    }

    logger.info('Job status retrieved', { taskId: value.taskId, status: jobStatus.status });
    res.set('X-API-Version', '1.1');
    res.set('X-Async-Processing', 'true');
    res.json(response);
  } catch (err) {
    logger.error('Error retrieving job status', { taskId: value.taskId, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

module.exports = router;
