const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const pdfParse = require('pdf-parse');
const crypto = require('node:crypto');
const ProxySanitizer = require('../components/proxy-sanitizer');
const MarkdownConverter = require('../components/MarkdownConverter');
const PDFGenerator = require('../components/PDFGenerator');
const destinationTracking = require('../middleware/destination-tracking');
const accessValidationMiddleware = require('../middleware/AccessValidationMiddleware');
const responseValidationMiddleware = require('../middleware/response-validation');
const AccessControlEnforcer = require('../components/AccessControlEnforcer');
const AdminOverrideController = require('../controllers/AdminOverrideController');
const TrustTokenGenerator = require('../components/TrustTokenGenerator');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// Response validation middleware (non-blocking)
router.use(responseValidationMiddleware);

const proxySanitizer = new ProxySanitizer();
const markdownConverter = new MarkdownConverter();
const pdfGenerator = new PDFGenerator();
const adminOverrideController = new AdminOverrideController();
const accessControlEnforcer = new AccessControlEnforcer({
  adminOverrideController,
});

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

// Rate limiting for sanitization endpoints
const sanitizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 sanitization requests per windowMs
  message: 'Too many sanitization requests from this IP, please try again later.',
});

// Validation schemas
const sanitizeSchema = Joi.object({
  data: Joi.string().required(),
});

