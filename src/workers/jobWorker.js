const winston = require('winston');
const JobStatus = require('../models/JobStatus');
const JobResult = require('../models/JobResult');
const ProxySanitizer = require('../components/proxy-sanitizer');
const MarkdownConverter = require('../components/MarkdownConverter');
const pdfParse = require('pdf-parse');

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
      const pdfData = await pdfParse(buffer);
      const extractedText = pdfData.text;
      const metadata = {
        pages: pdfData.numpages,
        title: pdfData.info?.Title || null,
        author: pdfData.info?.Author || null,
        subject: pdfData.info?.Subject || null,
        creator: pdfData.info?.Creator || null,
        producer: pdfData.info?.Producer || null,
        creationDate: pdfData.info?.CreationDate || null,
        modificationDate: pdfData.info?.ModDate || null,
        encoding: 'utf8',
      };

      await jobStatus.updateProgress(40, 'Converting to Markdown');

      // Convert extracted text to Markdown
      const markdownConverter = new MarkdownConverter();
      let markdownText = extractedText;
      try {
        markdownText = markdownConverter.convert(extractedText);
      } catch (convertError) {
        // Fallback to plain text
      }

      await jobStatus.updateProgress(70, 'Sanitizing content');

      // Sanitize converted text
      const sanitizer = new ProxySanitizer();
      result = await sanitizer.sanitize(markdownText, job.options);

      // Add metadata to result
      result.metadata = metadata;
      result.fileName = job.data.fileName;
      result.status = 'processed';

      await jobStatus.updateProgress(90, 'Finalizing result');
    } else {
      // Default: sanitize content
      const sanitizer = new ProxySanitizer();
      result = await sanitizer.sanitize(job.data, job.options);
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
