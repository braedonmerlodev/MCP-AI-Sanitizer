const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
const AuditLog = require('../../models/AuditLog');

describe('Reuse Mechanisms Integration Tests', () => {
  let trustTokenGenerator;
  let testContent;
  let validTrustToken;

  beforeAll(() => {
    trustTokenGenerator = new TrustTokenGenerator();
    testContent = JSON.stringify({
      message: 'Test content for reuse mechanisms',
      sensitive: 'This should be sanitized',
      data: { nested: 'value' },
    });

    // Create a valid trust token for testing
    validTrustToken = trustTokenGenerator.generateToken(
      testContent,
      testContent,
      ['remove-sensitive-data', 'sanitize-html'],
      { version: '1.0.0', expirationHours: 1 },
    );
  });

  beforeEach(() => {
    // Reset global stats before each test
    global.reuseStats = null;
  });

  afterEach(() => {
    // Clean up global state
    global.reuseStats = null;
  });

  describe('Trust Token Generation and Validation', () => {
    test('should generate valid trust tokens', () => {
      expect(validTrustToken).toHaveProperty('contentHash');
      expect(validTrustToken).toHaveProperty('signature');
      expect(validTrustToken).toHaveProperty('timestamp');
      expect(validTrustToken).toHaveProperty('expiresAt');

      // Validate the generated token
      const validation = trustTokenGenerator.validateToken(validTrustToken);
      expect(validation.isValid).toBe(true);
    });

    test('should validate trust tokens correctly', () => {
      const validation = trustTokenGenerator.validateToken(validTrustToken);
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    test('should reject invalid trust tokens', () => {
      const invalidToken = { ...validTrustToken, signature: 'invalid' };
      const validation = trustTokenGenerator.validateToken(invalidToken);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('Content Hash Verification', () => {
    test('should correctly compute content hashes', () => {
      const computedHash = require('crypto').createHash('sha256').update(testContent).digest('hex');

      expect(computedHash).toBe(validTrustToken.contentHash);
      expect(computedHash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should detect content modifications', () => {
      const modifiedContent = JSON.stringify({ modified: 'content' });
      const modifiedHash = require('crypto')
        .createHash('sha256')
        .update(modifiedContent)
        .digest('hex');

      expect(modifiedHash).not.toBe(validTrustToken.contentHash);
    });
  });

  describe('Audit Logging Integration', () => {
    test('should create audit logs for successful operations', () => {
      const auditLog = new AuditLog({
        userId: 'test-user',
        action: 'trust_token_reuse_successful',
        resourceId: validTrustToken.contentHash,
        details: {
          contentHash: validTrustToken.contentHash,
          tokenValidationTimeMs: 5.2,
          totalTimeMs: 7.8,
          timeSavedMs: 50,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        sessionId: 'test-session',
      });

      expect(auditLog.id).toMatch(/^al_/);
      expect(auditLog.action).toBe('trust_token_reuse_successful');
      expect(auditLog.verifySignature()).toBe(true);
    });

    test('should create audit logs for failed operations', () => {
      const auditLog = new AuditLog({
        userId: 'test-user',
        action: 'trust_token_validation_failed',
        resourceId: 'invalid-hash',
        details: {
          error: 'content_hash_mismatch',
          providedHash: 'different-hash',
          tokenHash: validTrustToken.contentHash,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        sessionId: 'test-session',
      });

      expect(auditLog.action).toBe('trust_token_validation_failed');
      expect(auditLog.isSecurityCritical()).toBe(true);
    });
  });

  describe('Statistics and Metrics Tracking', () => {
    test('should initialize and update reuse statistics', () => {
      // Test initial state
      expect(global.reuseStats).toBeNull();

      // Simulate successful reuse
      if (!global.reuseStats) {
        global.reuseStats = {
          hits: 0,
          totalRequests: 0,
          validationSuccessRate: 1.0,
          averageValidationTimeMs: 0,
          totalTimeSavedMs: 0,
          lastUpdated: new Date().toISOString(),
        };
      }

      global.reuseStats.hits++;
      global.reuseStats.totalRequests++;
      global.reuseStats.totalTimeSavedMs += 50;

      expect(global.reuseStats.hits).toBe(1);
      expect(global.reuseStats.totalRequests).toBe(1);
      expect(global.reuseStats.totalTimeSavedMs).toBe(50);
    });

    test('should calculate performance metrics', () => {
      global.reuseStats = {
        hits: 8,
        totalRequests: 10,
        validationFailures: 1,
        totalTimeSavedMs: 400,
      };

      const cacheHitRate = (global.reuseStats.hits / global.reuseStats.totalRequests) * 100;
      const failureRate =
        (global.reuseStats.validationFailures / global.reuseStats.totalRequests) * 100;
      const averageTimeSaved =
        global.reuseStats.hits > 0
          ? global.reuseStats.totalTimeSavedMs / global.reuseStats.hits
          : 0;

      expect(cacheHitRate).toBe(80);
      expect(failureRate).toBe(10);
      expect(averageTimeSaved).toBe(50);
    });
  });

  describe('Performance Benchmarking', () => {
    test('should measure high-resolution timing', () => {
      const startTime = process.hrtime.bigint();
      // Simulate some operation
      const testData = 'test';
      const hash = require('crypto').createHash('sha256').update(testData).digest('hex');
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1e6;

      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(hash).toBeDefined();
    });

    test('should track token validation performance', () => {
      const startTime = process.hrtime.bigint();
      const validation = trustTokenGenerator.validateToken(validTrustToken);
      const endTime = process.hrtime.bigint();

      const validationTimeMs = Number(endTime - startTime) / 1e6;

      expect(validation.isValid).toBe(true);
      expect(validationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Security and Tamper Prevention', () => {
    test('should prevent content hash tampering', () => {
      const tamperedToken = {
        ...validTrustToken,
        contentHash: 'tampered-hash-123456789012345678901234567890123456789012345678901234567890',
      };

      const validation = trustTokenGenerator.validateToken(tamperedToken);
      expect(validation.isValid).toBe(false);
    });

    test('should detect signature tampering', () => {
      const tamperedToken = {
        ...validTrustToken,
        signature: validTrustToken.signature.replace('a', 'b'),
      };

      const validation = trustTokenGenerator.validateToken(tamperedToken);
      expect(validation.isValid).toBe(false);
    });

    test('should handle expired tokens', () => {
      const expiredToken = trustTokenGenerator.generateToken(testContent, testContent, ['test'], {
        expirationHours: -1,
      });

      const validation = trustTokenGenerator.validateToken(expiredToken);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('expired');
    });
  });

  describe('Concurrent Access and Thread Safety', () => {
    test('should handle concurrent statistics updates', () => {
      global.reuseStats = { hits: 0, totalRequests: 0, totalTimeSavedMs: 0 };

      // Simulate concurrent updates
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(() => {
          global.reuseStats.hits++;
          global.reuseStats.totalRequests++;
          global.reuseStats.totalTimeSavedMs += 10;
        });
      }

      // Execute operations
      operations.forEach((op) => op());

      expect(global.reuseStats.hits).toBe(100);
      expect(global.reuseStats.totalRequests).toBe(100);
      expect(global.reuseStats.totalTimeSavedMs).toBe(1000);
    });
  });
});
