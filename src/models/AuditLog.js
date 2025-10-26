/**
 * AuditLog model represents comprehensive audit entries for data integrity operations.
 */
class AuditLog {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.userId = data.userId;
    this.action = data.action || 'unknown';
    this.resourceId = data.resourceId;
    this.details = data.details || {};
    this.ipAddress = data.ipAddress;
    this.userAgent = data.userAgent;
    this.sessionId = data.sessionId;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * Generates a unique ID for the audit log entry
   * @returns {string} - Unique ID
   */
  generateId() {
    return `al_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Checks if this is a security-critical action
   * @returns {boolean} - True if security-critical
   */
  isSecurityCritical() {
    const criticalActions = ['raw_data_access', 'cryptographic_operation', 'validation_failure'];
    return criticalActions.includes(this.action);
  }

  /**
   * Gets action category
   * @returns {string} - Category
   */
  getCategory() {
    const categories = {
      validation: ['validation', 'schema_check', 'referential_check'],
      cryptographic: ['hash_generate', 'hash_verify', 'cryptographic_operation'],
      access: ['raw_data_access', 'data_export', 'audit_access'],
      error: ['validation_failure', 'system_error'],
    };

    for (const [category, actions] of Object.entries(categories)) {
      if (actions.includes(this.action)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Converts to plain object for storage/serialization
   * @returns {Object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      userId: this.userId,
      action: this.action,
      resourceId: this.resourceId,
      details: this.details,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      sessionId: this.sessionId,
      createdAt: this.createdAt,
    };
  }

  /**
   * Creates AuditLog from plain object
   * @param {Object} obj - Plain object
   * @returns {AuditLog} - AuditLog instance
   */
  static fromObject(obj) {
    return new AuditLog(obj);
  }
}

module.exports = AuditLog;
