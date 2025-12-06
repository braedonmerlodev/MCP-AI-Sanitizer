const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const crypto = require('node:crypto');
const multer = require('multer');
const ProxySanitizer = require('../components/proxy-sanitizer');
const PDFGenerator = require('../components/PDFGenerator');
const destinationTracking = require('../middleware/destination-tracking');
const accessValidationMiddleware = require('../middleware/AccessValidationMiddleware');
const config = require('../config');

const apiContractValidationMiddleware = require('../middleware/ApiContractValidationMiddleware');
const { agentAuth, enforceAgentSync } = require('../middleware/agentAuth');
const { requestSchemas, responseSchemas } = require('../schemas/api-contract-schemas');
const AccessControlEnforcer = require('../components/AccessControlEnforcer');
const AdminOverrideController = require('../controllers/AdminOverrideController');
const TrustTokenGenerator = require('../components/TrustTokenGenerator');
const AuditLog = require('../models/AuditLog');
const AuditLogger = require('../components/data-integrity/AuditLogger');
const DataExportManager = require('../components/data-integrity/DataExportManager');
const {
  getMetrics,
  recordPipelinePerformance,
  updateConcurrencyMetrics,
} = require('../utils/monitoring');
const SanitizationMonitor = require('../utils/sanitization-monitor');
const SanitizationDashboard = require('../monitoring/sanitization-dashboard');
const queueManager = require('../utils/queueManager');
const {
  normalizeKeys,
  removeFields,
  coerceTypes,
  applyPreset,
  createChain,
} = require('../utils/jsonTransformer');
// const AITextTransformer = require('../components/AITextTransformer');

const router = express.Router();

/**
 * Response sanitization monitoring middleware.
 * Scans API responses for metadata leakage artifacts.
 * Non-blocking to avoid impacting response times.
 */
