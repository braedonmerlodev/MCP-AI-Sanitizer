const winston = require('winston');
const AuditLog = require('../models/AuditLog');

/**
 * AuditLoggerAccess handles tamper-proof audit logging for AI agent access validation events.
 * Provides comprehensive logging of trust token validation attempts and outcomes.
 */
class AuditLoggerAccess {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'info';
    this.logFile = options.logFile || 'access-audit.log';
    this.enableConsole = options.enableConsole !== false;
    this.maxTrailSize = options.maxTrailSize || 1000;
    this.secret =
      options.secret || process.env.AUDIT_SECRET || 'default-audit-secret-change-in-production';

    // Configurable logging levels for different event types
    this.loggingLevels = {
      success: options.successLevel || 'info',
      failure: options.failureLevel || 'warn',
      error: options.errorLevel || 'error',
    };

    // Initialize Winston logger for audit logs
    this.logger = winston.createLogger({
      level: this.logLevel,
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      transports: [
        // File transport for persistent audit logs
        new winston.transports.File({
          filename: this.logFile,
          options: { flags: 'a' }, // Append mode
        }),
      ],
    });

    // Add console transport if enabled
    if (this.enableConsole) {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
      );
    }

    // In-memory audit trail for quick access
    this.auditTrail = [];
  }

  /**
   * Logs a trust token validation attempt
   * @param {Object} trustToken - The trust token being validated
   * @param {Object} validationResult - Result of validation
   * @param {Object} requestContext - Request context (method, path, ip, etc.)
   * @param {Object} additionalContext - Additional context (userId, sessionId, etc.)
   */
  logValidationAttempt(trustToken, validationResult, requestContext = {}, additionalContext = {}) {
    const auditLog = new AuditLog(
      {
        userId: additionalContext.userId || 'ai-agent',
        action: validationResult.isValid
          ? 'trust_token_validated'
          : 'trust_token_validation_failed',
        resourceId: trustToken.contentHash || 'unknown',
        details: {
          trustToken: {
            contentHash: trustToken.contentHash,
            timestamp: trustToken.timestamp,
            algorithm: trustToken.algorithm,
          },
          validationResult: {
            isValid: validationResult.isValid,
            error: validationResult.error,
            validationTime: validationResult.validationTime,
          },
          requestContext: {
            method: requestContext.method,
            path: requestContext.path,
            ipAddress: requestContext.ip,
            userAgent: requestContext.userAgent,
          },
        },
        ipAddress: requestContext.ip,
        userAgent: requestContext.userAgent,
        sessionId: additionalContext.sessionId,
      },
      { secret: this.secret },
    );

    // Add to in-memory trail
    this.auditTrail.push(auditLog);
    if (this.auditTrail.length > this.maxTrailSize) {
      this.auditTrail.shift(); // Remove oldest
    }

    // Log to Winston with appropriate level
    const logLevel = validationResult.isValid
      ? this.loggingLevels.success
      : this.loggingLevels.failure;
    this.logger.log(logLevel, 'Access Validation Event', auditLog.toObject());

    return auditLog.id;
  }

  /**
   * Logs access control enforcement
   * @param {string} resourceId - ID of the resource being accessed
   * @param {boolean} accessGranted - Whether access was granted
   * @param {string} enforcementLevel - Level of enforcement (strict, moderate, lenient)
   * @param {Object} requestContext - Request context
   * @param {Object} additionalContext - Additional context
   */
  logAccessEnforcement(
    resourceId,
    accessGranted,
    enforcementLevel,
    requestContext = {},
    additionalContext = {},
  ) {
    const auditLog = new AuditLog(
      {
        userId: additionalContext.userId || 'ai-agent',
        action: accessGranted ? 'access_granted' : 'access_denied',
        resourceId,
        details: {
          accessGranted,
          enforcementLevel,
          reason: additionalContext.reason,
          requestContext: {
            method: requestContext.method,
            path: requestContext.path,
            ipAddress: requestContext.ip,
            userAgent: requestContext.userAgent,
          },
        },
        ipAddress: requestContext.ip,
        userAgent: requestContext.userAgent,
        sessionId: additionalContext.sessionId,
      },
      { secret: this.secret },
    );

    // Add to in-memory trail
    this.auditTrail.push(auditLog);
    if (this.auditTrail.length > this.maxTrailSize) {
      this.auditTrail.shift();
    }

    // Log to Winston
    const logLevel = accessGranted ? this.loggingLevels.success : this.loggingLevels.failure;
    this.logger.log(logLevel, 'Access Enforcement Event', auditLog.toObject());

    return auditLog.id;
  }

  /**
   * Logs system errors during access validation
   * @param {Error} error - The error that occurred
   * @param {Object} requestContext - Request context
   * @param {Object} additionalContext - Additional context
   */
  logValidationError(error, requestContext = {}, additionalContext = {}) {
    const auditLog = new AuditLog(
      {
        userId: additionalContext.userId || 'system',
        action: 'validation_error',
        resourceId: 'access_validation',
        details: {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          requestContext: {
            method: requestContext.method,
            path: requestContext.path,
            ipAddress: requestContext.ip,
          },
        },
        ipAddress: requestContext.ip,
        userAgent: requestContext.userAgent,
        sessionId: additionalContext.sessionId,
      },
      { secret: this.secret },
    );

    // Add to in-memory trail
    this.auditTrail.push(auditLog);
    if (this.auditTrail.length > this.maxTrailSize) {
      this.auditTrail.shift();
    }

    // Log error
    this.logger.log(this.loggingLevels.error, 'Access Validation Error', auditLog.toObject());

    return auditLog.id;
  }

  /**
   * Retrieves audit entries with filtering
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered audit entries
   */
  getAuditEntries(filters = {}) {
    let entries = [...this.auditTrail];

    if (filters.action) {
      entries = entries.filter((e) => e.action === filters.action);
    }

    if (filters.userId) {
      entries = entries.filter((e) => e.userId === filters.userId);
    }

    if (filters.resourceId) {
      entries = entries.filter((e) => e.resourceId === filters.resourceId);
    }

    if (filters.startDate) {
      entries = entries.filter((e) => new Date(e.timestamp) >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      entries = entries.filter((e) => new Date(e.timestamp) <= new Date(filters.endDate));
    }

    if (filters.isValid !== undefined) {
      entries = entries.filter((e) => e.details.validationResult?.isValid === filters.isValid);
    }

    return entries;
  }

  /**
   * Gets audit statistics
   * @returns {Object} - Audit statistics
   */
  getAuditStats() {
    const stats = {
      totalEntries: this.auditTrail.length,
      actions: {},
      users: {},
      resources: {},
      validationOutcomes: { valid: 0, invalid: 0 },
      timeRange: {},
    };

    if (this.auditTrail.length > 0) {
      stats.timeRange.start = this.auditTrail[0].timestamp;
      stats.timeRange.end = this.auditTrail.at(-1).timestamp;
    }

    for (const entry of this.auditTrail) {
      // Count actions
      stats.actions[entry.action] = (stats.actions[entry.action] || 0) + 1;

      // Count users
      stats.users[entry.userId] = (stats.users[entry.userId] || 0) + 1;

      // Count resources
      stats.resources[entry.resourceId] = (stats.resources[entry.resourceId] || 0) + 1;

      // Count validation outcomes
      if (entry.details.validationResult) {
        if (entry.details.validationResult.isValid) {
          stats.validationOutcomes.valid++;
        } else {
          stats.validationOutcomes.invalid++;
        }
      }
    }

    return stats;
  }

  /**
   * Sets logging level for specific event types
   * @param {string} eventType - 'success', 'failure', or 'error'
   * @param {string} level - Winston log level
   */
  setLoggingLevel(eventType, level) {
    if (Object.prototype.hasOwnProperty.call(this.loggingLevels, eventType)) {
      this.loggingLevels[eventType] = level;
    }
  }

  /**
   * Sets overall log level
   * @param {string} level - Winston log level
   */
  setLogLevel(level) {
    this.logLevel = level;
    this.logger.level = level;
  }
}

module.exports = AuditLoggerAccess;
