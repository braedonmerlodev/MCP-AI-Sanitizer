const SchemaValidator = require('./data-integrity/SchemaValidator');
const ReferentialChecker = require('./data-integrity/ReferentialChecker');
const CryptographicHasher = require('./data-integrity/CryptographicHasher');
const ErrorRouter = require('./data-integrity/ErrorRouter');
const AuditLogger = require('./data-integrity/AuditLogger');
const AtomicOperations = require('./data-integrity/AtomicOperations');
const ReadOnlyAccessControl = require('./data-integrity/ReadOnlyAccessControl');

/**
 * DataIntegrityValidator provides comprehensive data integrity validation for all processed content.
 * Ensures strict quality, auditability, and security standards in the sanitized data layer.
 */
class DataIntegrityValidator {
  constructor(options = {}) {
    // Initialize sub-components
    this.schemaValidator = new SchemaValidator();
    this.referentialChecker = new ReferentialChecker();
    this.cryptoHasher = new CryptographicHasher();
    this.errorRouter = new ErrorRouter();
    this.auditLogger = new AuditLogger(options.auditOptions || {});
    this.atomicOps = new AtomicOperations(options.atomicOptions || {});
    this.accessControl = new ReadOnlyAccessControl(options.accessOptions || {});

    // Configuration
    this.enableAuditing = options.enableAuditing !== false;
    this.failOnFirstError = options.failOnFirstError || false;
    this.maxValidationTime = options.maxValidationTime || 5000; // 5 seconds
  }

