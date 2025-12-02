const winston = require('winston');
const JobStatus = require('../models/JobStatus');
const JobResult = require('../models/JobResult');
const ProxySanitizer = require('../components/proxy-sanitizer');
const MarkdownConverter = require('../components/MarkdownConverter');
const AITextTransformer = require('../components/AITextTransformer');
const JSONRepair = require('../utils/jsonRepair');
const pdfParse = require('pdf-parse');

// Ensure config is loaded for environment variables
const config = require('../config');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

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

    if (job.data.type === 'upload-pdf') {
      // Handle PDF upload processing
      await jobStatus.updateProgress(10, 'Parsing PDF file');

      const buffer = Buffer.from(job.data.fileBuffer, 'base64');

      // Extract text and metadata from PDF
      let extractedText, metadata;
      try {
        const data = await pdfParse(buffer);
        extractedText = data.text;
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
      if (typeof sanitized === 'object' && sanitized.sanitizedData) {
        result = sanitized; // Includes trustToken
      } else {
        result = { sanitizedData: sanitized };
      }

      // If AI structure was applied, parse as JSON with repair capability
      if (job.options?.aiTransformType === 'structure') {
        const jsonRepair = new JSONRepair();
        const repairResult = jsonRepair.repair(result.sanitizedData);

        if (repairResult.success) {
          result.sanitizedData = repairResult.data;
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
