const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const pdfParse = require('pdf-parse');
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

const trustTokenValidateSchema = Joi.object({
  contentHash: Joi.string().required(),
  originalHash: Joi.string().required(),
  sanitizationVersion: Joi.string().required(),
  rulesApplied: Joi.array().items(Joi.string()).required(),
  timestamp: Joi.string().required(),
  expiresAt: Joi.string().required(),
  signature: Joi.string().required(),
});

/**
 * POST /api/sanitize
 * Sanitizes input data.
 */
router.post('/sanitize', destinationTracking, async (req, res) => {
  const { error, value } = sanitizeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const options = { classification: req.destinationTracking.classification };
    const sanitizedData = await proxySanitizer.sanitize(value.data, options);
    res.json({ sanitizedData });
  } catch {
    res.status(500).json({ error: 'Sanitization failed' });
  }
});

/**
 * POST /api/webhook/n8n
 * Handles n8n webhook requests with automatic sanitization.
 */
router.post('/webhook/n8n', destinationTracking, async (req, res) => {
  const { error, value } = n8nWebhookSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const options = { classification: req.destinationTracking.classification };
    const response = await proxySanitizer.handleN8nWebhook(value, options);
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

      // Extract text from PDF
      let extractedText;
      try {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
      } catch (pdfError) {
        logger.error('PDF text extraction failed', { error: pdfError.message });
        return res.status(400).json({ error: 'Failed to extract text from PDF' });
      }

      // Sanitize extracted text and generate trust token
      let sanitizationResult;
      try {
        const options = {
          classification: 'llm', // Force LLM classification for PDF content processing
          generateTrustToken: true,
        };
        sanitizationResult = await proxySanitizer.sanitize(extractedText, options);
      } catch (sanitizeError) {
        logger.error('Text sanitization failed', { error: sanitizeError.message });
        return res.status(500).json({ error: 'Failed to sanitize extracted text' });
      }

      // Return enhanced response
      res.json({
        message: 'PDF uploaded and processed successfully',
        fileName: file.originalname,
        size: file.size,
        status: 'processed',
        sanitizedContent: sanitizationResult.sanitizedData,
        trustToken: sanitizationResult.trustToken,
      });
    } catch (error) {
      logger.error('Upload error', { error: error.message });
      res.status(500).json({ error: 'File upload failed' });
    }
  },
);

/**
 * POST /api/trust-tokens/validate
 * Validates a trust token for authenticity and expiration
 */
router.post('/trust-tokens/validate', async (req, res) => {
  const { error, value } = trustTokenValidateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    // Import TrustTokenGenerator for validation
    const TrustTokenGenerator = require('../components/TrustTokenGenerator');
    const generator = new TrustTokenGenerator();

    const validation = generator.validateToken(value);

    if (validation.isValid) {
      res.json({
        valid: true,
        message: 'Trust token is valid',
      });
    } else {
      const statusCode = validation.error === 'Token has expired' ? 410 : 400;
      res.status(statusCode).json({
        valid: false,
        error: validation.error,
      });
    }
  } catch (error) {
    logger.error('Token validation error', { error: error.message });
    res.status(500).json({ error: 'Token validation failed' });
  }
});

module.exports = router;
