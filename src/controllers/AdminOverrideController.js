const winston = require('winston');
const AuditLoggerAccess = require('../components/AuditLoggerAccess');

/**
 * AdminOverrideController handles emergency admin override capabilities.
 *
 * Features:
 * - Time-limited override activation/deactivation
 * - Elevated admin authentication
 * - Comprehensive audit logging
 * - Automatic expiration
 * - Abuse prevention mechanisms
 */

class AdminOverrideController {
  constructor(options = {}) {
    this.logger =
      options.logger ||
      winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [new winston.transports.Console()],
      });

    // Override configuration
    this.defaultDuration = options.defaultDuration || 15 * 60 * 1000; // 15 minutes in ms
    this.maxDuration = options.maxDuration || 60 * 60 * 1000; // 1 hour max
    this.maxConcurrentOverrides = options.maxConcurrentOverrides || 1; // Limit concurrent overrides

    // In-memory override state (in production, use Redis or database)
    this.activeOverrides = new Map(); // overrideId -> { adminId, startTime, endTime, justification }

    // Audit logger
    this.auditLogger = new AuditLoggerAccess({
      secret:
        options.auditSecret ||
        process.env.AUDIT_SECRET ||
        'default-audit-secret-change-in-production',
    });

    // Admin authentication (simplified - in production use proper auth system)
    this.adminAuthSecret =
      options.adminAuthSecret ||
      process.env.ADMIN_AUTH_SECRET ||
      'admin-secret-change-in-production';
  }

  /**
   * Authenticates admin user
   * @param {Object} req - Express request
   * @returns {Object} { isValid: boolean, adminId: string, error: string }
   */
  authenticateAdmin(req) {
    const authHeader = req.headers['x-admin-auth'];

    if (!authHeader) {
      return { isValid: false, error: 'Admin authentication required' };
    }

    // Simple secret-based auth (replace with proper JWT/OAuth in production)
    if (authHeader !== this.adminAuthSecret) {
      return { isValid: false, error: 'Invalid admin credentials' };
    }

    // Extract admin ID from request (could be from JWT claims)
    const adminId = req.headers['x-admin-id'] || 'admin-user';

    return { isValid: true, adminId };
  }

  /**
   * Activates admin override
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  activateOverride(req, res) {
    try {
      // Clean expired overrides first
      this._cleanExpiredOverrides();

      // Authenticate admin
      const auth = this.authenticateAdmin(req);
      if (!auth.isValid) {
        this.logger.warn('Admin override activation failed: authentication', {
          error: auth.error,
          ip: req.ip,
        });

        // Audit failed attempt
        this.auditLogger.logAccessEnforcement(
          'admin-override',
          false,
          'admin',
          {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
          {
            userId: req.headers['x-admin-id'] || 'unknown',
            reason: auth.error,
          },
        );

        return res.status(401).json({
          error: 'Authentication failed',
          message: auth.error,
        });
      }

      const adminId = auth.adminId;

      // Check concurrent override limit
      if (this.activeOverrides.size >= this.maxConcurrentOverrides) {
        this.logger.warn('Admin override activation failed: concurrent limit exceeded', {
          adminId,
          activeCount: this.activeOverrides.size,
          limit: this.maxConcurrentOverrides,
        });

        return res.status(429).json({
          error: 'Concurrent override limit exceeded',
          message: `Maximum ${this.maxConcurrentOverrides} concurrent overrides allowed`,
        });
      }

      // Parse request body
      const { duration, justification } = req.body;

      if (!justification || justification.trim().length < 10) {
        return res.status(400).json({
          error: 'Justification required',
          message: 'Override justification must be at least 10 characters',
        });
      }

      // Validate duration
      const overrideDuration = duration
        ? Math.min(duration, this.maxDuration)
        : this.defaultDuration;
      if (overrideDuration < 60_000) {
        // Minimum 1 minute
        return res.status(400).json({
          error: 'Invalid duration',
          message: 'Override duration must be at least 1 minute',
        });
      }

      // Generate override ID
      const overrideId = `override_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + overrideDuration);

      // Store override
      this.activeOverrides.set(overrideId, {
        adminId,
        startTime,
        endTime,
        justification: justification.trim(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      this.logger.info('Admin override activated', {
        overrideId,
        adminId,
        duration: overrideDuration,
        endTime,
      });

      // Audit successful activation
      this.auditLogger.logAccessEnforcement(
        overrideId,
        true,
        'admin',
        {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
        {
          userId: adminId,
          reason: 'Admin override activated',
          justification,
          duration: overrideDuration,
        },
      );

      res.json({
        message: 'Admin override activated successfully',
        overrideId,
        adminId,
        startTime,
        endTime,
        duration: overrideDuration,
        justification,
      });
    } catch (error) {
      this.logger.error('Admin override activation error', {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        error: 'Override activation failed',
        message: 'An error occurred while activating the override',
      });
    }
  }

  /**
   * Deactivates admin override
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  deactivateOverride(req, res) {
    try {
      // Authenticate admin
      const auth = this.authenticateAdmin(req);
      if (!auth.isValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: auth.error,
        });
      }

      const adminId = auth.adminId;
      const { overrideId } = req.params;

      if (!overrideId) {
        return res.status(400).json({
          error: 'Override ID required',
          message: 'Override ID must be provided in URL path',
        });
      }

      const override = this.activeOverrides.get(overrideId);
      if (!override) {
        return res.status(404).json({
          error: 'Override not found',
          message: 'The specified override does not exist or has expired',
        });
      }

      // Check if override has expired
      if (override.endTime <= new Date()) {
        this.logger.info('Attempted deactivation of expired override', {
          overrideId,
          adminId,
          endTime: override.endTime,
        });
        this.activeOverrides.delete(overrideId);
        return res.status(404).json({
          error: 'Override expired',
          message: 'The specified override has expired',
        });
      }

      // Check if admin owns this override or is different admin (allow any admin to deactivate)
      if (override.adminId !== adminId) {
        this.logger.warn('Admin override deactivation attempted by different admin', {
          overrideId,
          requestingAdmin: adminId,
          overrideAdmin: override.adminId,
        });
      }

      // Remove override
      this.activeOverrides.delete(overrideId);

      this.logger.info('Admin override deactivated', {
        overrideId,
        adminId,
        deactivatedBy: adminId,
      });

      // Audit deactivation
      this.auditLogger.logAccessEnforcement(
        overrideId,
        false,
        'admin',
        {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
        {
          userId: adminId,
          reason: 'Admin override deactivated',
          originalAdmin: override.adminId,
        },
      );

      res.json({
        message: 'Admin override deactivated successfully',
        overrideId,
        deactivatedBy: adminId,
        originalAdmin: override.adminId,
      });
    } catch (error) {
      this.logger.error('Admin override deactivation error', {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        error: 'Override deactivation failed',
        message: 'An error occurred while deactivating the override',
      });
    }
  }

  /**
   * Gets status of admin overrides
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  getOverrideStatus(req, res) {
    try {
      // Authenticate admin
      const auth = this.authenticateAdmin(req);
      if (!auth.isValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: auth.error,
        });
      }

      // Clean expired overrides
      this._cleanExpiredOverrides();

      const overrides = [...this.activeOverrides.entries()].map(([id, data]) => ({
        id,
        adminId: data.adminId,
        startTime: data.startTime,
        endTime: data.endTime,
        justification: data.justification,
        timeRemaining: Math.max(0, data.endTime.getTime() - Date.now()),
      }));

      res.json({
        activeOverrides: overrides.length,
        maxConcurrent: this.maxConcurrentOverrides,
        overrides,
      });
    } catch (error) {
      this.logger.error('Get override status error', {
        error: error.message,
      });

      res.status(500).json({
        error: 'Status retrieval failed',
        message: 'An error occurred while retrieving override status',
      });
    }
  }

  /**
   * Checks if override is currently active
   * @param {string} overrideId - Override ID to check
   * @returns {boolean} - Whether override is active
   */
  isOverrideActive(overrideId = null) {
    // Clean expired overrides
    this._cleanExpiredOverrides();

    if (overrideId) {
      const override = this.activeOverrides.get(overrideId);
      return override && override.endTime > new Date();
    }

    // Check if any override is active
    return this.activeOverrides.size > 0;
  }

  /**
   * Gets active override details for access control
   * @returns {Object|null} - Active override details or null
   */
  getActiveOverride() {
    // Clean expired overrides
    this._cleanExpiredOverrides();

    if (this.activeOverrides.size === 0) {
      return null;
    }

    // Return first active override (assuming single override for simplicity)
    const [overrideId, override] = this.activeOverrides.entries().next().value;
    return {
      id: overrideId,
      ...override,
    };
  }

  /**
   * Cleans expired overrides
   * @private
   */
  _cleanExpiredOverrides() {
    const now = new Date();
    const expiredIds = [];

    for (const [id, override] of this.activeOverrides) {
      if (override.endTime <= now) {
        expiredIds.push(id);

        this.logger.info('Admin override expired automatically', {
          overrideId: id,
          adminId: override.adminId,
          endTime: override.endTime,
        });

        // Audit expiration
        this.auditLogger.logAccessEnforcement(
          id,
          false,
          'admin',
          {},
          {
            userId: 'system',
            reason: 'Admin override expired automatically',
            originalAdmin: override.adminId,
          },
        );
      }
    }

    for (const id of expiredIds) {
      this.activeOverrides.delete(id);
    }
  }
}

module.exports = AdminOverrideController;
