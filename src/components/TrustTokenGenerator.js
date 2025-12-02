const crypto = require('node:crypto');

// LRU cache for trust token validation
const trustTokenCache = new Map();
const trustTokenCacheOrder = [];
const trustTokenCacheMaxSize = Number.parseInt(process.env.TRUST_TOKEN_CACHE_MAX_SIZE) || 1000;
const trustTokenCacheTTL = Number.parseInt(process.env.TRUST_TOKEN_CACHE_TTL_MS) || 10 * 60 * 1000; // 10 minutes

function getCachedValidation(signature) {
  const now = Date.now();
  const cached = trustTokenCache.get(signature);
  if (cached && cached.timestamp + trustTokenCacheTTL > now) {
    // Move to end for LRU
    const index = trustTokenCacheOrder.indexOf(signature);
    if (index !== -1) {
      trustTokenCacheOrder.splice(index, 1);
      trustTokenCacheOrder.push(signature);
    }
    return cached.result;
  } else {
    if (cached) {
      // Expired, remove
      trustTokenCache.delete(signature);
      const index = trustTokenCacheOrder.indexOf(signature);
      if (index !== -1) trustTokenCacheOrder.splice(index, 1);
    }
    return null;
  }
}

function setCachedValidation(signature, result) {
  const now = Date.now();
  trustTokenCache.set(signature, { result, timestamp: now });
  trustTokenCacheOrder.push(signature);
  if (trustTokenCache.size > trustTokenCacheMaxSize) {
    const oldest = trustTokenCacheOrder.shift();
    trustTokenCache.delete(oldest);
  }
}

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
    const nonce = Math.random().toString(36).slice(2);

    // Create signature payload (exclude signature itself)
    const signaturePayload = {
      contentHash,
      originalHash,
      sanitizationVersion: version,
      rulesApplied,
      timestamp: timestamp.toISOString(),
      expiresAt: expiresAt.toISOString(),
      nonce,
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
      timestamp: timestamp.toISOString(),
      expiresAt: expiresAt.toISOString(),
      signature,
      nonce,
    };
  }

  /**
   * Validates a trust token for authenticity and expiration
   * @param {Object} token - The trust token to validate
   * @returns {Object} Validation result { isValid: boolean, error?: string }
   */
  validateToken(token) {
    try {
      // Check cache first
      if (token.signature) {
        const cached = getCachedValidation(token.signature);
        if (cached) {
          return cached;
        }
      }

      // Check required fields
      const requiredFields = [
        'contentHash',
        'originalHash',
        'sanitizationVersion',
        'rulesApplied',
        'timestamp',
        'expiresAt',
        'signature',
        'nonce',
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
        nonce: token.nonce,
      };

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(JSON.stringify(signaturePayload))
        .digest('hex');

      if (expectedSignature !== token.signature) {
        return { isValid: false, error: 'Invalid token signature' };
      }

      // Valid, cache it
      setCachedValidation(token.signature, { isValid: true });

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Validation error: ${error.message}` };
    }
  }
}

module.exports = TrustTokenGenerator;
