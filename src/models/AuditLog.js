const crypto = require('node:crypto');

/**
 * AuditLog model represents comprehensive audit entries for data integrity operations.
 * Provides tamper-proof audit records with cryptographic verification.
 */
class AuditLog {
  constructor(data = {}, options = {}) {
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

    // Sanitization-specific fields
    this.destination = data.destination;
    this.riskLevel = data.riskLevel;
    this.sanitizationLevel = data.sanitizationLevel;

    // High-risk ML-optimized fields
    this.threatPatternId = data.threatPatternId;
    this.confidenceScore = data.confidenceScore;
    this.mitigationActions = data.mitigationActions || [];
    this.featureVector = data.featureVector || {};
    this.trainingLabels = data.trainingLabels || {};
    this.anomalyScore = data.anomalyScore;
    this.detectionTimestamp = data.detectionTimestamp;
    this.riskCategory = data.riskCategory;

    // HITL escalation fields
    this.escalationId = data.escalationId;
    this.humanDecision = data.humanDecision || {};
    this.resolutionTime = data.resolutionTime;
    this.effectivenessScore = data.effectivenessScore;

    // High-fidelity data collection fields for AI training
    this.inputDataHash = data.inputDataHash;
    this.processingSteps = data.processingSteps || [];
    this.decisionOutcome = data.decisionOutcome || {};
    this.contextMetadata = data.contextMetadata || {};

    // Tamper-proofing with HMAC signature
    this.secret =
      options.secret || process.env.AUDIT_SECRET || 'default-audit-secret-change-in-production';
    this.signature = data.signature || this.generateSignature();
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
    const criticalActions = [
      'raw_data_access',
      'cryptographic_operation',
      'validation_failure',
      'trust_token_validation_failed',
      'access_denied',
      'data_sanitization_applied',
      'data_sanitization_bypassed',
    ];
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
      sanitization: [
        'data_sanitization_applied',
        'data_sanitization_bypassed',
        'content_sanitization_completed',
      ],
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
      destination: this.destination,
      riskLevel: this.riskLevel,
      sanitizationLevel: this.sanitizationLevel,
      threatPatternId: this.threatPatternId,
      confidenceScore: this.confidenceScore,
      mitigationActions: this.mitigationActions,
      featureVector: this.featureVector,
      trainingLabels: this.trainingLabels,
      anomalyScore: this.anomalyScore,
      detectionTimestamp: this.detectionTimestamp,
      riskCategory: this.riskCategory,
      escalationId: this.escalationId,
      humanDecision: this.humanDecision,
      resolutionTime: this.resolutionTime,
      effectivenessScore: this.effectivenessScore,
      inputDataHash: this.inputDataHash,
      processingSteps: this.processingSteps,
      decisionOutcome: this.decisionOutcome,
      contextMetadata: this.contextMetadata,
      signature: this.signature,
    };
  }

  /**
   * Generates HMAC signature for tamper-proofing
   * @returns {string} - HMAC signature
   */
  generateSignature() {
    const payload = {
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
      destination: this.destination,
      riskLevel: this.riskLevel,
      sanitizationLevel: this.sanitizationLevel,
      threatPatternId: this.threatPatternId,
      confidenceScore: this.confidenceScore,
      mitigationActions: this.mitigationActions,
      featureVector: this.featureVector,
      trainingLabels: this.trainingLabels,
      anomalyScore: this.anomalyScore,
      detectionTimestamp: this.detectionTimestamp,
      riskCategory: this.riskCategory,
      escalationId: this.escalationId,
      humanDecision: this.humanDecision,
      resolutionTime: this.resolutionTime,
      effectivenessScore: this.effectivenessScore,
      inputDataHash: this.inputDataHash,
      processingSteps: this.processingSteps,
      decisionOutcome: this.decisionOutcome,
      contextMetadata: this.contextMetadata,
    };

    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', this.secret).update(payloadString).digest('hex');
  }

  /**
   * Verifies the HMAC signature for tamper-proofing
   * @returns {boolean} - True if signature is valid
   */
  verifySignature() {
    const expectedSignature = this.generateSignature();
    return crypto.timingSafeEqual(
      Buffer.from(this.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  /**
   * Creates AuditLog from plain object
   * @param {Object} obj - Plain object
   * @param {Object} options - Options including secret
   * @returns {AuditLog} - AuditLog instance
   */
  static fromObject(obj, options = {}) {
    return new AuditLog(obj, options);
  }
}

module.exports = AuditLog;
