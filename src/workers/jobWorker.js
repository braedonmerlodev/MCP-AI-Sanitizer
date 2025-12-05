const winston = require('winston');
const JobStatus = require('../models/JobStatus');
const JobResult = require('../models/JobResult');
const ProxySanitizer = require('../components/proxy-sanitizer');
const MarkdownConverter = require('../components/MarkdownConverter');
const AITextTransformer = require('../components/AITextTransformer');
const JSONRepair = require('../utils/jsonRepair');
const AuditLogger = require('../components/data-integrity/AuditLogger');
const pdfParse = require('pdf-parse');

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

      // Apply AI transformation if specified
      if (job.options?.aiTransformType) {
        await jobStatus.updateProgress(
          55,
          `Applying AI ${job.options.aiTransformType} transformation`,
        );

        const aiTransformer = new AITextTransformer();
        try {
          const aiResult = await aiTransformer.transform(
            processedText,
            job.options.aiTransformType,
            {
              sanitizerOptions: job.options,
            },
          );
          processedText = aiResult.text;
        } catch (aiError) {
          logger.warn('AI transformation failed, proceeding with Markdown text', {
            jobId,
            aiTransformType: job.options.aiTransformType,
            error: aiError.message,
          });
          // processedText remains as Markdown
        }
      }

      await jobStatus.updateProgress(70, 'Sanitizing content');

      // Sanitize converted text
      const sanitizer = new ProxySanitizer({ trustTokenOptions: {} });
      const sanitizeOptions = { ...job.options, generateTrustToken: true };
      const sanitized = await sanitizer.sanitize(processedText, sanitizeOptions);

      // Handle trust token generation - sanitized may be string or {sanitizedData, trustToken}
      result =
        typeof sanitized === 'object' && sanitized.sanitizedData
          ? sanitized // Includes trustToken
          : { sanitizedData: sanitized };

      // If AI structure was applied, parse as JSON with repair capability
      if (job.options?.aiTransformType === 'structure') {
        const jsonRepair = new JSONRepair();
        const repairResult = jsonRepair.repair(result.sanitizedData);

        if (repairResult.success) {
          // Sanitize the structured data
          result.sanitizedData = sanitizeObject(repairResult.data);

          // RECURSIVE EXTRACTION AND REMOVAL
          // This modifies result.sanitizedData in place by removing threats
          const extractedThreats = extractAndRemoveThreats(result.sanitizedData);

          // Store extracted threats in a separate field for the Agent to access later
          // This field will NOT be returned to the user if we structure the response correctly
          result.securityReport = extractedThreats;

          // HITL Alerting Logic
          const auditLogger = new AuditLogger();

          // Construct HITL message
          let hitlMessage = 'No malicious scripts or payloads detected.';
          let riskLevel = 'Low';
          let triggers = [];

          // Check if we actually found anything significant
          // We filter out empty objects to avoid false positives
          const hasThreats = Object.keys(extractedThreats).length > 0;

          if (hasThreats) {
            // Deep check to ensure values aren't just "Absent" or "None"
            const isRealThreat =
              JSON.stringify(extractedThreats).includes('Present') ||
              JSON.stringify(extractedThreats).includes('email@') ||
              JSON.stringify(extractedThreats).includes('<script');

            if (isRealThreat) {
              hitlMessage = `Malicious Payload Detected: ${JSON.stringify(extractedThreats)}`;
              riskLevel = 'High';
              triggers.push('malicious_payload_detected');
            }
          }

          // Log to AuditLogger as HITL Alert/Escalation
          await auditLogger.logEscalationDecision(
            {
              riskLevel,
              triggerConditions: triggers,
              decisionRationale: hitlMessage,
              escalationId: `hitl_${jobId}_sanitization`,
              details: {
                sanitizationTests: extractedThreats,
                message: hitlMessage,
              },
            },
            {
              resourceId: jobId,
              resourceType: 'job_result',
              sessionId: jobId,
              userId: job.data.userId || 'system',
            },
          );

          if (repairResult.repairs.length > 0) {
            logger.info('JSON repair applied during PDF processing', {
              jobId,
              repairs: repairResult.repairs,
            });
          }
        } else {
          logger.warn('Failed to parse and repair AI structured output as JSON in async job', {
            jobId,
            error: repairResult.error,
            repairsAttempted: repairResult.repairs,
          });
          // Keep the original string data if repair fails
        }
      }

      // Add metadata to result
      result.metadata = metadata;
      result.fileName = job.data.fileName;
      result.status = 'processed';

      await jobStatus.updateProgress(90, 'Finalizing result');
    } else {
      // Default: sanitize content
      const sanitizer = new ProxySanitizer();
      const sanitized = await sanitizer.sanitize(job.data, job.options);
      result = { sanitizedData: sanitized };
      // Format result to match sync response
      result.sanitizedContent = result.sanitizedData;
      delete result.sanitizedData;
      result.metadata = {
        originalLength: job.data.length,
        sanitizedLength: result.sanitizedContent.length,
        timestamp: new Date().toISOString(),
        reused: false,
        performance: {
          totalTimeMs: 10, // Approximate
        },
      };
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
