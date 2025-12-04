const express = require('express');
const Joi = require('joi');
const JobStatusController = require('../controllers/jobStatusController');

const router = express.Router();

// Validation schema for job ID
const jobIdSchema = Joi.object({
  taskId: Joi.string()
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required(),
});

// Middleware to validate taskId parameter
const validateTaskId = (req, res, next) => {
  const { error, value } = jobIdSchema.validate({ taskId: req.params.taskId });
  if (error) {
    return res.status(400).json({ error: 'Invalid taskId format' });
  }
  req.taskId = value.taskId;
  next();
};

/**
 * GET /api/jobs/{taskId}/status
 * Retrieves the status and progress of an async job.
 */
router.get('/:taskId/status', validateTaskId, JobStatusController.getStatus);

/**
 * GET /api/jobs/{taskId}/result
 * Retrieves the result of a completed async job.
 */
router.get('/:taskId/result', validateTaskId, JobStatusController.getResult);

/**
 * DELETE /api/jobs/{taskId}
 * Cancels an async job if possible.
 */
router.delete('/:taskId', validateTaskId, JobStatusController.cancelJob);

/**
 * GET /api/jobs/{taskId}
 * Legacy endpoint - returns status for backward compatibility
 * @deprecated Use /api/jobs/{taskId}/status instead
 */
router.get('/:taskId', validateTaskId, JobStatusController.getStatus);

module.exports = router;