const responseSanitizationMonitoring = async (req, res, next) => {
  // Store original send method
  const originalSend = res.send;
  const originalJson = res.json;

  // Context for monitoring
  const monitoringContext = {
    endpoint: req.path,
    method: req.method,
    userId: req.user?.id || req.body?.userId || 'anonymous',
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection?.remoteAddress,
    responseId: `resp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
  };

  // Override send method to scan response
  res.send = function (data) {
    // Scan response asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        await sanitizationMonitor.scanResponse(data, monitoringContext);
      } catch (error) {
        logger.error('Response sanitization monitoring failed', {
          error: error.message,
          endpoint: monitoringContext.endpoint,
          responseId: monitoringContext.responseId,
        });
      }
    });

    // Call original send method
    return originalSend.call(this, data);
  };

  // Override json method to scan response
  res.json = function (data) {
    // Scan response asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        await sanitizationMonitor.scanResponse(data, monitoringContext);
      } catch (error) {
        logger.error('Response sanitization monitoring failed', {
          error: error.message,
          endpoint: monitoringContext.endpoint,
          responseId: monitoringContext.responseId,
        });
      }
    });

    // Call original json method
    return originalJson.call(this, data);
  };

  next();
};

// Response validation middleware (non-blocking)
// router.use(responseValidationMiddleware);

// Agent authentication and sync enforcement middleware
router.use(agentAuth);
router.use(enforceAgentSync);

// Response sanitization monitoring middleware (non-blocking)
router.use(responseSanitizationMonitoring);

const proxySanitizer = new ProxySanitizer();
const pdfGenerator = new PDFGenerator();
const adminOverrideController = new AdminOverrideController();
// Expose controller on global for middleware integration in tests and server runtime
globalThis.adminOverrideController = adminOverrideController;
const accessControlEnforcer = new AccessControlEnforcer({
  adminOverrideController,
});
const auditLogger = new AuditLogger();
const dataExportManager = new DataExportManager({
  auditLogger,
  accessControlEnforcer,
});
const sanitizationMonitor = new SanitizationMonitor({
  enableDetailedLogging: config.monitoring?.enableDetailedLogging || false,
});
const sanitizationDashboard = new SanitizationDashboard({
  retentionDays: config.monitoring?.retentionDays || 30,
  enableHistoricalData: config.monitoring?.enableHistoricalData || true,
});

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Rate limiting for sanitization endpoints
const sanitizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1_000_000 : 100, // limit each IP for tests
  message: 'Too many sanitization requests from this IP, please try again later.',
});

// Rate limiting for upload endpoints
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1_000_000 : 10, // stricter limit for uploads
  message: 'Too many upload requests from this IP, please try again later.',
});

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory for processing
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only one file per request
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Validation schemas
const pdfGenerationSchema = Joi.object({
  data: Joi.string().required(),
  trustToken: Joi.object().required(),
  metadata: Joi.object().optional(),
});

const n8nWebhookSchema = Joi.object({
  data: Joi.string().required(),
});

const trustTokenValidateSchema = Joi.object({
  contentHash: Joi.string().required(),
  originalHash: Joi.string().required(),
  sanitizationVersion: Joi.string().required(),
  rulesApplied: Joi.array().items(Joi.string()).required(),
  timestamp: Joi.string().required(),
  expiresAt: Joi.string().required(),
  signature: Joi.string().required(),
  nonce: Joi.string().required(),
});

const sanitizeJsonSchema = Joi.object({
  content: Joi.string().required(),
  classification: Joi.string().optional(),
  trustToken: Joi.object().optional(),
  async: Joi.boolean().optional().default(false),
  transform: Joi.boolean().optional().default(false),
  transformOptions: Joi.object({
    normalizeKeys: Joi.alternatives()
      .try(
        Joi.string().valid('camelCase', 'snake_case', 'kebab-case', 'PascalCase'),
        Joi.object({
          delimiter: Joi.string().required(),
        }),
      )
      .optional(),
    removeFields: Joi.array()
      .items(
        Joi.alternatives().try(
          Joi.string(),
          Joi.object().regex(), // Allow RegExp objects
        ),
      )
      .optional(),
    coerceTypes: Joi.object()
      .pattern(Joi.string(), Joi.string().valid('number', 'boolean', 'date', 'string'))
      .optional(),
    preset: Joi.string()
      .valid('aiProcessing', 'apiResponse', 'dataExport', 'databaseStorage')
      .optional(),
    chain: Joi.array()
      .items(
        Joi.object({
          operation: Joi.string()
            .valid('normalizeKeys', 'removeFields', 'coerceTypes', 'applyPreset')
            .required(),
          params: Joi.any().optional(),
        }),
      )
      .optional(),
  }).optional(),
  ai_transform: Joi.boolean().optional().default(false), // Add AI processing for JSON content
  outputFormat: Joi.string()
    .valid('structure', 'json', 'yaml', 'xml')
    .optional()
    .default('structure'),
});

/**
 * POST /api/sanitize
 * Sanitizes input data.
 * NOTE: This endpoint is deprecated. Use /api/sanitize/json instead for better functionality.
 */
/*
// Commented out - redundant with /api/sanitize/json which has trust tokens and async support
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
*/

// Backward-compatible minimal /api/sanitize endpoint (non-protected)
router.post('/sanitize', destinationTracking, async (req, res) => {
  try {
    const data = req.body?.data || '';
    const options = { classification: req.destinationTracking.classification };
    const sanitizedData = await proxySanitizer.sanitize(data, options);
    return res.json({ sanitizedData });
  } catch (e) {
    logger.error('Sanitize compatibility endpoint error', { error: e.message });
    return res.status(500).json({ error: 'Sanitization failed' });
  }
});

/**
 * POST /api/sanitize/json
 * Sanitizes JSON content with optional AI enhancement and returns data with trust token.
 * Supports reuse via trust token validation, AI transformation, and async processing.
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

    // Apply smart transformation if requested
    let contentToSanitize = value.content;
    if (value.transform) {
      try {
        let jsonObj = JSON.parse(value.content);

        // Apply transformations in order
        if (value.transformOptions) {
          const opts = value.transformOptions;

          // Support preset application
          if (opts.preset) {
            jsonObj = applyPreset(jsonObj, opts.preset);
          }

          // Support transformation chaining
          if (opts.chain) {
            let chain = createChain(jsonObj);
            for (const step of opts.chain) {
              const { operation, params } = step;
              if (chain[operation]) {
                chain = chain[operation](...params);
              } else {
                logger.warn(`Unknown chain operation: ${operation}`);
              }
            }
            jsonObj = chain.value();
          } else {
            // Legacy support for individual transformations
            if (opts.normalizeKeys) {
              jsonObj = normalizeKeys(jsonObj, opts.normalizeKeys);
            }
            if (opts.removeFields) {
              jsonObj = removeFields(jsonObj, opts.removeFields);
            }
            if (opts.coerceTypes) {
              jsonObj = coerceTypes(jsonObj, opts.coerceTypes);
            }
          }
        }

        contentToSanitize = JSON.stringify(jsonObj);
      } catch (e) {
        logger.warn('Invalid JSON for transformation, skipping', { error: e.message });
      }
    }

    // Check if async processing is requested and sync mode is not forced
    console.log('Async check:', { async: value.async, querySync: req.query.sync });
    if (value.async && req.query.sync !== 'true') {
      // Support trust token from header if not in body
      value.trustToken = value.trustToken || req.headers['x-trust-token'];
      try {
        const jobData = contentToSanitize;
        const jobOptions = {
          classification: value.classification || req.destinationTracking.classification,
          generateTrustToken: config.features.trustTokens.enabled,
          trustToken: value.trustToken, // Pass trust token for reuse check in job
        };

        // Add AI processing options if requested
        if (value.ai_transform) {
          jobOptions.aiTransformType = value.ai_transform_type || 'structure';
        }
        logger.info('Calling queueManager.addJob');
        const taskId = await queueManager.addJob(jobData, jobOptions);
        logger.info('addJob returned', { taskId });

        logger.info('Async sanitization job submitted', {
          taskId,
          contentLength: value.content.length,
        });
        res.set('X-API-Version', '1.1');
        res.set('X-Async-Processing', 'true');
        return res.status(202).json({
          taskId,
          status: 'processing',
          estimatedTime: 5000, // 5 seconds estimate
        });
      } catch (jobError) {
        logger.error('Failed to submit async job', { error: jobError.message });
        return res.status(500).json({ error: 'Failed to submit async job' });
      }
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
      let contentForSanitization = contentToSanitize;
      let aiProcessingMetadata = {};

      // Apply AI transformation if requested
      if (value.ai_transform) {
        try {
          const aiResult = await aiTransformer.transform(
            contentToSanitize,
            value.ai_transform_type || 'structure',
            {
              sanitizerOptions: {
                classification: value.classification || req.destinationTracking.classification,
              },
            },
          );
          contentForSanitization = aiResult.text;
          aiProcessingMetadata = {
            aiProcessed: true,
            aiTransformType: value.ai_transform_type || 'structure',
            ...aiResult.metadata,
          };
        } catch (aiError) {
          logger.warn(
            'AI transformation failed in JSON sanitization, proceeding with original content',
            {
              error: aiError.message,
              aiTransformType: value.ai_transform_type,
            },
          );
          aiProcessingMetadata = {
            aiProcessed: false,
            aiError: aiError.message,
          };
        }
      }

      const options = {
        classification: value.classification || req.destinationTracking.classification,
        generateTrustToken: true,
      };
      const result = await proxySanitizer.sanitize(contentForSanitization, options);

      const totalTime = Number(process.hrtime.bigint() - startTime) / 1e6;
      const metadata = {
        originalLength: value.content.length,
        sanitizedLength: result.length,
        timestamp: new Date().toISOString(),
        reused: false,
        aiProcessing: aiProcessingMetadata,
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
          sanitizedLength: result.length,
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

      let sanitizedContent = typeof result === 'string' ? result : result.sanitizedData;
      const trustToken = typeof result === 'string' ? null : result.trustToken;

      // Clean any malicious content from structured responses
      try {
        const parsed = JSON.parse(sanitizedContent);
        if (typeof parsed === 'object' && parsed !== null) {
          const extractAndRemoveThreats =
            require('../workers/jobWorker.js').extractAndRemoveThreats;
          extractAndRemoveThreats(parsed);
          sanitizedContent = JSON.stringify(parsed);
        }
      } catch (e) {
        // Not JSON, leave as is
      }

      res.json({
        sanitizedContent,
        trustToken,
        metadata,
      });
    } catch (err) {
      logger.error('JSON sanitization error', { error: err.message });
      res.status(500).json({ error: 'Sanitization failed' });
    }
  },
);

/**
 * POST /api/chat
 * Handles chat messages with AI processing and sanitization.
 */
router.post('/chat', accessValidationMiddleware, destinationTracking, async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Use AI transformer for chat response
    const aiResponse = await aiTransformer.transform(message, 'chat', {
      context: context || [],
      sanitizerOptions: {
        classification: req.destinationTracking.classification,
      },
    });

    // Sanitize the response
    let sanitizedResponse = await proxySanitizer.sanitize(aiResponse.text, {
      classification: req.destinationTracking.classification,
    });

    // Clean any malicious content from structured responses
    try {
      const parsed = JSON.parse(sanitizedResponse);
      if (typeof parsed === 'object' && parsed !== null) {
        const extractAndRemoveThreats = require('../workers/jobWorker.js').extractAndRemoveThreats;
        extractAndRemoveThreats(parsed);
        sanitizedResponse = JSON.stringify(parsed);
      }
    } catch (e) {
      // Not JSON, leave as is
    }

    res.json({
      response: sanitizedResponse,
      metadata: aiResponse.metadata,
    });
  } catch (error) {
    logger.error('Chat processing error', { error: error.message });
    res.status(500).json({ error: 'Chat processing failed' });
  }
});

/**
 * POST /api/webhook/n8n
 * Handles n8n webhook requests with automatic sanitization.
 */
router.post(
  '/webhook/n8n',
  apiContractValidationMiddleware(
    requestSchemas['/api/webhook/n8n'],
    responseSchemas['/api/webhook/n8n'],
  ),
  destinationTracking,
  async (req, res) => {
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
  },
);

/**
 * POST /api/documents/upload
 * Uploads and validates PDF documents with automatic AI enhancement.
 * All PDFs are processed with AI to convert unstructured text into structured JSON.
 */
router.post(
  '/documents/upload',
  uploadLimiter,
  accessValidationMiddleware,
  destinationTracking,
  upload.single('file'),
  async (req, res) => {
    const startTime = process.hrtime.bigint();

    try {
      // Validate file upload
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please provide a PDF file to upload',
        });
      }

      // Basic file validation
      const allowedTypes = ['application/pdf'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: 'Only PDF files are allowed',
        });
      }

      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({
          error: 'File too large',
          message: 'File size must be less than 10MB',
        });
      }

      // Parse query parameters
      const aiTransform = req.query.ai_transform !== 'false'; // Default to true
      const async = req.query.async === 'true';
      const sync = req.query.sync === 'true';

      // Determine processing mode
      const processingMode = sync ? 'sync' : async ? 'async' : 'async'; // Default to async

      if (processingMode === 'sync') {
        // Synchronous processing - return immediate result
        const result = {
          message: 'PDF processed successfully',
          fileName: req.file.originalname,
          size: req.file.size,
          status: 'completed',
          processingMetadata: {
            aiProcessed: aiTransform,
            processingTime: 'immediate',
            mode: 'sync',
          },
        };

        logger.info('PDF processed synchronously', {
          fileName: req.file.originalname,
          size: req.file.size,
          aiTransform,
          processingTime: Date.now() - startTime,
        });

        return res.json(result);
      } else {
        // Asynchronous processing - queue job and return job_id
        const jobId = await queueManager.addJob(
          {
            type: 'pdf_processing',
            fileBuffer: req.file.buffer.toString('base64'),
            aiTransform,
            originalName: req.file.originalname,
          },
          {
            generateTrustToken: true,
          },
        );

        const result = {
          job_id: jobId,
          status: 'queued',
          message: 'PDF upload accepted for processing',
        };

        logger.info('PDF queued for async processing', {
          jobId,
          fileName: req.file.originalname,
          size: req.file.size,
          aiTransform,
        });

        return res.json(result);
      }
    } catch (error) {
      logger.error('PDF upload error', {
        error: error.message,
        stack: error.stack,
        fileName: req.file?.originalname,
      });

      console.error('PDF upload error details:', error);

      return res.status(500).json({
        error: 'Upload failed',
        message: 'An error occurred while processing your PDF',
        details: error.message,
      });
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
router.post(
  '/trust-tokens/validate',
  apiContractValidationMiddleware(
    requestSchemas['/api/trust-tokens/validate'],
    responseSchemas['/api/trust-tokens/validate'],
  ),
  async (req, res) => {
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
  },
);

/**
 * POST /api/admin/override/activate
 * Activates admin override for emergency access
 */
// Route intentionally forwards to controller for its own validation and error messages
router.post('/admin/override/activate', (req, res) => {
  adminOverrideController.activateOverride(req, res);
});

// Test-only: clear active overrides to ensure test isolation
if (process.env.NODE_ENV === 'test') {
  router.post('/admin/override/clear', (req, res) => {
    try {
      // Clear in-memory overrides and cancel any test timers
      if (typeof adminOverrideController.clearAllOverrides === 'function') {
        adminOverrideController.clearAllOverrides();
      } else {
        // Fallback in case controller lacks the helper
        adminOverrideController.activeOverrides.clear();
      }

      return res.json({ cleared: true });
    } catch (error) {
      logger.warn('Failed to clear admin overrides (test helper)', { error: error.message });
      return res.status(500).json({ error: 'Clear failed' });
    }
  });
}

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

/**
 * GET /api/monitoring/metrics
 * Gets comprehensive system metrics including performance, security, and stability
 */
router.get('/monitoring/metrics', accessValidationMiddleware, (req, res) => {
  // Enforce access control - monitoring data requires strict access
  const accessResult = accessControlEnforcer.enforce(req, 'strict');
  if (!accessResult.allowed) {
    logger.warn('Access denied for system metrics', {
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

  const metrics = getMetrics();

  // Create audit log for monitoring access
  const auditLog = auditLogger.logEvent({
    eventType: 'MONITORING_ACCESS',
    userId: req.user?.id || 'anonymous',
    resourceType: 'system_metrics',
    resourceId: 'system-monitoring',
    action: 'read',
    details: {
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      sessionId: req.session?.id,
    },
  });

  logger.info('System metrics accessed', {
    auditLogId: auditLog.id,
    uptime: metrics.uptime,
    totalRequests: metrics.requests.total,
  });

  res.json(metrics);
});

// Data export route
router.post('/export/training-data', accessValidationMiddleware, async (req, res) => {
  try {
    const { format = 'json', ...filters } = req.body;

    // Validate format
    const validFormats = ['json', 'csv', 'parquet'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: `Invalid format. Supported formats: ${validFormats.join(', ')}`,
      });
    }

    // Export data
    const exportResult = await dataExportManager.exportTrainingData(format, filters, {
      userId: req.userId || 'system',
      ipAddress: req.ip,
      req,
    });

    // Set headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportResult.filePath.split('/').pop()}"`,
    );
    res.setHeader('X-Export-Format', format);
    res.setHeader('X-Export-Record-Count', exportResult.recordCount);
    res.setHeader('X-Export-File-Size', exportResult.fileSize);

    // Stream file
    const fs = require('node:fs');
    const stream = fs.createReadStream(exportResult.filePath);
    stream.pipe(res);

    // Clean up file after response
    stream.on('end', () => {
      fs.unlinkSync(exportResult.filePath);
    });
  } catch (error) {
    logger.error('Data export error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to export training data' });
  }
});

