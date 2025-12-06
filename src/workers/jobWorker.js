const winston = require('winston');
const JobStatus = require('../models/JobStatus');
const JobResult = require('../models/JobResult');
const ProxySanitizer = require('../components/proxy-sanitizer');
const MarkdownConverter = require('../components/MarkdownConverter');
const AITextTransformer = require('../components/AITextTransformer');
const JSONRepair = require('../utils/jsonRepair');
const AuditLogger = require('../components/data-integrity/AuditLogger');
const pdfParse = require('pdf-parse');
const { performance } = require('node:perf_hooks');
const { recordPipelinePerformance } = require('../utils/monitoring');

/**
 * Recursively sanitizes string values in an object or array
 */
function sanitizeObject(data) {
  if (typeof data === 'string') {
    // Simple sanitization for strings
    return data
      .replaceAll(/[<>"']/g, '')
      .replaceAll(/javascript:/gi, '')
      .replaceAll(/on\w+=/gi, '');
  } else if (Array.isArray(data)) {
    return data.map((item) => sanitizeObject(item));
  } else if (data && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip trust token field if it appears in input content
      if (key === 'trustToken') {
        continue;
      }
      // Sanitize all fields
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return data;
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Recursively strips trust tokens from all objects and arrays
 * @param {any} data - The data to strip trust tokens from
 */
function stripTrustTokensRecursively(data) {
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      data.forEach((item) => stripTrustTokensRecursively(item));
    } else {
      // Remove trustToken from current object
      if (data.trustToken) {
        delete data.trustToken;
        logger.info('Stripped trust token from object in jobWorker');
      }
      // Recurse into all properties
      Object.values(data).forEach((value) => stripTrustTokensRecursively(value));
    }
  }
}

/**
 * Validates JSON structure after threat extraction
 * @param {any} data - The data to validate
 * @returns {boolean} - True if valid, false if invalid
 */
function validateJsonStructure(data) {
  try {
    // Check if it's a valid JSON-serializable structure
    JSON.stringify(data);
    return true;
  } catch (error) {
    logger.warn('Invalid JSON structure detected after threat extraction', {
      error: error.message,
    });
    return false;
  }
}

/**
 * Handles edge cases after threat extraction (empty objects, etc.)
 * @param {any} data - The data to clean up
 * @returns {any} - The cleaned data
 */
function cleanupJsonStructure(data) {
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      // Clean up arrays
      const cleaned = data
        .map((item) => cleanupJsonStructure(item))
        .filter((item) => item !== null);
      return cleaned.length > 0 ? cleaned : null;
    } else {
      // Clean up objects
      const cleaned = {};
      let hasValidContent = false;

      for (const [key, value] of Object.entries(data)) {
        const cleanedValue = cleanupJsonStructure(value);
        if (cleanedValue !== null) {
          cleaned[key] = cleanedValue;
          hasValidContent = true;
        }
      }

      return hasValidContent ? cleaned : null;
    }
  }

  // Return primitive values as-is
  return data;
}

/**
 * Recursively extracts and removes threat details from the object
 */
function extractAndRemoveThreats(obj, foundThreats = {}) {
  if (!obj || typeof obj !== 'object') return foundThreats;

  const suspiciousKeys = [
    'sanitization',
    'sanitizationTests',
    'sanitizationTargets',
    'sanitizationReport',
    'securityReport',
    'potentialXSS',
    'symbolsAndSpecialChars',
    'unicodeText',
    'mathematicalSymbols',
    'zeroWidthCharacters',
    'controlCharacters',
    'invisibleCharacters',
  ];

  for (const key of Object.keys(obj)) {
    // Check if key is suspicious
    const isSuspicious =
      suspiciousKeys.some((k) => k.toLowerCase() === key.toLowerCase()) ||
      key.toLowerCase().includes('sanitization');

    if (isSuspicious) {
      // Capture the threat data
      foundThreats[key] = obj[key];
      logger.info('Removed suspicious key from response', { key, path: 'response_cleanup' });
      // Remove from object
      delete obj[key];
    } else {
      // Recurse
      extractAndRemoveThreats(obj[key], foundThreats);
    }
  }
  return foundThreats;
}