const pdfGenerationSchema = Joi.object({
  data: Joi.string().required(),
  trustToken: Joi.object().required(),
  metadata: Joi.object().optional(),
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

const sanitizeJsonSchema = Joi.object({
  content: Joi.string().required(),
  classification: Joi.string().optional(),
  trustToken: Joi.object().optional(),
});

const adminOverrideActivateSchema = Joi.object({
  duration: Joi.number().integer().min(60_000).max(3_600_000).optional(), // 1min to 1hr in ms
  justification: Joi.string().min(10).max(500).required(),
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
 * POST /api/sanitize/json
 * Sanitizes JSON content and returns sanitized data with trust token.
 * Supports reuse via trust token validation.
 */
router.post(
  '/sanitize/json',
  sanitizeLimiter,
  accessValidationMiddleware,
  destinationTracking,
  async (req, res) => {
    const startTime = process.hrtime.bigint();
    const { error, value } = sanitizeJsonSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    let tokenValidationTime = 0;

    try {
      // Check for trust token reuse
      if (value.trustToken) {
        const tokenStartTime = process.hrtime.bigint();
        const trustTokenGenerator = new TrustTokenGenerator();
        const validation = trustTokenGenerator.validateToken(value.trustToken);
        tokenValidationTime = Number(process.hrtime.bigint() - tokenStartTime) / 1e6; // ms

        if (validation.isValid) {
          // Verify content hash matches (content is already sanitized)
          const contentHash = crypto.createHash('sha256').update(value.content).digest('hex');
          if (contentHash === value.trustToken.contentHash) {
            // Reuse: return cached result
            const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;

            const metadata = {
              originalLength: value.content.length,
              sanitizedLength: value.content.length, // Same as content is already sanitized
              timestamp: new Date().toISOString(),
              reused: true,
              performance: {
                totalTimeMs: totalTime,
                tokenValidationTimeMs: tokenValidationTime,
                timeSavedMs: 50, // Estimated time saved vs full sanitization
              },
            };

            // Create comprehensive audit log for successful reuse
            const auditLog = new AuditLog({
              userId: req.user?.id || 'anonymous',
              action: 'trust_token_reuse_successful',
              resourceId: value.trustToken.contentHash,
              details: {
                contentHash,
                tokenValidationTimeMs: tokenValidationTime,
                totalTimeMs: totalTime,
                timeSavedMs: 50,
                originalLength: value.content.length,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId: req.session?.id,
              },
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              sessionId: req.session?.id,
            });

            logger.info('Trust token reuse successful', {
              contentHash,
              timestamp: metadata.timestamp,
              performance: metadata.performance,
              auditLogId: auditLog.id,
            });

            // Update global reuse statistics with enhanced metrics
            if (!globalThis.reuseStats) {
              globalThis.reuseStats = {
                hits: 0,
                totalRequests: 0,
                validationSuccessRate: 1,
                averageValidationTimeMs: 0,
                totalTimeSavedMs: 0,
                lastUpdated: new Date().toISOString(),
              };
            }
            globalThis.reuseStats.hits++;
            globalThis.reuseStats.totalRequests++;
            globalThis.reuseStats.validationSuccessRate =
              globalThis.reuseStats.hits / globalThis.reuseStats.totalRequests;
            globalThis.reuseStats.averageValidationTimeMs =
              (globalThis.reuseStats.averageValidationTimeMs + tokenValidationTime) / 2;
            globalThis.reuseStats.totalTimeSavedMs += 50;
            globalThis.reuseStats.lastUpdated = new Date().toISOString();

            return res.json({
              sanitizedContent: value.content,
              trustToken: value.trustToken,
              metadata,
            });
          } else {
            // Content hash mismatch - log as security event
            const auditLog = new AuditLog({
              userId: req.user?.id || 'anonymous',
              action: 'trust_token_validation_failed',
              resourceId: value.trustToken.contentHash,
              details: {
                error: 'content_hash_mismatch',
                providedHash: contentHash,
                tokenHash: value.trustToken.contentHash,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId: req.session?.id,
              },
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              sessionId: req.session?.id,
            });

            logger.warn('Trust token content hash mismatch', {
              providedHash: contentHash,
              tokenHash: value.trustToken.contentHash,
              auditLogId: auditLog.id,
            });

            // Update failure statistics
            if (!globalThis.reuseStats) globalThis.reuseStats = { validationFailures: 0 };
            globalThis.reuseStats.validationFailures =
              (globalThis.reuseStats.validationFailures || 0) + 1;
          }
        } else {
          // Token validation failed
          const auditLog = new AuditLog({
            userId: req.user?.id || 'anonymous',
            action: 'trust_token_validation_failed',
            resourceId: value.trustToken?.contentHash || 'unknown',
            details: {
              error: validation.error,
              tokenValidationTimeMs: tokenValidationTime,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              sessionId: req.session?.id,
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            sessionId: req.session?.id,
          });

          logger.warn('Invalid trust token provided', {
            error: validation.error,
            auditLogId: auditLog.id,
          });

          // Update failure statistics
          if (!globalThis.reuseStats) globalThis.reuseStats = { validationFailures: 0 };
          globalThis.reuseStats.validationFailures =
            (globalThis.reuseStats.validationFailures || 0) + 1;
        }
      }

      // Normal sanitization path
      const options = {
        classification: value.classification || req.destinationTracking.classification,
        generateTrustToken: true,
      };
      const result = await proxySanitizer.sanitize(value.content, options);

      const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
      const metadata = {
        originalLength: value.content.length,
        sanitizedLength: result.sanitizedData.length,
        timestamp: new Date().toISOString(),
        reused: false,
        performance: {
          totalTimeMs: totalTime,
          tokenValidationTimeMs: tokenValidationTime,
        },
      };

      // Create audit log for sanitization operation
      const auditLog = new AuditLog({
        userId: req.user?.id || 'anonymous',
        action: 'content_sanitization_completed',
        resourceId: result.trustToken?.contentHash || 'unknown',
        details: {
          originalLength: value.content.length,
          sanitizedLength: result.sanitizedData.length,
          totalTimeMs: totalTime,
          classification: value.classification || req.destinationTracking.classification,
          trustTokenGenerated: !!result.trustToken,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: req.session?.id,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id,
      });

      logger.info('Content sanitization completed', {
        contentHash: result.trustToken?.contentHash,
        totalTimeMs: totalTime,
        auditLogId: auditLog.id,
      });

      // Update global reuse statistics with enhanced tracking
      if (!globalThis.reuseStats) {
        globalThis.reuseStats = {
          hits: 0,
          totalRequests: 0,
          validationSuccessRate: 1,
          averageValidationTimeMs: 0,
          totalTimeSavedMs: 0,
          sanitizationCount: 0,
          averageSanitizationTimeMs: 0,
          lastUpdated: new Date().toISOString(),
        };
      }
      globalThis.reuseStats.totalRequests++;
      globalThis.reuseStats.sanitizationCount = (globalThis.reuseStats.sanitizationCount || 0) + 1;
      globalThis.reuseStats.averageSanitizationTimeMs =
        (globalThis.reuseStats.averageSanitizationTimeMs + totalTime) / 2;
      globalThis.reuseStats.lastUpdated = new Date().toISOString();

      res.json({
        sanitizedContent: result.sanitizedData,
        trustToken: result.trustToken,
        metadata,
      });
    } catch (err) {
      logger.error('JSON sanitization error', { error: err.message });
      res.status(500).json({ error: 'Sanitization failed' });
    }
  },
);

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
  accessValidationMiddleware,
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

      // Extract text and metadata from PDF
      let extractedText, metadata;
      try {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;

        // Extract comprehensive metadata
        metadata = {
          pages: pdfData.numpages,
          title: pdfData.info?.Title || null,
          author: pdfData.info?.Author || null,
          subject: pdfData.info?.Subject || null,
          creator: pdfData.info?.Creator || null,
          producer: pdfData.info?.Producer || null,
          creationDate: pdfData.info?.CreationDate || null,
          modificationDate: pdfData.info?.ModDate || null,
          encoding: 'utf8', // pdf-parse extracts text as UTF-8
        };
      } catch (pdfError) {
        logger.error('PDF text extraction failed', { error: pdfError.message });
        return res.status(400).json({ error: 'Failed to extract text from PDF' });
      }

      // Convert extracted text to Markdown format
      let markdownText;
      try {
        markdownText = markdownConverter.convert(extractedText);
      } catch (convertError) {
        logger.warn('Markdown conversion failed, using plain text', {
          error: convertError.message,
        });
        markdownText = extractedText; // Fallback to plain text
      }

      // Sanitize converted text and generate trust token
      let sanitizationResult;
      try {
        const options = {
          classification: 'llm', // Force LLM classification for PDF content processing
          generateTrustToken: true,
        };
        sanitizationResult = await proxySanitizer.sanitize(markdownText, options);
      } catch (sanitizeError) {
        logger.error('Text sanitization failed', { error: sanitizeError.message });
        return res.status(500).json({ error: 'Failed to sanitize extracted text' });
      }

      // Return enhanced response
      res.json({
        message: 'PDF uploaded and processed successfully',
        fileName: file.originalname,
        size: file.size,
        metadata: metadata,
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
 * POST /api/documents/generate-pdf
 * Generates a clean PDF from sanitized content with embedded trust token
 */
router.post('/documents/generate-pdf', accessValidationMiddleware, async (req, res) => {
  // Enforce access control
  const accessResult = accessControlEnforcer.enforce(req, 'strict');
  if (!accessResult.allowed) {
    logger.warn('Access denied for PDF generation', {
      reason: accessResult.error,
      code: accessResult.code,
      method: req.method,
      path: req.path,
    });
    return res.status(403).json({
      error: 'Access denied',
      message: accessResult.error,
      code: accessResult.code,
    });
  }

  const { error, value } = pdfGenerationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { data: sanitizedContent, trustToken, metadata } = value;

    if (!trustToken) {
      return res.status(400).json({ error: 'Trust token is required for PDF generation' });
    }

    logger.info('Starting PDF generation from sanitized content', {
      contentLength: sanitizedContent.length,
      hasTrustToken: !!trustToken,
    });

    // Generate PDF with embedded trust token
    const pdfBuffer = await pdfGenerator.generatePDF(sanitizedContent, trustToken, metadata || {});

    // Validate PDF quality
    const validation = pdfGenerator.validatePDF(pdfBuffer);
    if (!validation.isValid) {
      logger.error('PDF validation failed', { validation });
      return res.status(500).json({ error: 'Generated PDF failed validation' });
    }

    logger.info('PDF generation completed successfully', {
      pdfSize: pdfBuffer.length,
      validation: validation.quality,
    });

    // Return PDF with appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sanitized-document.pdf"');
    res.setHeader('X-Trust-Token-Status', 'embedded');
    res.setHeader('X-PDF-Validation', validation.quality);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('PDF generation error', { error: error.message });
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

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

/**
 * POST /api/admin/override/activate
 * Activates admin override for emergency access
 */
router.post('/admin/override/activate', (req, res) => {
  const { error, value } = adminOverrideActivateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  // Override original body with validated value
  req.body = value;
  adminOverrideController.activateOverride(req, res);
});

/**
 * DELETE /api/admin/override/:overrideId
 * Deactivates a specific admin override
 */
router.delete('/admin/override/:overrideId', (req, res) => {
  adminOverrideController.deactivateOverride(req, res);
});

/**
 * GET /api/admin/override/status
 * Gets current admin override status
 */
router.get('/admin/override/status', (req, res) => {
  adminOverrideController.getOverrideStatus(req, res);
});

/**
 * GET /api/monitoring/reuse-stats
 * Gets comprehensive reuse mechanism statistics and metrics
 */
router.get('/monitoring/reuse-stats', accessValidationMiddleware, (req, res) => {
  // Enforce access control - monitoring data requires strict access
  const accessResult = accessControlEnforcer.enforce(req, 'strict');
  if (!accessResult.allowed) {
    logger.warn('Access denied for reuse statistics', {
      reason: accessResult.error,
      code: accessResult.code,
      method: req.method,
      path: req.path,
    });
    return res.status(403).json({
      error: 'Access denied',
      message: accessResult.error,
      code: accessResult.code,
    });
  }

  // Initialize stats if not exists
  if (!globalThis.reuseStats) {
    globalThis.reuseStats = {
      hits: 0,
      totalRequests: 0,
      validationSuccessRate: 1,
      averageValidationTimeMs: 0,
      totalTimeSavedMs: 0,
      sanitizationCount: 0,
      averageSanitizationTimeMs: 0,
      validationFailures: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  const stats = globalThis.reuseStats;

  // Calculate additional metrics
  const cacheHitRate = stats.totalRequests > 0 ? (stats.hits / stats.totalRequests) * 100 : 0;
  const failureRate =
    stats.totalRequests > 0 ? ((stats.validationFailures || 0) / stats.totalRequests) * 100 : 0;
  const averageTimeSavedPerRequest = stats.hits > 0 ? stats.totalTimeSavedMs / stats.hits : 0;

  const monitoringData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalRequests: stats.totalRequests,
      cacheHits: stats.hits,
      cacheMisses: stats.totalRequests - stats.hits,
      sanitizationOperations: stats.sanitizationCount || 0,
      validationFailures: stats.validationFailures || 0,
    },
    performance: {
      cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
      failureRate: `${failureRate.toFixed(2)}%`,
      averageValidationTimeMs: stats.averageValidationTimeMs.toFixed(2),
      averageSanitizationTimeMs: stats.averageSanitizationTimeMs.toFixed(2),
      averageTimeSavedPerRequestMs: averageTimeSavedPerRequest.toFixed(2),
      totalTimeSavedMs: stats.totalTimeSavedMs,
    },
    health: {
      validationSuccessRate: `${((stats.validationSuccessRate || 1) * 100).toFixed(2)}%`,
      lastUpdated: stats.lastUpdated,
      status: cacheHitRate > 50 ? 'healthy' : cacheHitRate > 20 ? 'warning' : 'critical',
    },
    raw: stats,
  };

  // Create audit log for monitoring access
  const auditLog = new AuditLog({
    userId: req.user?.id || 'anonymous',
    action: 'reuse_statistics_accessed',
    resourceId: 'reuse-monitoring',
    details: {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id,
      cacheHitRate,
      totalRequests: stats.totalRequests,
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    sessionId: req.session?.id,
  });

  logger.info('Reuse statistics accessed', {
    cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
    totalRequests: stats.totalRequests,
    auditLogId: auditLog.id,
  });

  res.json(monitoringData);
});

module.exports = router;
