const SanitizationPipeline = require('./sanitization-pipeline');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * ProxySanitizer acts as the main entry point for sanitization requests.
 * Routes requests through the sanitization pipeline and forwards to LLMs/MCP servers.
 */
class ProxySanitizer {
  constructor() {
    this.pipeline = new SanitizationPipeline();
  }

  /**
   * Sanitizes input data.
   * @param {string} data - The input data to sanitize.
   * @param {Object} options - Sanitization options
   * @param {string} options.classification - Destination classification
   * @returns {string} - The sanitized data.
   */
  sanitize(data, options = {}) {
    logger.info('Starting sanitization process', { classification: options.classification });
    const sanitized = this.pipeline.sanitize(data, options);
    logger.info('Sanitization completed', { wasSanitized: options.classification !== 'non-llm' });
    return sanitized;
  }

  /**
   * Handles n8n webhook requests.
   * @param {object} payload - The webhook payload from n8n.
   * @param {Object} options - Sanitization options
   * @param {string} options.classification - Destination classification
   * @returns {object} - The response to send back to n8n.
   */
  handleN8nWebhook(payload, options = {}) {
    logger.info('Received n8n webhook', { payload, classification: options.classification });
    // Assume payload has a 'data' field
    const inputData = payload.data;
    const sanitizedData = this.sanitize(inputData, options);
    // Forward to LLMs/MCP - for now, mock response
    const llmResponse = this.forwardToLLM(sanitizedData);
    // Apply output sanitization - assuming output is also LLM-bound, use same options
    const outputSanitized = this.sanitize(llmResponse, options);
    logger.info('n8n webhook processed');
    return { result: outputSanitized };
  }

  /**
   * Forwards sanitized data to LLMs/MCP servers.
   * @param {string} data - The sanitized data.
   * @returns {string} - The response from LLM.
   */
  forwardToLLM(data) {
    // Mock implementation - in real scenario, call actual LLM API
    return `Processed: ${data}`;
  }
}

module.exports = ProxySanitizer;
