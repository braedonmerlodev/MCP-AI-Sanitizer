const SanitizationPipeline = require('./sanitization-pipeline');
const AuditLog = require('../models/AuditLog');
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
   * @param {string} options.operation - 'request' or 'response' for audit logging
   * @returns {string} - The sanitized data.
   */
  async sanitize(data, options = {}) {
    const { classification = 'unclear', operation = 'unknown' } = options;
    const sanitizationLevel = classification === 'non-llm' ? 'bypassed' : 'full';

    logger.info('Starting sanitization process', { classification, operation });

    const sanitized = await this.pipeline.sanitize(data, options);

    // Create audit log entry
    const auditEntry = new AuditLog({
      action:
        sanitizationLevel === 'bypassed'
          ? 'data_sanitization_bypassed'
          : 'data_sanitization_applied',
      resourceId: `sanitization_${operation}_${Date.now()}`,
      details: {
        dataLength: data.length,
        sanitizedLength: sanitized.length,
        operation: operation,
        direction:
          operation === 'request' ? 'inbound' : operation === 'response' ? 'outbound' : 'unknown',
      },
      destination: classification,
      riskLevel:
        classification === 'llm' ? 'high' : classification === 'non-llm' ? 'low' : 'medium',
      sanitizationLevel: sanitizationLevel,
    });

    logger.info('Sanitization completed', {
      wasSanitized: classification !== 'non-llm',
      operation,
      auditId: auditEntry.id,
    });

    return sanitized;
  }

  /**
   * Handles n8n webhook requests.
   * @param {object} payload - The webhook payload from n8n.
   * @param {Object} options - Sanitization options
   * @param {string} options.classification - Destination classification
   * @returns {object} - The response to send back to n8n.
   */
  async handleN8nWebhook(payload, options = {}) {
    const { classification = 'unclear' } = options;

    logger.info('Received n8n webhook', { classification });

    // Assume payload has a 'data' field
    const inputData = payload.data;

    // Sanitize input (request sanitization)
    const sanitizedData = await this.sanitize(inputData, { ...options, operation: 'request' });

    // Forward to LLMs/MCP - for now, mock response
    const llmResponse = this.forwardToLLM(sanitizedData);

    // Apply output sanitization (response sanitization)
    const outputSanitized = await this.sanitize(llmResponse, { ...options, operation: 'response' });

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
