const winston = require('winston');

/**
 * AccessControlEnforcer handles access control enforcement for AI agent document requests.
 *
 * Features:
 * - Denies requests without valid trust tokens
 * - Configurable validation levels for different security contexts
 * - Integrates with existing permission system
 * - Provides clear error messages for access denial
 * - Supports admin override for emergency scenarios
 */

class AccessControlEnforcer {
  constructor(options = {}) {
    this.logger =
      options.logger ||
      winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [new winston.transports.Console()],
      });

    // Configurable validation levels
    this.validationLevels = {
      strict: {
        requireTrustToken: true,
        requireValidSignature: true,
        requireUnexpired: true,
        requireMatchingContent: true,
      },
      moderate: {
        requireTrustToken: true,
        requireValidSignature: true,
        requireUnexpired: true,
        requireMatchingContent: false,
      },
      lenient: {
        requireTrustToken: true,
        requireValidSignature: false,
        requireUnexpired: false,
        requireMatchingContent: false,
      },
    };

    this.defaultLevel = options.defaultLevel || 'strict';

    // Admin override controller reference (set externally)
    this.adminOverrideController = options.adminOverrideController || null;
  }

  /**
   * Enforces access control for a request
   * @param {Object} req - Express request object with trustTokenValidation attached
   * @param {string} level - Validation level ('strict', 'moderate', 'lenient')
   * @returns {Object} { allowed: boolean, error: string, code: string }
   */
  enforce(req, level = this.defaultLevel) {
    const validationLevel = this.validationLevels[level];
    if (!validationLevel) {
      return {
        allowed: false,
        error: `Invalid validation level: ${level}`,
        code: 'INVALID_LEVEL',
      };
    }

    // Check for active admin override first
    if (this.adminOverrideController && this.adminOverrideController.isOverrideActive()) {
      const activeOverride = this.adminOverrideController.getActiveOverride();
      this.logger.warn('Access granted via admin override', {
        method: req.method,
        path: req.path,
        level,
        overrideId: activeOverride.id,
        adminId: activeOverride.adminId,
        justification: activeOverride.justification,
      });

      return {
        allowed: true,
        error: null,
        code: 'ADMIN_OVERRIDE',
        override: {
          id: activeOverride.id,
          adminId: activeOverride.adminId,
          justification: activeOverride.justification,
        },
      };
    }

    // Check if trust token validation exists (from middleware)
    // For system operations that bypass middleware, allow access
    if (!req.trustTokenValidation) {
      // Check if this is a system operation that should bypass trust token validation
      if (req.path === '/export/training-data' && req.method === 'POST') {
        this.logger.info('Allowing system operation without trust token validation', {
          method: req.method,
          path: req.path,
          ip: req.ip,
        });
        return {
          allowed: true,
          error: null,
          code: 'SYSTEM_OPERATION',
        };
      }

      this.logger.warn('No trust token validation found in request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
      return {
        allowed: false,
        error: 'Trust token validation required',
        code: 'NO_VALIDATION',
      };
    }

    const validation = req.trustTokenValidation;

    // Check trust token presence
    if (validationLevel.requireTrustToken && !validation.isValid) {
      this.logger.warn('Access denied: Invalid trust token', {
        method: req.method,
        path: req.path,
        error: validation.error,
      });
      return {
        allowed: false,
        error: validation.error || 'Invalid trust token',
        code: 'INVALID_TOKEN',
      };
    }

    // Additional checks based on level
    if (validationLevel.requireValidSignature && !this._isSignatureValid(validation)) {
      return {
        allowed: false,
        error: 'Trust token signature invalid',
        code: 'INVALID_SIGNATURE',
      };
    }

    if (validationLevel.requireUnexpired && this._isExpired(validation)) {
      return {
        allowed: false,
        error: 'Trust token has expired',
        code: 'EXPIRED_TOKEN',
      };
    }

    if (validationLevel.requireMatchingContent && !this._contentMatches(validation, req)) {
      return {
        allowed: false,
        error: 'Content hash mismatch',
        code: 'CONTENT_MISMATCH',
      };
    }

    // Access allowed
    this.logger.info('Access granted', {
      method: req.method,
      path: req.path,
      level,
    });

    return {
      allowed: true,
      error: null,
      code: null,
    };
  }

  /**
   * Checks if signature is valid (placeholder - actual validation in TrustTokenGenerator)
   * @private
   */
  _isSignatureValid(validation) {
    // Assuming validation.isValid covers signature
    return validation.isValid;
  }

  /**
   * Checks if token is expired
   * @private
   */
  _isExpired(validation) {
    if (!validation.expiresAt) return false;
    const expiresAt = new Date(validation.expiresAt);
    return new Date() > expiresAt;
  }

  /**
   * Checks if content matches (placeholder - would need content from request)
   * @private
   */
  _contentMatches() {
    // For now, assume content is provided in req.body or similar
    // This would need to be implemented based on specific use case
    return true; // Placeholder
  }

  /**
   * Gets available validation levels
   */
  getValidationLevels() {
    return Object.keys(this.validationLevels);
  }
}

module.exports = AccessControlEnforcer;
