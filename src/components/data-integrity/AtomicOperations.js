/**
 * AtomicOperations handles transaction management and atomic data loading.
 * Ensures all-or-nothing operations for data integrity.
 */
class AtomicOperations {
  constructor(options = {}) {
    this.transactionTimeout = options.transactionTimeout || 30_000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.isolationLevel = options.isolationLevel || 'SERIALIZABLE';
  }

  /**
   * Executes an operation within a transaction
   * @param {Function} operation - Async function to execute in transaction
   * @param {Object} context - Transaction context
   * @returns {Object} - Operation result
   */
  async executeInTransaction(operation, context = {}) {
    const transactionId = this.generateTransactionId();
    const startTime = Date.now();

    try {
      // Begin transaction
      await this.beginTransaction(transactionId, context);

      // Execute operation
      const result = await operation({
        transactionId,
        commit: () => this.commitTransaction(transactionId),
        rollback: (reason) => this.rollbackTransaction(transactionId, reason),
      });

      // Auto-commit if operation succeeded
      if (result.success === false) {
        await this.rollbackTransaction(transactionId, 'Operation failed');
        return {
          success: false,
          transactionId,
          error: result.error,
          duration: Date.now() - startTime,
        };
      } else {
        // Operation succeeded and should have called commit internally
        // Return the operation result directly, add transaction metadata
        const finalResult = {
          ...result,
          transactionId,
          duration: Date.now() - startTime,
        };
        return finalResult;
      }
    } catch (error) {
      // Rollback on error
      await this.rollbackTransaction(transactionId, error.message);
      return {
        success: false,
        transactionId,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Begins a transaction
   * @param {string} transactionId - Transaction ID
   * @param {Object} context - Transaction context
   */
  async beginTransaction(transactionId, context = {}) {
    // In a real implementation, this would start a database transaction
    // For now, we'll simulate with logging
    console.log(`Beginning transaction ${transactionId}`, {
      isolationLevel: this.isolationLevel,
      context,
    });

    // Simulate transaction setup
    this.activeTransactions = this.activeTransactions || new Map();
    this.activeTransactions.set(transactionId, {
      startTime: Date.now(),
      status: 'active',
      context,
    });
  }

  /**
   * Commits a transaction
   * @param {string} transactionId - Transaction ID
   */
  async commitTransaction(transactionId) {
    const transaction = this.activeTransactions?.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    // In a real implementation, this would commit the database transaction
    console.log(`Committing transaction ${transactionId}`);

    transaction.status = 'committed';
    transaction.endTime = Date.now();
  }

  /**
   * Rolls back a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} reason - Rollback reason
   */
  async rollbackTransaction(transactionId, reason = '') {
    const transaction = this.activeTransactions?.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status === 'committed') {
      console.log(`Cannot rollback committed transaction ${transactionId}`);
      return;
    }

    if (transaction.status !== 'active') {
      console.log(`Transaction ${transactionId} is not active (status: ${transaction.status})`);
      return;
    }

    // In a real implementation, this would rollback the database transaction
    console.log(`Rolling back transaction ${transactionId}`, { reason });

    transaction.status = 'rolled_back';
    transaction.endTime = Date.now();
    transaction.rollbackReason = reason;
  }

  /**
   * Performs atomic data loading (all-or-nothing)
   * @param {Array} dataItems - Array of data items to load
   * @param {Object} options - Loading options
   * @returns {Object} - Loading result
   */
  async atomicLoad(dataItems, options = {}) {
    const { batchSize = 100, validateFirst = true } = options;

    return this.executeInTransaction(async ({ transactionId, commit, rollback }) => {
      try {
        const results = {
          loaded: 0,
          failed: 0,
          total: dataItems.length,
        };

        // Process in batches for memory efficiency
        for (let i = 0; i < dataItems.length; i += batchSize) {
          const batch = dataItems.slice(i, i + batchSize);

          // Validate batch if requested
          if (validateFirst) {
            for (const item of batch) {
              if (!this.validateDataItem(item)) {
                results.failed++;
                continue;
              }
            }
          }

          // Load batch
          const batchResults = await this.loadBatch(batch, transactionId);
          results.loaded += batchResults.loaded;
          results.failed += batchResults.failed;

          // If any failures in batch, rollback entire operation
          if (batchResults.failed > 0) {
            await rollback('Batch loading failed');
            return { success: false, error: 'Batch loading failed', result: results };
          }
        }

        await commit();
        return { success: true, result: results };
      } catch (error) {
        await rollback(error.message);
        return { success: false, error: error.message, result: null };
      }
    });
  }

  /**
   * Loads a batch of data items
   * @param {Array} batch - Batch of data items
   * @param {string} transactionId - Transaction ID
   * @returns {Object} - Batch loading result
   */
  async loadBatch(batch, transactionId) {
    // In a real implementation, this would bulk insert to database
    // For simulation, we'll just count
    console.log(`Loading batch of ${batch.length} items in transaction ${transactionId}`);

    // Simulate loading - no failures for testing
    const failed = 0;
    const loaded = batch.length;

    return { loaded, failed };
  }

  /**
   * Validates a data item before loading
   * @param {Object} item - Data item to validate
   * @returns {boolean} - Validation result
   */
  validateDataItem(item) {
    // Basic validation - check required fields
    return item && typeof item === 'object' && item.id && item.timestamp;
  }

  /**
   * Creates a temporary table swap for zero-downtime updates
   * @param {string} tableName - Target table name
   * @param {Array} newData - New data to load
   * @returns {Object} - Swap result
   */
  async temporaryTableSwap(tableName, newData) {
    const tempTableName = `${tableName}_temp_${Date.now()}`;

    return this.executeInTransaction(async ({ commit, rollback }) => {
      try {
        // Create temporary table
        await this.createTemporaryTable(tempTableName, tableName);

        // Load data into temporary table
        const loadResult = await this.atomicLoad(newData, { validateFirst: true });
        if (!loadResult.success) {
          await rollback('Data loading failed');
          return loadResult;
        }

        // Validate temporary table
        const validationResult = await this.validateTemporaryTable(tempTableName);
        if (!validationResult.valid) {
          await rollback('Temporary table validation failed');
          return { success: false, error: 'Validation failed', details: validationResult };
        }

        // Swap tables (rename operations)
        await this.swapTables(tableName, tempTableName);

        await commit();
        return {
          success: true,
          message: `Successfully swapped ${tableName} with ${newData.length} records`,
        };
      } catch (error) {
        await rollback(error.message);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Creates a temporary table
   * @param {string} tempTableName - Temporary table name
   * @param {string} sourceTableName - Source table to copy structure from
   */
  async createTemporaryTable(tempTableName, sourceTableName) {
    // In a real implementation, this would create a temp table
    console.log(`Creating temporary table ${tempTableName} from ${sourceTableName}`);
  }

  /**
   * Validates temporary table contents
   * @param {string} tempTableName - Temporary table name
   * @returns {Object} - Validation result
   */
  async validateTemporaryTable(tempTableName) {
    // In a real implementation, this would run validation queries
    console.log(`Validating temporary table ${tempTableName}`);
    return { valid: true };
  }

  /**
   * Swaps tables atomically
   * @param {string} oldTable - Old table name
   * @param {string} newTable - New table name
   */
  async swapTables(oldTable, newTable) {
    // In a real implementation, this would rename tables
    console.log(`Swapping tables: ${oldTable} <-> ${newTable}`);
  }

  /**
   * Generates a unique transaction ID
   * @returns {string} - Transaction ID
   */
  generateTransactionId() {
    return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Gets active transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Object} - Transaction status
   */
  getTransactionStatus(transactionId) {
    return this.activeTransactions?.get(transactionId) || null;
  }

  /**
   * Gets all active transactions
   * @returns {Array} - Active transactions
   */
  getActiveTransactions() {
    return [...(this.activeTransactions?.values() || [])];
  }
}

module.exports = AtomicOperations;
