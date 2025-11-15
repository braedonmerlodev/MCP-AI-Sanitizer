const winston = require('winston');
const JobStatus = require('../models/JobStatus');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Processes a job asynchronously.
 * @param {Object} job - The job data
 * @param {Function} cb - Callback to call when done
 */
async function processJob(job, cb) {
  const jobId = job.id;
  logger.info('Processing job', { jobId });

  try {
    // Update status to processing
    const jobStatus = await JobStatus.load(jobId);
    if (jobStatus) {
      await jobStatus.updateStatus('processing');
    }

    const ProxySanitizer = require('../components/proxy-sanitizer');
    const MarkdownConverter = require('../components/MarkdownConverter');
    const pdfParse = require('pdf-parse');

    let result;

    if (job.data.type === 'upload-pdf') {
      // Handle PDF upload processing
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

      // Convert extracted text to Markdown
      const markdownConverter = new MarkdownConverter();
      let markdownText = extractedText;
      try {
        markdownText = markdownConverter.convert(extractedText);
      } catch (convertError) {
        // Fallback to plain text
      }

      // Sanitize converted text
      const sanitizer = new ProxySanitizer();
      result = await sanitizer.sanitize(markdownText, job.options);

      // Add metadata to result
      result.metadata = metadata;
      result.fileName = job.data.fileName;
      result.status = 'processed';
    } else {
      // Default: sanitize content
      const sanitizer = new ProxySanitizer();
      result = await sanitizer.sanitize(job.data, job.options);
    }

    // Update status to completed with result
    if (jobStatus) {
      await jobStatus.updateStatus('completed', null, result);
    }

    logger.info('Job processed successfully', { jobId });
    cb(null, result);
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
    cb(error);
  }
}

module.exports = processJob;
