const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const ProxySanitizer = require('../components/proxy-sanitizer');
const destinationTracking = require('../middleware/destination-tracking');

const router = express.Router();
const proxySanitizer = new ProxySanitizer();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Multer configuration for file uploads
const storage = multer.memoryStorage(); // Store files in memory for processing
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file extension and MIME type
    if (file.originalname.toLowerCase().endsWith('.pdf') && file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Rate limiting for upload endpoint
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: 'Too many uploads from this IP, please try again later.',
});

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
  } catch {
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
  } catch {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/documents/upload
 * Uploads and validates PDF documents.
 */
router.post(
  '/documents/upload',
  destinationTracking,
  uploadLimiter,
  (req, res, next) => {
    // Handle multer errors
    upload.single('pdf')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 25MB.' });
        }
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      // No multer errors, proceed to validation
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.file;

      // Additional validation using magic bytes (PDF files start with %PDF-)
      const buffer = file.buffer;
      if (buffer.length < 5 || !buffer.slice(0, 5).equals(Buffer.from('%PDF-'))) {
        return res.status(400).json({ error: 'Invalid file type. Only PDF files are allowed.' });
      }

      // File is valid, return success response
      res.json({
        message: 'PDF uploaded successfully',
        fileName: file.originalname,
        size: file.size,
        status: 'uploaded',
      });
    } catch (error) {
      logger.error('Upload error', { error: error.message });
      res.status(500).json({ error: 'File upload failed' });
    }
  },
);

module.exports = router;
