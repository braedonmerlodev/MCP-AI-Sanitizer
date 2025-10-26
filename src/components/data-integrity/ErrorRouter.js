/**
 * ErrorRouter handles error queuing and routing logic for invalid records.
 * Routes validation failures to appropriate error queues for manual review.
 */
class ErrorRouter {
  constructor() {
    // Define error categories and their routing rules
    this.errorCategories = {
      schema: {
        queue: 'schema-validation-errors',
        priority: 'high',
        retryable: true,
        maxRetries: 3,
      },
      referential: {
        queue: 'referential-integrity-errors',
        priority: 'high',
        retryable: true,
        maxRetries: 2,
      },
      null_value: {
        queue: 'null-value-errors',
        priority: 'medium',
        retryable: false,
        maxRetries: 0,
      },
      cryptographic: {
        queue: 'cryptographic-errors',
        priority: 'critical',
        retryable: false,
        maxRetries: 0,
      },
      atomic_operation: {
        queue: 'atomic-operation-errors',
        priority: 'high',
        retryable: true,
        maxRetries: 1,
      },
    };

    // In-memory error queues (in real implementation, this would be a database)
    this.queues = new Map();
    this.errorCounters = new Map();
  }

  /**
   * Routes a validation error to the appropriate queue
   * @param {Object} errorRecord - Error record with details
   * @returns {Object} - Routing result
   */
  async routeError(errorRecord) {
    try {
      const category = this.categorizeError(errorRecord);
      const routingRule = this.errorCategories[category];

      if (!routingRule) {
        return {
          success: false,
          error: `Unknown error category: ${category}`,
          category,
        };
      }

      const queueId = await this.queueError(errorRecord, routingRule);

      // Update error counters
      this.incrementCounter(category);

      return {
        success: true,
        queueId,
        category,
        priority: routingRule.priority,
        retryable: routingRule.retryable,
        maxRetries: routingRule.maxRetries,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error routing failed: ${error.message}`,
        originalError: errorRecord,
      };
    }
  }

  /**
   * Categorizes an error based on its type and details
   * @param {Object} errorRecord - Error record
   * @returns {string} - Error category
   */
  categorizeError(errorRecord) {
    const { errorType, details } = errorRecord;

    // Direct category match
    if (this.errorCategories[errorType]) {
      return errorType;
    }

    // Infer category from error details
    if (details) {
      if (details.errors && Array.isArray(details.errors)) {
        // Schema validation errors
        return 'schema';
      }

      if (details.field && details.rule) {
        // Referential integrity errors
        return 'referential';
      }

      if (details.nullFields && details.nullFields.length > 0) {
        // Null value errors
        return 'null_value';
      }

      if (details.error && details.error.includes('hash')) {
        // Cryptographic errors
        return 'cryptographic';
      }
    }

    // Default category
    return 'schema';
  }

  /**
   * Queues an error record
   * @param {Object} errorRecord - Error record
   * @param {Object} routingRule - Routing rule
   * @returns {string} - Queue entry ID
   */
  async queueError(errorRecord, routingRule) {
    const queueName = routingRule.queue;
    const queueEntry = {
      id: this.generateId(),
      errorRecord,
      routingRule,
      queuedAt: new Date().toISOString(),
      status: 'queued',
      retryCount: 0,
      lastAttempt: null,
      resolvedAt: null,
    };

    // Initialize queue if it doesn't exist
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    // Add to queue
    this.queues.get(queueName).push(queueEntry);

    return queueEntry.id;
  }

  /**
   * Retrieves errors from a specific queue
   * @param {string} queueName - Queue name
   * @param {Object} options - Retrieval options
   * @returns {Array} - Error records
   */
  getQueuedErrors(queueName, options = {}) {
    const { limit = 10, priority, status = 'queued' } = options;

    if (!this.queues.has(queueName)) {
      return [];
    }

    let errors = this.queues
      .get(queueName)
      .filter(
        (error) =>
          error.status === status && (!priority || error.routingRule.priority === priority),
      );

    // Sort by priority (critical > high > medium)
    const priorityOrder = { critical: 3, high: 2, medium: 1 };
    errors.sort(
      (a, b) => priorityOrder[b.routingRule.priority] - priorityOrder[a.routingRule.priority],
    );

    return errors.slice(0, limit);
  }

  /**
   * Marks an error as resolved
   * @param {string} queueId - Queue entry ID
   * @param {string} resolution - Resolution details
   * @returns {boolean} - Success status
   */
  resolveError(queueId, resolution = '') {
    for (const [, queue] of this.queues) {
      const errorIndex = queue.findIndex((error) => error.id === queueId);
      if (errorIndex !== -1) {
        queue[errorIndex].status = 'resolved';
        queue[errorIndex].resolvedAt = new Date().toISOString();
        queue[errorIndex].resolution = resolution;
        return true;
      }
    }
    return false;
  }

  /**
   * Retries a failed error processing
   * @param {string} queueId - Queue entry ID
   * @returns {Object} - Retry result
   */
  retryError(queueId) {
    for (const [, queue] of this.queues) {
      const error = queue.find((error) => error.id === queueId);
      if (error) {
        if (error.retryCount >= error.routingRule.maxRetries) {
          return {
            success: false,
            error: 'Max retries exceeded',
            retryCount: error.retryCount,
          };
        }

        error.retryCount++;
        error.lastAttempt = new Date().toISOString();
        error.status = 'queued'; // Reset to queued for retry

        return {
          success: true,
          retryCount: error.retryCount,
          maxRetries: error.routingRule.maxRetries,
        };
      }
    }

    return {
      success: false,
      error: 'Error not found',
    };
  }

  /**
   * Gets error statistics
   * @returns {Object} - Error statistics
   */
  getErrorStats() {
    const stats = {
      totalQueued: 0,
      totalResolved: 0,
      totalFailed: 0,
      byCategory: {},
      byQueue: {},
    };

    for (const [queueName, queue] of this.queues) {
      stats.byQueue[queueName] = {
        total: queue.length,
        queued: queue.filter((e) => e.status === 'queued').length,
        resolved: queue.filter((e) => e.status === 'resolved').length,
        failed: queue.filter((e) => e.status === 'failed').length,
      };

      stats.totalQueued += stats.byQueue[queueName].queued;
      stats.totalResolved += stats.byQueue[queueName].resolved;
      stats.totalFailed += stats.byQueue[queueName].failed;
    }

    for (const [category, count] of this.errorCounters) {
      stats.byCategory[category] = count;
    }

    return stats;
  }

  /**
   * Generates a unique ID for queue entries
   * @returns {string} - Unique ID
   */
  generateId() {
    return `err_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Increments error counter for a category
   * @param {string} category - Error category
   */
  incrementCounter(category) {
    this.errorCounters.set(category, (this.errorCounters.get(category) || 0) + 1);
  }

  /**
   * Adds a custom error category
   * @param {string} name - Category name
   * @param {Object} rule - Routing rule
   */
  addErrorCategory(name, rule) {
    this.errorCategories[name] = rule;
  }
}

module.exports = ErrorRouter;
