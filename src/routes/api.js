const express = require('express');
const Joi = require('joi');
const ProxySanitizer = require('../components/ProxySanitizer');

const router = express.Router();
const proxySanitizer = new ProxySanitizer();

// Validation schemas
const sanitizeSchema = Joi.object({
  data: Joi.string().required(),
});

const n8nWebhookSchema = Joi.object({
  data: Joi.string().required(),
  // Add other n8n payload fields as needed
});

/**
 * POST /api/sanitize
 * Sanitizes input data.
 */
router.post('/sanitize', (req, res) => {
  const { error, value } = sanitizeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const sanitizedData = proxySanitizer.sanitize(value.data);
    res.json({ sanitizedData });
  } catch (err) {
    res.status(500).json({ error: 'Sanitization failed' });
  }
});

/**
 * POST /api/webhook/n8n
 * Handles n8n webhook requests with automatic sanitization.
 */
router.post('/webhook/n8n', (req, res) => {
  const { error, value } = n8nWebhookSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const response = proxySanitizer.handleN8nWebhook(value);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