  /**
   * Validates data integrity comprehensively
   * @param {any} data - Data to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Comprehensive validation result
   */
  async validateData(data, options = {}) {
    const startTime = Date.now();
    const validationId = this.generateValidationId();

    try {
      // Initialize validation result
      const result = {
        validationId,
        isValid: true,
        errors: [],
        warnings: [],
        details: {},
        metadata: {
          startTime: new Date().toISOString(),
          dataType: typeof data,
          dataSize: this.calculateDataSize(data),
        },
      };

      // 1. Schema Validation
      const schemaResult = this.schemaValidator.validate(data, options.schema);
      result.details.schema = schemaResult;

      if (!schemaResult.isValid) {
        result.errors.push(...schemaResult.errors);
        if (this.failOnFirstError) {
          result.isValid = false;
          return this.finalizeResult(result, startTime);
        }
      }

      // 2. Referential Integrity Check (if data is an object)
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const referentialResult = await this.referentialChecker.checkReferentialIntegrity(
          data,
          options.referentialFields,
        );
        result.details.referential = referentialResult;

        if (!referentialResult.isValid) {
          result.errors.push('Referential integrity violations detected');
          result.details.referentialErrors = referentialResult.fieldResults;
          if (this.failOnFirstError) {
            result.isValid = false;
            return this.finalizeResult(result, startTime);
          }
        }

        // 3. Critical Fields Check
        const criticalResult = this.referentialChecker.checkCriticalFields(
          data,
          options.additionalCriticalFields,
        );
        result.details.criticalFields = criticalResult;

        if (!criticalResult.isValid) {
          result.errors.push(`Critical fields are null: ${criticalResult.nullFields.join(', ')}`);
          if (this.failOnFirstError) {
            result.isValid = false;
            return this.finalizeResult(result, startTime);
          }
        }
      }

      // 4. Generate Hash References for Lineage Tracking
      try {
        const hashReference = this.cryptoHasher.createHashReference(
          data,
          data, // For now, raw and sanitized are the same; in pipeline this would differ
          { validationId, source: options.source || 'unknown' },
        );
        result.details.hashReference = hashReference;
      } catch (hashError) {
        console.log('Hash generation error:', hashError);
        result.errors.push(`Hash generation failed: ${hashError.message}`);
        result.warnings.push('Data lineage tracking unavailable');
        // Set a dummy hashReference for testing
        result.details.hashReference = {
          algorithm: 'sha256',
          dataHash: 'dummy',
          error: hashError.message,
        };
      }

      // Determine overall validity
      result.isValid = result.errors.length === 0;

      // Route errors if validation failed
      if (!result.isValid) {
        const routingResult = await this.errorRouter.routeError({
          validationId,
          data,
          errors: result.errors,
          details: result.details,
          timestamp: new Date().toISOString(),
        });

        result.details.errorRouting = routingResult;

        if (!routingResult.success) {
          result.warnings.push('Error routing failed');
        }
      }

      // Audit the validation operation
      if (this.enableAuditing) {
        this.auditLogger.logValidation(result, {
          validationId,
          dataType: result.metadata.dataType,
          source: options.source,
        });
      }

      return this.finalizeResult(result, startTime);
    } catch (error) {
      // Handle unexpected validation errors
      const errorResult = {
        validationId,
        isValid: false,
        errors: [`Validation system error: ${error.message}`],
        warnings: [],
        details: { unexpectedError: error.message },
        metadata: {
          startTime: new Date().toISOString(),
          error: true,
        },
      };

      // Route the system error
      await this.errorRouter.routeError({
        validationId,
        errorType: 'system_error',
        details: { error: error.message },
        timestamp: new Date().toISOString(),
      });

      return this.finalizeResult(errorResult, startTime);
    }
  }

  /**
   * Generates cryptographic hash for data lineage
   * @param {any} data - Data to hash
   * @param {Object} options - Hash options
   * @returns {string} - Generated hash
   */
  generateHash(data, options = {}) {
    try {
      const hash = this.cryptoHasher.generateHash(
        typeof data === 'string' ? data : JSON.stringify(data),
        options.salt,
      );

      if (this.enableAuditing) {
        this.auditLogger.logHashOperation(
          'generate',
          {
            algorithm: this.cryptoHasher.algorithm,
            success: true,
            dataSize: this.calculateDataSize(data),
          },
          options.context || {},
        );
      }

      return hash;
    } catch (error) {
      if (this.enableAuditing) {
        this.auditLogger.logHashOperation(
          'generate',
          {
            success: false,
            error: error.message,
          },
          options.context || {},
        );
      }
      throw error;
    }
  }

  /**
   * Verifies data against a hash or hash reference
   * @param {any} data - Data to verify
   * @param {string|Object} hashOrReference - Hash string or hash reference object
   * @returns {boolean} - Verification result
   */
  verifyHash(data, hashOrReference) {
    try {
      const result =
        typeof hashOrReference === 'string'
          ? { isValid: this.cryptoHasher.verifyHash(data, hashOrReference) }
          : this.cryptoHasher.verifyDataLineage(data, hashOrReference);

      if (this.enableAuditing) {
        const auditData = {
          success: result.isValid,
          algorithm: typeof hashOrReference === 'string' ? 'sha256' : hashOrReference.algorithm,
        };
        const context =
          typeof hashOrReference === 'object' && hashOrReference.id
            ? { hashReferenceId: hashOrReference.id }
            : {};

        this.auditLogger.logHashOperation('verify', auditData, context);
      }

      return result.isValid;
    } catch (error) {
      if (this.enableAuditing) {
        this.auditLogger.logHashOperation('verify', { success: false, error: error.message }, {});
      }
      return false;
    }
  }

  /**
   * Routes an error for manual review
   * @param {Object} errorRecord - Error details
   * @returns {Object} - Routing result
   */
  async routeError(errorRecord) {
    const result = await this.errorRouter.routeError(errorRecord);

    if (this.enableAuditing) {
      this.auditLogger.logErrorRouting(result, {
        errorId: result.queueId,
        category: result.category,
      });
    }

    return result;
  }

  /**
   * Logs access to raw data (security-critical operation)
   * @param {string} resourceId - Resource being accessed
   * @param {string} accessType - Type of access
   * @param {Object} context - Access context
   */
  logRawDataAccess(resourceId, accessType, context = {}) {
    if (this.enableAuditing) {
      this.auditLogger.logRawDataAccess(resourceId, accessType, context);
    }
  }

  /**
   * Gets validation statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      errorStats: this.errorRouter.getErrorStats(),
      auditStats: this.auditLogger.getAuditStats(),
      schemaStats: {
        customSchemas: Object.keys(this.schemaValidator.schemas).length,
      },
    };
  }

  /**
   * Finalizes validation result with timing and metadata
   * @param {Object} result - Partial result
   * @param {number} startTime - Start timestamp
   * @returns {Object} - Final result
   */
  finalizeResult(result, startTime) {
    const endTime = Date.now();
    result.metadata.endTime = new Date().toISOString();
    result.metadata.duration = endTime - startTime;
    result.metadata.withinTimeLimit = result.metadata.duration <= this.maxValidationTime;

    if (!result.metadata.withinTimeLimit) {
      result.warnings.push(`Validation exceeded time limit (${this.maxValidationTime}ms)`);
    }

    return result;
  }

  /**
   * Calculates data size for metrics
   * @param {any} data - Data to measure
   * @returns {number} - Size in bytes
   */
  calculateDataSize(data) {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }
    if (typeof data === 'object' && data !== null) {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    }
    return 0;
  }

  /**
   * Generates a unique validation ID
   * @returns {string} - Validation ID
   */
  generateValidationId() {
    return `val_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Adds a custom validation schema
   * @param {string} name - Schema name
   * @param {Object} schema - Joi schema
   */
  addSchema(name, schema) {
    this.schemaValidator.addSchema(name, schema);
  }

  /**
   * Adds a referential rule
   * @param {string} field - Field name
   * @param {Object} rule - Rule definition
   */
  addReferentialRule(field, rule) {
    this.referentialChecker.addReferentialRule(field, rule);
  }

  /**
   * Adds critical fields that cannot be null
   * @param {Array} fields - Field names
   */
  addCriticalFields(fields) {
    this.referentialChecker.addCriticalFields(fields);
  }

  /**
   * Performs atomic data loading with integrity validation
   * @param {Array} dataItems - Data items to load
   * @param {Object} options - Loading options
   * @returns {Object} - Loading result
   */
  async atomicLoad(dataItems, options = {}) {
    return this.atomicOps.atomicLoad(dataItems, {
      ...options,
      validateFirst: true, // Always validate before loading
    });
  }

  /**
   * Performs temporary table swap for zero-downtime updates
   * @param {string} tableName - Target table name
   * @param {Array} newData - New data to load
   * @returns {Object} - Swap result
   */
  async temporaryTableSwap(tableName, newData) {
    return this.atomicOps.temporaryTableSwap(tableName, newData);
  }

  /**
   * Checks read access to sanitized data
   * @param {Object} user - User requesting access
   * @param {string} resourceType - Resource type
   * @param {Object} context - Access context
   * @returns {Object} - Access check result
   */
  checkReadAccess(user, resourceType = 'sanitized_data', context = {}) {
    return this.accessControl.checkReadAccess(user, resourceType, context);
  }

  /**
   * Checks write access to sanitized data (should always deny)
   * @param {Object} user - User requesting access
   * @param {string} resourceType - Resource type
   * @param {Object} context - Access context
   * @returns {Object} - Access result (denied)
   */
  checkWriteAccess(user, resourceType = 'sanitized_data', context = {}) {
    return this.accessControl.checkWriteAccess(user, resourceType, context);
  }

  /**
   * Gets access statistics
   * @returns {Object} - Access statistics
   */
  getAccessStats() {
    return this.accessControl.getAccessStats();
  }

  /**
   * Gets transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Object} - Transaction status
   */
  getTransactionStatus(transactionId) {
    return this.atomicOps.getTransactionStatus(transactionId);
  }

  /**
   * Gets all active transactions
   * @returns {Array} - Active transactions
   */
  getActiveTransactions() {
    return this.atomicOps.getActiveTransactions();
  }
}

module.exports = DataIntegrityValidator;
