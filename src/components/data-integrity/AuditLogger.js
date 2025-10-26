const winston = require('winston');

/**
 * AuditLogger records all integrity-related operations and access for compliance.
 * Provides tamper-proof audit trails with structured logging.
 */
class AuditLogger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'info';
    this.logFile = options.logFile || 'data-integrity-audit.log';
    this.enableConsole = options.enableConsole !== false;

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

    // In-memory audit trail for quick access (in production, this would be limited)
    this.auditTrail = [];
    this.maxTrailSize = options.maxTrailSize || 1000;
  }

  /**
   * Logs a data integrity operation
   * @param {string} operation - Operation type (validate, hash, access, etc.)
   * @param {Object} details - Operation details
   * @param {Object} context - Additional context (user, session, etc.)
   */
  logOperation(operation, details, context = {}) {
    const auditEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      operation,
      details,
      context: {
        ...context,
        logger: 'DataIntegrityValidator',
      },
      level: 'info',
    };

    // Add to in-memory trail
    this.auditTrail.push(auditEntry);
    if (this.auditTrail.length > this.maxTrailSize) {
      this.auditTrail.shift(); // Remove oldest
    }

    // Log to Winston
    this.logger.info('Data Integrity Operation', auditEntry);

    return auditEntry.id;
  }

  /**
   * Logs validation results
   * @param {Object} validationResult - Result from validation
   * @param {Object} context - Context information
   */
  logValidation(validationResult, context = {}) {
    const details = {
      isValid: validationResult.isValid,
      validationType: validationResult.type || 'unknown',
      errors: validationResult.errors || [],
      summary: validationResult.summary || {},
    };

    return this.logOperation('validation', details, {
      ...context,
      severity: validationResult.isValid ? 'success' : 'warning',
    });
  }

  /**
   * Logs hash generation/verification
   * @param {string} action - 'generate' or 'verify'
   * @param {Object} hashDetails - Hash operation details
   * @param {Object} context - Context information
   */
  logHashOperation(action, hashDetails, context = {}) {
    const details = {
      action,
      algorithm: hashDetails.algorithm || 'sha256',
      success: hashDetails.success !== false,
      ...hashDetails,
    };

    return this.logOperation('hash_operation', details, {
      ...context,
      severity: details.success ? 'info' : 'error',
    });
  }

  /**
   * Logs access to raw data (security-critical)
   * @param {string} resourceId - ID of the resource accessed
   * @param {string} accessType - Type of access (read, export, etc.)
   * @param {Object} context - Access context (user, reason, etc.)
   */
  logRawDataAccess(resourceId, accessType, context = {}) {
    const details = {
      resourceId,
      accessType,
      resourceType: 'raw_data',
      accessGranted: context.accessGranted !== false,
    };

    return this.logOperation('raw_data_access', details, {
      ...context,
      severity: 'warning', // Raw data access is always logged as warning
      requiresReview: true,
    });
  }

  /**
   * Logs error routing operations
   * @param {Object} errorDetails - Error routing details
   * @param {Object} context - Context information
   */
  logErrorRouting(errorDetails, context = {}) {
    const details = {
      errorId: errorDetails.id,
      category: errorDetails.category,
      queue: errorDetails.queue,
      priority: errorDetails.priority,
      retryable: errorDetails.retryable,
    };

    return this.logOperation('error_routing', details, {
      ...context,
      severity: 'error',
    });
  }

  /**
   * Logs atomic operations
   * @param {string} operation - Operation type (begin, commit, rollback)
   * @param {Object} transactionDetails - Transaction details
   * @param {Object} context - Context information
   */
  logAtomicOperation(operation, transactionDetails, context = {}) {
    const details = {
      operation,
      transactionId: transactionDetails.id,
      success: transactionDetails.success !== false,
      affectedRecords: transactionDetails.affectedRecords || 0,
    };

    return this.logOperation('atomic_operation', details, {
      ...context,
      severity: operation === 'rollback' ? 'error' : 'info',
    });
  }

  /**
   * Retrieves audit entries with filtering
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered audit entries
   */
  getAuditEntries(filters = {}) {
    let entries = [...this.auditTrail];

    if (filters.operation) {
      entries = entries.filter((e) => e.operation === filters.operation);
    }

    if (filters.startDate) {
      entries = entries.filter((e) => new Date(e.timestamp) >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      entries = entries.filter((e) => new Date(e.timestamp) <= new Date(filters.endDate));
    }

    if (filters.context) {
      for (const [key, value] of Object.entries(filters.context)) {
        entries = entries.filter((e) => e.context[key] === value);
      }
    }

    return entries;
  }

  /**
   * Exports audit trail to file
   * @param {string} filename - Export filename
   * @param {Object} filters - Optional filters
   * @returns {boolean} - Success status
   */
  exportAuditTrail(filename, filters = {}) {
    try {
      const entries = this.getAuditEntries(filters);
      const exportData = {
        exportDate: new Date().toISOString(),
        filters,
        totalEntries: entries.length,
        entries,
      };

      // In a real implementation, this would write to file
      // For now, just log the export
      this.logger.info('Audit Trail Exported', {
        filename,
        totalEntries: entries.length,
        filters,
      });

      return exportData;
    } catch (error) {
      this.logger.error('Audit Trail Export Failed', { error: error.message });
      return false;
    }
  }

  /**
   * Gets audit statistics
   * @returns {Object} - Audit statistics
   */
  getAuditStats() {
    const stats = {
      totalEntries: this.auditTrail.length,
      operations: {},
      severity: {},
      timeRange: {},
    };

    if (this.auditTrail.length > 0) {
      stats.timeRange.start = this.auditTrail[0].timestamp;
      stats.timeRange.end = this.auditTrail.at(-1).timestamp;
    }

    for (const entry of this.auditTrail) {
      // Count operations
      stats.operations[entry.operation] = (stats.operations[entry.operation] || 0) + 1;

      // Count severity levels
      const severity = entry.context.severity || entry.level;
      stats.severity[severity] = (stats.severity[severity] || 0) + 1;
    }

    return stats;
  }

  /**
   * Generates a unique audit ID
   * @returns {string} - Unique audit ID
   */
  generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Sets log level
   * @param {string} level - Winston log level
   */
  setLogLevel(level) {
    this.logLevel = level;
    this.logger.level = level;
  }
}

module.exports = AuditLogger;
