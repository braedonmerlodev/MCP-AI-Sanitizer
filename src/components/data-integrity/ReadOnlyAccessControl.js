/**
 * ReadOnlyAccessControl manages read-only access controls for sanitized data layers.
 * Ensures that sanitized data cannot be modified while allowing authenticated access.
 */
class ReadOnlyAccessControl {
  constructor(options = {}) {
    this.enableAccessLogging = options.enableAccessLogging !== false;
    this.maxAccessLogSize = options.maxAccessLogSize || 10_000;
    this.allowedRoles = options.allowedRoles || ['reader', 'analyst', 'auditor'];
    this.accessLog = [];
  }

  /**
   * Checks if a user has read-only access to sanitized data
   * @param {Object} user - User object with roles and permissions
   * @param {string} resourceType - Type of resource being accessed
   * @param {Object} context - Access context
   * @returns {Object} - Access check result
   */
  checkReadAccess(user, resourceType = 'sanitized_data', context = {}) {
    try {
      // Validate user authentication
      if (!this.isUserAuthenticated(user)) {
        return {
          granted: false,
          reason: 'User not authenticated',
          requiredAction: 'authenticate',
        };
      }

      // Check if user has appropriate role
      if (!this.hasRequiredRole(user, resourceType)) {
        return {
          granted: false,
          reason: 'Insufficient permissions for read access',
          requiredRole: this.getRequiredRoles(resourceType),
        };
      }

      // Check if resource is in read-only mode
      if (!this.isResourceReadOnly(resourceType, context)) {
        return {
          granted: false,
          reason: 'Resource is not in read-only mode',
          currentMode: 'read-write',
        };
      }

      // Check rate limits
      if (!this.checkRateLimit(user, context)) {
        return {
          granted: false,
          reason: 'Rate limit exceeded',
          retryAfter: this.getRetryAfter(user),
        };
      }

      // Log successful access
      if (this.enableAccessLogging) {
        this.logAccess(user, resourceType, 'granted', context);
      }

      return {
        granted: true,
        accessLevel: 'read-only',
        sessionId: this.generateSessionId(),
        expiresAt: this.getAccessExpiration(),
      };
    } catch (error) {
      // Log access denial due to error
      if (this.enableAccessLogging) {
        this.logAccess(user, resourceType, 'error', { ...context, error: error.message });
      }

      return {
        granted: false,
        reason: 'Access check failed due to system error',
        error: error.message,
      };
    }
  }

  /**
   * Checks if a user has write access (should always be denied for sanitized data)
   * @param {Object} user - User object
   * @param {string} resourceType - Resource type
   * @param {Object} context - Context
   * @returns {Object} - Access result (always denied)
   */
  checkWriteAccess(user, resourceType = 'sanitized_data', context = {}) {
    // Log the attempt
    if (this.enableAccessLogging) {
      this.logAccess(user, resourceType, 'write_attempt_denied', context);
    }

    return {
      granted: false,
      reason: 'Write access denied: sanitized data is read-only',
      accessLevel: 'none',
      securityViolation: true,
    };
  }

  /**
   * Validates user authentication
   * @param {Object} user - User object
   * @returns {boolean} - Authentication status
   */
  isUserAuthenticated(user) {
    return (
      user &&
      typeof user === 'object' &&
      user.id &&
      user.authenticated === true &&
      user.sessionValidUntil > Date.now()
    );
  }

  /**
   * Checks if user has required role for access
   * @param {Object} user - User object
   * @param {string} resourceType - Resource type
   * @returns {boolean} - Role check result
   */
  hasRequiredRole(user, resourceType) {
    if (!user.roles || !Array.isArray(user.roles)) {
      return false;
    }

    const requiredRoles = this.getRequiredRoles(resourceType);
    return user.roles.some((role) => requiredRoles.includes(role));
  }

  /**
   * Gets required roles for a resource type
   * @param {string} resourceType - Resource type
   * @returns {Array} - Required roles
   */
  getRequiredRoles(resourceType) {
    // Different resource types may have different role requirements
    const roleMap = {
      sanitized_data: ['reader', 'analyst', 'auditor'],
      validation_results: ['analyst', 'auditor'],
      audit_logs: ['auditor'],
      error_queues: ['analyst', 'auditor'],
    };

    return roleMap[resourceType] || this.allowedRoles;
  }

  /**
   * Checks if resource is in read-only mode
   * @param {string} resourceType - Resource type
   * @param {Object} context - Context
   * @returns {boolean} - Read-only status
   */
  isResourceReadOnly(resourceType, context) {
    // Sanitized data should always be read-only
    // In a real system, this might check database permissions or configuration
    return (
      resourceType.includes('sanitized') ||
      resourceType.includes('audit') ||
      context.readOnly === true
    );
  }

