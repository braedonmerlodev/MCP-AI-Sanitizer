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
   * @returns {string} - The sanitized data.
   */
  sanitize(data) {
    logger.info('Starting sanitization process');
    const sanitized = this.pipeline.sanitize(data);
    logger.info('Sanitization completed');
    return sanitized;
  }

  /**
   * Handles n8n webhook requests.
   * @param {object} payload - The webhook payload from n8n.
   * @returns {object} - The response to send back to n8n.
   */
  handleN8nWebhook(payload) {
    logger.info('Received n8n webhook', { payload });
    // Assume payload has a 'data' field
    const inputData = payload.data;
    const sanitizedData = this.sanitize(inputData);
    // Forward to LLMs/MCP - for now, mock response
    const llmResponse = this.forwardToLLM(sanitizedData);
    // Apply output sanitization
    const outputSanitized = this.sanitize(llmResponse);
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
