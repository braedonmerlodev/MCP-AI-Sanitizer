const crypto = require('crypto');

/**
 * TrustTokenGenerator handles the creation and validation of cryptographic trust tokens
 * for sanitized content verification and reuse.
 */
class TrustTokenGenerator {
  constructor(options = {}) {
    this.secret = options.secret || process.env.TRUST_TOKEN_SECRET;
    if (!this.secret) {
      throw new Error('TRUST_TOKEN_SECRET environment variable must be set');
    }
    this.defaultExpirationHours = options.defaultExpirationHours || 24;
    this.defaultVersion = options.defaultVersion || '1.0';
  }

  /**
   * Generates a trust token for sanitized content
   * @param {string} sanitizedContent - The sanitized content
   * @param {string} originalContent - The original raw content
   * @param {string[]} rulesApplied - Array of sanitization rules applied
   * @param {Object} options - Additional options
   * @returns {Object} Trust token object
   */
  generateToken(sanitizedContent, originalContent, rulesApplied, options = {}) {
    const version = options.version || this.defaultVersion;
    const expirationHours = options.expirationHours || this.defaultExpirationHours;

    const contentHash = crypto.createHash('sha256').update(sanitizedContent).digest('hex');
    const originalHash = crypto.createHash('sha256').update(originalContent).digest('hex');
    const timestamp = new Date();
    const expiresAt = new Date(timestamp.getTime() + expirationHours * 60 * 60 * 1000);

    // Create signature payload (exclude signature itself)
    const signaturePayload = {
      contentHash,
      originalHash,
      sanitizationVersion: version,
      rulesApplied,
      timestamp: timestamp.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(JSON.stringify(signaturePayload))
      .digest('hex');

    return {
      contentHash,
      originalHash,
      sanitizationVersion: version,
      rulesApplied,
      timestamp,
      expiresAt,
      signature,
    };
  }

  /**
   * Validates a trust token for authenticity and expiration
   * @param {Object} token - The trust token to validate
   * @returns {Object} Validation result { isValid: boolean, error?: string }
   */
  validateToken(token) {
    try {
      // Check required fields
      const requiredFields = [
        'contentHash',
        'originalHash',
        'sanitizationVersion',
        'rulesApplied',
        'timestamp',
        'expiresAt',
        'signature',
      ];
      for (const field of requiredFields) {
        if (!token[field]) {
          return { isValid: false, error: `Missing required field: ${field}` };
        }
      }

      // Check expiration
      const expiresAt = new Date(token.expiresAt);
      if (expiresAt <= new Date()) {
        return { isValid: false, error: 'Token has expired' };
      }

      // Recreate signature payload
      const signaturePayload = {
        contentHash: token.contentHash,
        originalHash: token.originalHash,
        sanitizationVersion: token.sanitizationVersion,
        rulesApplied: token.rulesApplied,
        timestamp: token.timestamp,
        expiresAt: token.expiresAt,
      };

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(JSON.stringify(signaturePayload))
        .digest('hex');

      if (expectedSignature !== token.signature) {
        return { isValid: false, error: 'Invalid token signature' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Validation error: ${error.message}` };
    }
  }
}

module.exports = TrustTokenGenerator;