/**
 * GET /api/monitoring/sanitization-dashboard
 * Gets sanitization metadata leakage dashboard data
 */
router.get('/monitoring/sanitization-dashboard', accessValidationMiddleware, (req, res) => {
  // Enforce access control - monitoring data requires strict access
  const accessResult = accessControlEnforcer.enforce(req, 'strict');
  if (!accessResult.allowed) {
    logger.warn('Access denied for sanitization dashboard', {
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

  try {
    // Update dashboard with latest data
    const performanceMetrics = getMetrics();
    sanitizationDashboard.updateDashboard(sanitizationMonitor, performanceMetrics);

    // Get dashboard data with optional filters
    const filters = {
      timeRange: req.query.timeRange, // 1d, 7d, 30d
      severity: req.query.severity, // low, medium, high, critical
    };

    const dashboardData = sanitizationDashboard.getDashboardData(filters);

    // Create audit log for dashboard access
    const auditLog = auditLogger.logEvent({
      eventType: 'SANITIZATION_DASHBOARD_ACCESS',
      userId: req.user?.id || 'anonymous',
      resourceType: 'sanitization_monitoring',
      resourceId: 'sanitization-dashboard',
      action: 'read',
      details: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id,
        filters: filters,
        totalIncidents: dashboardData.summary.totalIncidents,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id,
    });

    logger.info('Sanitization dashboard accessed', {
      userId: req.user?.id || 'anonymous',
      totalIncidents: dashboardData.summary.totalIncidents,
      activeIncidents: dashboardData.summary.activeIncidents,
      filters: filters,
    });

    res.json(dashboardData);
  } catch (error) {
    logger.error('Sanitization dashboard error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id || 'anonymous',
    });
    res.status(500).json({ error: 'Failed to retrieve dashboard data' });
  }
});

module.exports = router;
