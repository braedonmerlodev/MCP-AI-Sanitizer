/**
 * Destination Tracking Middleware
 *
 * Analyzes incoming requests to determine if they are destined for LLM consumption.
 * Attaches classification metadata to the request object for use by downstream components.
 *
 * Classification Rules:
 * - LLM-bound: Headers like 'X-Destination: llm' or paths containing '/llm/', '/ai/', '/chat/'
 * - Non-LLM: File operations, tool calls, direct API access without LLM indicators
 * - Unclear: Default to full sanitization for security
 */

const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Classification metadata format attached to req.destinationTracking
 * @typedef {Object} DestinationMetadata
 * @property {string} classification - 'llm' | 'non-llm' | 'unclear'
 * @property {number} confidence - 0-1 confidence score
 * @property {string[]} indicators - Array of matched indicators
 * @property {string} fallbackReason - Reason for fallback if applicable
 */

/**
 * Middleware function to track and classify request destinations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function destinationTracking(req, res, next) {
  try {
    const metadata = analyzeRequest(req);

    // Attach metadata to request object
    req.destinationTracking = metadata;

    // Log classification for debugging
    logger.info('Request classified', {
      method: req.method,
      path: req.path,
      classification: metadata.classification,
      confidence: metadata.confidence,
      indicators: metadata.indicators,
    });

    next();
  } catch (error) {
    logger.error('Destination tracking error', { error: error.message, path: req.path });
    // On error, default to unclear for security
    req.destinationTracking = {
      classification: 'unclear',
      confidence: 0,
      indicators: [],
      fallbackReason: 'classification_error',
    };
    next();
  }
}

/**
 * Analyzes request to determine destination classification
 * @param {Object} req - Express request object
 * @returns {DestinationMetadata} Classification metadata
 */
function analyzeRequest(req) {
  const indicators = [];
  let confidence = 0;

  // Check headers for explicit destination indicators
  const destinationHeader = req.get('X-Destination');
  if (destinationHeader) {
    if (destinationHeader.toLowerCase() === 'llm') {
      indicators.push(`header:X-Destination=${destinationHeader}`);
      confidence += 0.8;
    } else if (
      destinationHeader.toLowerCase() === 'file' ||
      destinationHeader.toLowerCase() === 'tool'
    ) {
      indicators.push(`header:X-Destination=${destinationHeader}`);
      confidence -= 0.8; // Strong negative for non-LLM
    }
  }

  // Check path patterns for LLM indicators
  const llmPathPatterns = ['/llm/', '/ai/', '/chat/', '/completion/', '/generation/'];
  const hasLlmPath = llmPathPatterns.some((pattern) => req.path.includes(pattern));
  if (hasLlmPath) {
    indicators.push(`path:${req.path}`);
    confidence += 0.7;
  }

  // Check for file operation indicators (negative for LLM)
  const fileOperationPatterns = ['/upload', '/download', '/file/', '/document/'];
  const hasFileOperation = fileOperationPatterns.some((pattern) => req.path.includes(pattern));
  if (hasFileOperation) {
    indicators.push(`file-operation:${req.path}`);
    confidence -= 0.5;
  }

  // Check content-type for potential LLM input
  const contentType = req.get('Content-Type');
  if (contentType && (contentType.includes('text/') || contentType.includes('application/json'))) {
    indicators.push(`content-type:${contentType}`);
    confidence += 0.3;
  }

  // Determine final classification
  let classification;
  let fallbackReason = null;

  if (confidence >= 0.6) {
    classification = 'llm';
  } else if (confidence <= -0.4) {
    classification = 'non-llm';
  } else {
    classification = 'unclear';
    fallbackReason = 'low_confidence_score';
  }

  // Ensure confidence is between 0 and 1
  confidence = Math.max(0, Math.min(1, Math.abs(confidence)));

  return {
    classification,
    confidence,
    indicators,
    fallbackReason,
  };
}

module.exports = destinationTracking;
