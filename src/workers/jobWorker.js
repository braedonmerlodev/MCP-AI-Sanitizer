const winston = require('winston');
const JobStatus = require('../models/JobStatus');
const JobResult = require('../models/JobResult');

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
function processJob(job, cb) {
  if (typeof cb !== 'function') {
    logger.error('Job worker called with invalid callback', { jobId: job.id });
    return;
  }
  const jobId = job.id;
  logger.info('Processing job', { jobId });

  (async () => {
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
  })().catch((asyncError) => {
    logger.error('Async job processing error', { jobId, error: asyncError.message });
    cb(asyncError);
  });
}

module.exports = processJob;
