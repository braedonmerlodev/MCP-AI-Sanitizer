const SanitizationPipeline = require('./sanitization-pipeline');
const AuditLog = require('../models/AuditLog');
const sanitizationConfig = require('../config/sanitizationConfig');
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
    this.metrics = {
      totalOperations: 0,
      totalLatency: 0,
      latencies: [],
      maxLatency: 0,
      minLatency: Infinity,
    };
  }

  /**
   * Sanitizes input data.
   * @param {string} data - The input data to sanitize.
   * @param {Object} options - Sanitization options
   * @param {string} options.classification - Destination classification
   * @param {string} options.operation - 'request' or 'response' for audit logging
   * @param {boolean} options.generateTrustToken - Generate trust token for sanitized content
   * @param {Object} options.trustToken - Trust token to validate for caching
   * @returns {string|Object} - The sanitized data or {sanitizedData, trustToken} if generateTrustToken is true.
   */
  async sanitize(data, options = {}) {
    const {
      classification = 'unclear',
      operation = 'unknown',
      generateTrustToken = false,
      trustToken,
    } = options;
    const riskLevel = sanitizationConfig.getRiskLevel(classification);
    const sanitizationLevel = riskLevel === 'low' ? 'bypassed' : 'full';

    logger.info('Starting sanitization process', { classification, riskLevel, operation });

    const startTime = Date.now();
    const sanitized = await this.pipeline.sanitize(data, { ...options, riskLevel });
    const endTime = Date.now();
    const latency = endTime - startTime;

    // Update metrics
    this.metrics.totalOperations++;
    this.metrics.totalLatency += latency;
    this.metrics.latencies.push(latency);
    if (latency > this.metrics.maxLatency) this.metrics.maxLatency = latency;
    if (latency < this.metrics.minLatency) this.metrics.minLatency = latency;

    logger.info('Sanitization latency measured', { latency, operation });

    // Create audit log entry (wrapped in try-catch to prevent audit failures from breaking sanitization)
    let auditId = null;
    try {
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
          latency: latency,
        },
        destination: classification,
        riskLevel: riskLevel,
        sanitizationLevel: sanitizationLevel,
      });
      auditId = auditEntry.id;
    } catch (error) {
      logger.warn('Failed to create audit log entry', {
        error: error.message,
        operation,
        classification,
      });
    }

    logger.info('Sanitization completed', {
      wasSanitized: riskLevel !== 'low',
      operation,
      auditId,
      latency,
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
    return { result: { sanitizedData: outputSanitized } };
  }

  /**
   * Gets performance metrics for sanitization operations.
   * @returns {Object} Metrics object
   */
  getMetrics() {
    const avgLatency =
      this.metrics.totalOperations > 0
        ? this.metrics.totalLatency / this.metrics.totalOperations
        : 0;
    return {
      ...this.metrics,
      averageLatency: avgLatency,
    };
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
