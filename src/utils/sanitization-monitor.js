// Sanitization Metadata Leakage Monitor
const winston = require('winston');
const { recordAIInputSanitization } = require('./monitoring');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * SanitizationMonitor detects metadata leakage in API responses.
 * Scans for sanitization artifacts, threat extraction metadata, and security test results
 * that may have leaked into user-visible responses.
 */
class SanitizationMonitor {
  constructor(options = {}) {
    this.options = {
      enableDetailedLogging: options.enableDetailedLogging || false,
      maxResponseSize: options.maxResponseSize || 1024 * 1024, // 1MB
      scanTimeout: options.scanTimeout || 5000, // 5 seconds
      ...options,
    };

    // Known metadata leakage patterns
    this.leakagePatterns = [
      // Sanitization test results
      {
        name: 'sanitizationTests',
        pattern: /"sanitizationTests"\s*:/gi,
        severity: 'high',
        description: 'Sanitization test results leaked into response',
      },
      // Threat extraction metadata
      {
        name: 'threatClassification',
        pattern: /"threatClassification"\s*:\s*"[^"]*"/gi,
        severity: 'high',
        description: 'Threat classification metadata leaked',
      },
      // HITL escalation data
      {
        name: 'hitlEscalation',
        pattern: /"hitl_[^"]*"/gi,
        severity: 'critical',
        description: 'HITL escalation identifiers leaked',
      },
      // Security audit trails
      {
        name: 'auditTrail',
        pattern: /"auditId"\s*:\s*"[^"]*"/gi,
        severity: 'medium',
        description: 'Audit trail identifiers leaked',
      },
      // Trust token metadata
      {
        name: 'trustToken',
        pattern: /"trustToken"\s*:\s*{[^}]*}/gi,
        severity: 'high',
        description: 'Trust token metadata leaked',
      },
      // Data integrity validation results
      {
        name: 'dataIntegrity',
        pattern: /"validationId"\s*:\s*"[^"]*"/gi,
        severity: 'medium',
        description: 'Data integrity validation IDs leaked',
      },
      // AI processing metadata
      {
        name: 'aiProcessing',
        pattern: /"aiProcessed"\s*:\s*(true|false)/gi,
        severity: 'low',
        description: 'AI processing flags leaked',
      },
      // Sanitization pipeline steps
      {
        name: 'pipelineSteps',
        pattern: /"appliedRules"\s*:\s*\[[^\]]*\]/gi,
        severity: 'high',
        description: 'Sanitization pipeline steps leaked',
      },
    ];

    // Leakage incident tracking
    this.incidents = [];
    this.incidentCache = new Map();
    this.cacheMaxSize = 1000;
  }

  /**
   * Scans a response for metadata leakage patterns.
   * @param {string|object} response - The API response to scan
   * @param {object} context - Context information (endpoint, userId, etc.)
   * @returns {object} - Scan results with any detected leakage
   */
  async scanResponse(response, context = {}) {
    const startTime = Date.now();
    const responseId =
      context.responseId || `resp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      // Convert response to string for scanning
      const responseString = this.normalizeResponse(response);

      // Skip scanning if response is too large
      if (responseString.length > this.options.maxResponseSize) {
        logger.warn('Response too large for leakage scanning', {
          responseId,
          size: responseString.length,
          maxSize: this.options.maxResponseSize,
        });
        return { scanned: false, reason: 'response_too_large' };
      }

      const findings = [];
      let totalMatches = 0;

      // Scan for each leakage pattern
      for (const pattern of this.leakagePatterns) {
        // Skip trustToken check for sanitization endpoints that legitimately return tokens
        if (pattern.name === 'trustToken' && context.endpoint === '/sanitize/json') {
          continue;
        }

        const matches = this.scanForPattern(responseString, pattern);
        if (matches.length > 0) {
          findings.push({
            pattern: pattern.name,
            severity: pattern.severity,
            description: pattern.description,
            matches: matches.length,
            sample: matches[0]?.match?.slice(0, 100) ?? 'N/A',
          });
          totalMatches += matches.length;
        }
      }

      const scanTime = Date.now() - startTime;

      // Record findings
      if (findings.length > 0) {
        await this.recordLeakageIncident(findings, responseString, context, responseId);
      }

      // Log scan results
      if (this.options.enableDetailedLogging || findings.length > 0) {
        logger.info('Metadata leakage scan completed', {
          responseId,
          scanTime,
          findingsCount: findings.length,
          totalMatches,
          responseSize: responseString.length,
          endpoint: context.endpoint,
          userId: context.userId,
        });
      }

      return {
        scanned: true,
        responseId,
        scanTime,
        findings,
        totalMatches,
        severity: this.calculateOverallSeverity(findings),
      };
    } catch (error) {
      logger.error('Error during metadata leakage scan', {
        responseId,
        error: error.message,
        stack: error.stack,
        scanTime: Date.now() - startTime,
      });

      return {
        scanned: false,
        error: error.message,
        responseId,
      };
    }
  }

  /**
   * Scans response string for a specific leakage pattern.
   * @param {string} responseString - Normalized response string
   * @param {object} pattern - Pattern configuration
   * @returns {array} - Array of matches found
   */
  scanForPattern(responseString, pattern) {
    const matches = [];
    let match;

    // Reset regex lastIndex for global patterns
    if (pattern.pattern.global) {
      pattern.pattern.lastIndex = 0;
    }

    while ((match = pattern.pattern.exec(responseString)) !== null) {
      matches.push({
        match: match[0],
        index: match.index,
        pattern: pattern.name,
      });

      // Prevent infinite loops with global regex
      if (!pattern.pattern.global) break;
    }

    return matches;
  }

  /**
   * Normalizes response to string for scanning.
   * @param {string|object} response - Response to normalize
   * @returns {string} - Normalized string
   */
  normalizeResponse(response) {
    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object') {
      // For objects, stringify but exclude known safe metadata fields
      const safeCopy = { ...response };

      // Remove known safe metadata that shouldn't be flagged
      const safeFields = ['metadata', 'timestamp', 'requestId', 'correlationId'];
      for (const field of safeFields) {
        if (safeCopy[field] && typeof safeCopy[field] === 'object') {
          // Keep only safe subfields in metadata
          const safeMetadata = { ...safeCopy[field] };
          const unsafeKeys = Object.keys(safeMetadata).filter(
            (key) =>
              key.includes('sanitization') ||
              key.includes('threat') ||
              key.includes('audit') ||
              key.includes('trust'),
          );
          for (const key of unsafeKeys) {
            delete safeMetadata[key];
          }
          safeCopy[field] = safeMetadata;
        }
      }

      return JSON.stringify(safeCopy);
    }

    return String(response || '');
  }

  /**
   * Records a metadata leakage incident.
   * @param {array} findings - Detected leakage findings
   * @param {string} responseString - The response that was scanned
   * @param {object} context - Context information
   * @param {string} responseId - Unique response identifier
   */
  async recordLeakageIncident(findings, responseString, context, responseId) {
    const incident = {
      id: `leakage_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      responseId,
      timestamp: new Date().toISOString(),
      severity: this.calculateOverallSeverity(findings),
      findings,
      context: {
        endpoint: context.endpoint,
        userId: context.userId,
        method: context.method,
        userAgent: context.userAgent,
        ip: context.ip,
      },
      responseSample: responseString.slice(0, 500), // First 500 chars for context
    };

    // Cache incident to prevent duplicate alerts
    const cacheKey = `${context.endpoint}_${context.userId}_${incident.severity}`;
    const lastIncident = this.incidentCache.get(cacheKey);

    if (!lastIncident || Date.now() - new Date(lastIncident.timestamp).getTime() > 300_000) {
      // 5 minutes
      this.incidents.push(incident);
      this.incidentCache.set(cacheKey, incident);

      // Maintain cache size
      if (this.incidentCache.size > this.cacheMaxSize) {
        const oldestKey = [...this.incidentCache.keys()][0];
        this.incidentCache.delete(oldestKey);
      }

      // Log the incident
      logger.warn('Metadata leakage incident detected', {
        incidentId: incident.id,
        responseId,
        severity: incident.severity,
        findingsCount: findings.length,
        endpoint: context.endpoint,
        userId: context.userId,
      });

      // Record in monitoring system
      recordAIInputSanitization('metadataLeakage', {
        incidentId: incident.id,
        severity: incident.severity,
        findingsCount: findings.length,
        endpoint: context.endpoint,
      });
    }
  }

  /**
   * Calculates overall severity from multiple findings.
   * @param {array} findings - Array of findings
   * @returns {string} - Overall severity level
   */
  calculateOverallSeverity(findings) {
    if (findings.length === 0) return 'none';

    const severityLevels = { critical: 4, high: 3, medium: 2, low: 1 };
    const maxSeverity = Math.max(...findings.map((f) => severityLevels[f.severity] || 0));

    return (
      Object.keys(severityLevels).find((key) => severityLevels[key] === maxSeverity) || 'unknown'
    );
  }

  /**
   * Gets recent leakage incidents.
   * @param {object} filters - Optional filters
   * @returns {array} - Filtered incidents
   */
  getIncidents(filters = {}) {
    let filtered = [...this.incidents];

    if (filters.severity) {
      filtered = filtered.filter((i) => i.severity === filters.severity);
    }

    if (filters.endpoint) {
      filtered = filtered.filter((i) => i.context.endpoint === filters.endpoint);
    }

    if (filters.since) {
      const sinceTime = new Date(filters.since).getTime();
      filtered = filtered.filter((i) => new Date(i.timestamp).getTime() >= sinceTime);
    }

    return filtered.slice(-100); // Return last 100 incidents
  }

  /**
   * Gets leakage statistics.
   * @returns {object} - Statistics about leakage incidents
   */
  getStatistics() {
    const stats = {
      totalIncidents: this.incidents.length,
      bySeverity: {},
      byEndpoint: {},
      byPattern: {},
      recentIncidents: this.incidents.slice(-10),
    };

    for (const incident of this.incidents) {
      // Count by severity
      stats.bySeverity[incident.severity] = (stats.bySeverity[incident.severity] || 0) + 1;

      // Count by endpoint
      const endpoint = incident.context.endpoint || 'unknown';
      stats.byEndpoint[endpoint] = (stats.byEndpoint[endpoint] || 0) + 1;

      // Count by pattern
      for (const finding of incident.findings) {
        stats.byPattern[finding.pattern] =
          (stats.byPattern[finding.pattern] || 0) + finding.matches;
      }
    }

    return stats;
  }
}

module.exports = SanitizationMonitor;