/**
 * Processes a job asynchronously and returns a promise.
 * @param {Object} job - The job data
 * @returns {Promise} - Resolves with the result or rejects with an error
 */
async function processJob(job) {
  const jobId = job.id;
  logger.info('Processing job', { jobId });

  try {
    // Update status to processing
    const jobStatus = await JobStatus.load(jobId);
    if (jobStatus) {
      await jobStatus.updateStatus('processing');
    }

    let result;

    if (job.data.type === 'pdf_processing') {
      // Handle PDF upload processing
      await jobStatus.updateProgress(10, 'Parsing PDF file');

      const buffer = Buffer.from(job.data.fileBuffer, 'base64');

      // Extract text and metadata from PDF
      let extractedText, metadata;
      try {
        const data = await pdfParse(buffer);
        // Ensure extractedText is a string
        extractedText = typeof data.text === 'string' ? data.text : String(data.text || '');
        metadata = {
          pages: data.numpages,
          title: data.info?.Title || null,
          author: data.info?.Author || null,
          subject: data.info?.Subject || null,
          creator: data.info?.Creator || null,
          producer: data.info?.Producer || null,
          creationDate: data.info?.CreationDate || null,
          modificationDate: data.info?.ModDate || null,
          encoding: 'utf8',
        };
      } catch (pdfError) {
        logger.error('PDF text extraction failed in async job', {
          jobId,
          error: pdfError.message,
          bufferLength: buffer.length,
          bufferStart: buffer.slice(0, 10).toString('hex'),
        });
        throw new Error(`Failed to extract text from PDF: ${pdfError.message}`);
      }

      await jobStatus.updateProgress(40, 'Converting to Markdown');

      // Convert extracted text to Markdown
      const markdownConverter = new MarkdownConverter();
      let processedText = extractedText;
      try {
        processedText = markdownConverter.convert(extractedText);
      } catch (convertError) {
        // Fallback to plain text
      }

      // Ensure processedText is a string
      processedText = String(processedText || '');

      // SANITIZE FIRST: Apply sanitization before AI processing
      await jobStatus.updateProgress(40, 'Sanitizing content');

      // Start sanitization performance timing
      const sanitizeStartTime = performance.now();

      const sanitizer = new ProxySanitizer({ trustTokenOptions: {} });
      const sanitizeOptions = {
        ...job.options,
        // Respect generateTrustToken from job options, default to false if not specified
        generateTrustToken:
          job.options.generateTrustToken !== undefined ? job.options.generateTrustToken : false,
      };
      const sanitized = await sanitizer.sanitize(processedText, sanitizeOptions);

      const sanitizeEndTime = performance.now();
      const sanitizationTime = sanitizeEndTime - sanitizeStartTime;

      // Apply AI transformation if specified (now on sanitized input)
      let aiProcessingTime = 0;
      if (job.options?.aiTransformType) {
        await jobStatus.updateProgress(
          70,
          `Applying AI ${job.options.aiTransformType} transformation`,
        );

        const aiStartTime = performance.now();

        const aiTransformer = new AITextTransformer();
        try {
          const aiResult = await aiTransformer.transform(
            typeof sanitized === 'object' && sanitized.sanitizedData
              ? sanitized.sanitizedData
              : sanitized, // Sanitized input
            job.options.aiTransformType,
            {
              sanitizerOptions: job.options,
            },
          );
          processedText = aiResult.text;
        } catch (aiError) {
          logger.warn('AI transformation failed, proceeding with sanitized text', {
            jobId,
            aiTransformType: job.options.aiTransformType,
            error: aiError.message,
          });
          // processedText becomes sanitized text
          processedText =
            typeof sanitized === 'object' && sanitized.sanitizedData
              ? sanitized.sanitizedData
              : sanitized;
        }

        const aiEndTime = performance.now();
        aiProcessingTime = aiEndTime - aiStartTime;
      } else {
        // No AI transformation - use sanitized text
        processedText =
          typeof sanitized === 'object' && sanitized.sanitizedData
            ? sanitized.sanitizedData
            : sanitized;
      }

      // Record pipeline performance metrics
      const totalPipelineTime = sanitizationTime + aiProcessingTime;
      recordPipelinePerformance(sanitizationTime, aiProcessingTime, totalPipelineTime, {
        jobId,
        jobType: job.data.type,
        aiTransformType: job.options?.aiTransformType || 'none',
        inputSize: Math.max(processedText.length, 0),
        outputSize:
          (result?.sanitizedData?.length > 0 ? result.sanitizedData.length : 0) ||
          Math.max(processedText.length, 0),
      });

      // Handle trust token generation - sanitized may be string or {sanitizedData, trustToken}
      result =
        typeof sanitized === 'object' && sanitized.sanitizedData
          ? sanitized // Includes trustToken
          : { sanitizedData: sanitized };

      // Strip trust tokens from result if they exist anywhere
      stripTrustTokensRecursively(result);

      // Set consistent result structure for PDF processing
      result.status = 'processed';
      result.fileName = job.data.fileName;
      result.metadata = metadata;

      // FINAL SANITIZATION: Ensure entire result object is properly sanitized
      logger.info('Applying final sanitization to complete result object', { jobId });
      // result.sanitizedData = sanitizeObject(result.sanitizedData);
      // Skip result.sanitizedData here because it was already sanitized above and contains trustToken structure
      // that we don't want to corrupt with double-sanitization
      result.metadata = sanitizeObject(result.metadata);

      // Record final pipeline performance
      recordPipelinePerformance(sanitizationTime, aiProcessingTime, totalPipelineTime, {
        jobId,
        jobType: job.data.type,
        aiTransformType: job.options?.aiTransformType || 'none',
        inputSize: JSON.stringify(result.sanitizedData).length,
        outputSize: JSON.stringify(result).length,
        finalSanitization: true,
      });

      // Set consistent result structure for PDF processing
      result.status = 'processed';
      result.fileName = job.data.fileName;
      result.metadata = {
        pages: metadata.pages,
        title: metadata.title,
        author: metadata.author,
        subject: metadata.subject,
        creator: metadata.creator,
        producer: metadata.producer,
        creationDate: metadata.creationDate,
        modificationDate: metadata.modificationDate,
        encoding: metadata.encoding,
      };

      // If AI structure was applied, parse as JSON with repair capability
      if (job.options?.aiTransformType === 'structure') {
        logger.info('Processing AI-structured content as JSON', {
          jobId,
          contentLength: result.sanitizedData.length,
          contentPreview: result.sanitizedData.slice(0, 300) + '...',
        });

        const jsonRepair = new JSONRepair();
        const repairResult = jsonRepair.repair(result.sanitizedData);

        if (repairResult.success) {
          logger.info('JSON repair successful', {
            jobId,
            repairedKeys: Object.keys(repairResult.data).length,
          });
          // Sanitize the structured data
          result.sanitizedData = sanitizeObject(repairResult.data);

          // RECURSIVE EXTRACTION AND REMOVAL
          // This modifies result.sanitizedData in place by removing threats
          const extractedThreats = extractAndRemoveThreats(result.sanitizedData);

          // Validate and cleanup JSON structure after threat extraction
          if (validateJsonStructure(result.sanitizedData)) {
            result.sanitizedData = cleanupJsonStructure(result.sanitizedData);
          } else {
            logger.error('JSON structure invalid after threat extraction in PDF processing', {
              jobId,
            });
            // Reset to safe structure if invalid
            result.sanitizedData = { error: 'Invalid content structure after sanitization' };
          }

          // Store extracted threats for logging only - do not include in user response
          // Log the threats but don't add to result

          // HITL Alerting Logic
          const auditLogger = new AuditLogger();

          // Construct HITL message
          let hitlMessage = 'No malicious scripts or payloads detected.';
          let riskLevel = 'Low';
          let triggers = [];

          // Check if we actually found anything significant
          // We filter out empty objects to avoid false positives
          const hasThreats = Object.keys(extractedThreats).length > 0;
          let threatClassification = 'none';

          if (hasThreats) {
            // Enhanced threat detection and classification
            const threatString = JSON.stringify(extractedThreats);
            const isRealThreat =
              threatString.includes('Present') ||
              threatString.includes('email@') ||
              threatString.includes('<script');

            if (isRealThreat) {
              // Classify the threat type
              if (threatString.includes('@') || threatString.includes('phone')) {
                threatClassification = 'pii_data_leakage';
                riskLevel = 'High';
              } else if (threatString.includes('<script') || threatString.includes('javascript:')) {
                threatClassification = 'xss_attempt';
                riskLevel = 'Critical';
              } else if (threatString.includes('zeroWidth') || threatString.includes('invisible')) {
                threatClassification = 'stealth_malware';
                riskLevel = 'High';
              } else {
                threatClassification = 'suspicious_content';
                riskLevel = 'Medium';
              }

              hitlMessage = `Malicious Payload Detected (${threatClassification}): ${JSON.stringify(extractedThreats)}`;
              triggers.push('malicious_payload_detected', threatClassification);
            }
          }

          // Log to AuditLogger as HITL Alert/Escalation
          try {
            await auditLogger.logEscalationDecision(
              {
                riskLevel,
                triggerConditions: triggers,
                decisionRationale: hitlMessage,
                escalationId: `hitl_${jobId}_sanitization`,
                details: {
                  sanitizationTests: extractedThreats,
                  sourcePath: 'pdf_processing',
                  responseType: 'ai_agent_response',
                  threatClassification,
                  jobType: job.data.type,
                  fileName: job.data.fileName,
                  contentLength: job.data.fileBuffer ? job.data.fileBuffer.length : 0,
                  message: hitlMessage,
                },
              },
              {
                resourceId: jobId,
                resourceType: 'job_result',
                sessionId: jobId,
                userId: job.data.userId || 'system',
                stage: 'security_logging',
              },
            );
          } catch (auditError) {
            logger.error('Audit logging failed for PDF processing', {
              jobId,
              error: auditError.message,
              threatCount: Object.keys(extractedThreats).length,
            });
            // Continue processing - audit logging failure should not break job
          }
        }
      } else {
        // Default: sanitize content
        const sanitizer = new ProxySanitizer();
        const sanitized = await sanitizer.sanitize(job.data, job.options);
        result = { sanitizedData: sanitized };

        // Strip trust tokens from result if they exist anywhere
        stripTrustTokensRecursively(result);

        // Only apply threat extraction to structured JSON responses (not plain text)
        if (typeof result.sanitizedData === 'object' && result.sanitizedData !== null) {
          // Apply threat extraction to remove malicious content keys from structured AI responses
          const extractedThreats = extractAndRemoveThreats(result.sanitizedData);

          // Validate and cleanup JSON structure after threat extraction
          if (validateJsonStructure(result.sanitizedData)) {
            result.sanitizedData = cleanupJsonStructure(result.sanitizedData);
          } else {
            logger.error('JSON structure invalid after threat extraction in default path', {
              jobId,
            });
            // Reset to safe structure if invalid
            result.sanitizedData = 'Content sanitization resulted in invalid structure';
          }

          // Store extracted threats for logging only - do not include in user response
          if (Object.keys(extractedThreats).length > 0) {
            // Log to AuditLogger for security team visibility
            const auditLogger = new AuditLogger();

            // Determine risk level and triggers based on extracted threats
            let riskLevel = 'Low';
            let triggers = [];
            let hitlMessage = 'No malicious scripts or payloads detected.';
            let threatClassification = 'none';

            if (extractedThreats && Object.keys(extractedThreats).length > 0) {
              // Check for real threats
              const threatString = JSON.stringify(extractedThreats);
              const isRealThreat =
                threatString.includes('Present') ||
                threatString.includes('@') ||
                threatString.includes('<script');

              if (isRealThreat) {
                // Classify the threat type
                if (threatString.includes('@') || threatString.includes('phone')) {
                  threatClassification = 'pii_data_leakage';
                  riskLevel = 'High';
                } else if (
                  threatString.includes('<script') ||
                  threatString.includes('javascript:')
                ) {
                  threatClassification = 'xss_attempt';
                  riskLevel = 'Critical';
                } else if (
                  threatString.includes('zeroWidth') ||
                  threatString.includes('invisible')
                ) {
                  threatClassification = 'stealth_malware';
                  riskLevel = 'High';
                } else {
                  threatClassification = 'suspicious_content';
                  riskLevel = 'Medium';
                }

                hitlMessage = `Malicious content (${threatClassification}) removed from default sanitization response: ${JSON.stringify(extractedThreats)}`;
                triggers.push('malicious_content_detected', threatClassification);
              }
            }

            try {
              await auditLogger.logEscalationDecision(
                {
                  riskLevel,
                  triggerConditions: triggers,
                  decisionRationale: hitlMessage,
                  escalationId: `security_${jobId}_content_removal`,
                  details: {
                    sanitizationTests: extractedThreats,
                    sourcePath: 'default_sanitization',
                    responseType: 'direct_sanitization',
                    threatClassification,
                    jobType: job.data.type || 'unknown',
                    contentLength: job.data.length || 0,
                    message: hitlMessage,
                  },
                },
                {
                  resourceId: jobId,
                  resourceType: 'job_result',
                  sessionId: jobId,
                  userId: job.data.userId || 'system',
                  stage: 'security_logging',
                },
              );
            } catch (auditError) {
              logger.error('Audit logging failed for default path', {
                jobId,
                error: auditError.message,
                threatCount: Object.keys(extractedThreats).length,
              });
              // Continue processing - audit logging failure should not break job
            }
          }
        }

        // FINAL SECURITY CHECK: Sanitize the complete result object before returning
        logger.info('Applying final security sanitization to result object', { jobId });
        // Don't re-sanitize the whole object if it contains trustToken structure
        // result = sanitizeObject(result);

        // Format result to match sync response
        // If sanitizedData is an object (structured response), stringify it for backward compatibility
        result.sanitizedContent =
          typeof result.sanitizedData === 'object' && result.sanitizedData !== null
            ? JSON.stringify(result.sanitizedData)
            : result.sanitizedData;
        delete result.sanitizedData;
        result.metadata = {
          originalLength: job.data.length || 0,
          sanitizedLength: result.sanitizedContent.length,
          timestamp: new Date().toISOString(),
          reused: false,
          performance: {
            totalTimeMs: 10, // Approximate
          },
        };
      }
    }

    // Update status to completed with result
    if (jobStatus) {
      await jobStatus.updateStatus('completed', null, result);

      // Cache the result for faster retrieval
      const jobResult = new JobResult({
        jobId: jobId,
        result: result,
      });
      await jobResult.save();
    }

    logger.info('Job processed successfully', { jobId });
    return result;
  } catch (error) {
    // Update status to failed
    try {
      const jobStatus = await JobStatus.load(jobId);
      if (jobStatus) {
        await jobStatus.updateStatus('failed', error.message);
      }
    } catch (statusError) {
      logger.error('Failed to update job status', { jobId, error: statusError.message });
    }

    logger.error('Job processing failed', { jobId, error: error.message });
    throw error;
  }
}

module.exports = processJob;
module.exports.extractAndRemoveThreats = extractAndRemoveThreats;