  /**
   * Checks rate limits for user access
   * @param {Object} user - User object
   * @param {Object} context - Context
   * @returns {boolean} - Rate limit check result
   */
  checkRateLimit(user) {
    // Simple rate limiting - in production, use Redis or similar
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const maxRequests = 100; // 100 requests per minute

    if (!user.rateLimit) {
      user.rateLimit = { requests: [], windowStart: now };
    }

    // Clean old requests
    user.rateLimit.requests = user.rateLimit.requests.filter(
      (timestamp) => now - timestamp < windowMs,
    );

    // Check if under limit
    if (user.rateLimit.requests.length < maxRequests) {
      user.rateLimit.requests.push(now);
      return true;
    }

    return false;
  }

  /**
   * Gets retry after time for rate limited user
   * @param {Object} user - User object
   * @returns {number} - Seconds to wait
   */
  getRetryAfter(user) {
    if (!user.rateLimit || user.rateLimit.requests.length === 0) {
      return 60; // Default 1 minute
    }

    const oldestRequest = Math.min(...user.rateLimit.requests);
    const now = Date.now();
    const timeToWait = 60_000 - (now - oldestRequest); // 1 minute window

    return Math.ceil(timeToWait / 1000);
  }

  /**
   * Logs access attempts
   * @param {Object} user - User object
   * @param {string} resourceType - Resource type
   * @param {string} result - Access result
   * @param {Object} context - Context
   */
  logAccess(user, resourceType, result, context = {}) {
    const accessEntry = {
      id: this.generateAccessId(),
      timestamp: new Date().toISOString(),
      userId: user?.id,
      userRoles: user?.roles,
      resourceType,
      result,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      context: { ...context, user: undefined }, // Don't log full user object
    };

    this.accessLog.push(accessEntry);

    // Maintain log size
    if (this.accessLog.length > this.maxAccessLogSize) {
      this.accessLog.shift();
    }

    // In production, this would also write to persistent storage
    console.log('Access Log:', accessEntry);
  }

  /**
   * Gets access log entries with filtering
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered access entries
   */
  getAccessLog(filters = {}) {
    let entries = [...this.accessLog];

    if (filters.userId) {
      entries = entries.filter((e) => e.userId === filters.userId);
    }

    if (filters.resourceType) {
      entries = entries.filter((e) => e.resourceType === filters.resourceType);
    }

    if (filters.result) {
      entries = entries.filter((e) => e.result === filters.result);
    }

    if (filters.startDate) {
      entries = entries.filter((e) => new Date(e.timestamp) >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      entries = entries.filter((e) => new Date(e.timestamp) <= new Date(filters.endDate));
    }

    return entries;
  }

  /**
   * Gets access statistics
   * @returns {Object} - Access statistics
   */
  getAccessStats() {
    const stats = {
      totalAccess: this.accessLog.length,
      granted: 0,
      denied: 0,
      byResourceType: {},
      byResult: {},
      recentActivity: [],
    };

    // Last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const entry of this.accessLog) {
      if (entry.result === 'granted') {
        stats.granted++;
      } else {
        stats.denied++;
      }

      stats.byResourceType[entry.resourceType] =
        (stats.byResourceType[entry.resourceType] || 0) + 1;
      stats.byResult[entry.result] = (stats.byResult[entry.result] || 0) + 1;

      if (new Date(entry.timestamp) > oneDayAgo) {
        stats.recentActivity.push(entry);
      }
    }

    return stats;
  }

  /**
   * Generates a unique access ID
   * @returns {string} - Access ID
   */
  generateAccessId() {
    return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Generates a session ID for granted access
   * @returns {string} - Session ID
   */
  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Gets access expiration time
   * @returns {string} - ISO timestamp
   */
  getAccessExpiration() {
    // 1 hour from now
    const expiration = new Date(Date.now() + 60 * 60 * 1000);
    return expiration.toISOString();
  }

  /**
   * Revokes access for a user (emergency)
   * @param {string} userId - User ID to revoke
   * @param {string} reason - Revocation reason
   */
  revokeAccess(userId, reason = 'Administrative action') {
    // In a real system, this would invalidate sessions and update user status
    console.log(`Access revoked for user ${userId}: ${reason}`);

    if (this.enableAccessLogging) {
      this.logAccess({ id: userId }, 'all_resources', 'revoked', { reason });
    }
  }
}

module.exports = ReadOnlyAccessControl;
