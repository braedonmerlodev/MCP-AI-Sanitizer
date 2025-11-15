const express = require('express');
const Joi = require('joi');
const JobStatusController = require('../controllers/jobStatusController');

const router = express.Router();

// Validation schema for job ID
const jobIdSchema = Joi.object({
  taskId: Joi.string().pattern(/^\d+$/).required(),
});

// Middleware to validate taskId parameter
const validateTaskId = (req, res, next) => {
  const { error, value } = jobIdSchema.validate({ taskId: req.params.taskId });
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
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
 * Legacy endpoint - redirects to status for backward compatibility
 * @deprecated Use /api/jobs/{taskId}/status instead
 */
router.get('/:taskId', validateTaskId, async (req, res) => {
  // For backward compatibility, redirect to the status endpoint
  res.redirect(301, `/api/jobs/${req.taskId}/status`);
});

module.exports = router;
