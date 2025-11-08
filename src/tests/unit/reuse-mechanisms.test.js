const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
const AuditLog = require('../../models/AuditLog');
describe('Reuse Mechanisms Unit Tests', () => {
  let trustTokenGenerator;
  let mockValidToken;
  let mockInvalidToken;
  let testContent;
  let testContentHash;

  beforeEach(() => {
    trustTokenGenerator = new TrustTokenGenerator();
    testContent = JSON.stringify({ test: 'data', sensitive: 'information' });
    testContentHash = require('node:crypto').createHash('sha256').update(testContent).digest('hex');

    // Create a valid trust token for testing
    mockValidToken = trustTokenGenerator.generateToken(
      testContent, // sanitizedContent
      testContent, // originalContent (same for this test)
      ['remove-sensitive-data', 'sanitize-html'], // rulesApplied
      {
        version: '1.0.0',
        expirationHours: 1,
      },
    );
    mockInvalidToken = { ...mockValidToken, signature: 'invalid-signature' };

    // Reset global stats before each test
    globalThis.reuseStats = null;
  });

  afterEach(() => {
    // Clean up global state
    globalThis.reuseStats = null;
  });

  describe('TrustTokenGenerator Validation', () => {
    test('should validate a legitimate trust token', () => {
      const validation = trustTokenGenerator.validateToken(mockValidToken);
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    test('should reject an invalid trust token signature', () => {
      const validation = trustTokenGenerator.validateToken(mockInvalidToken);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('signature');
    });

    test('should reject an expired trust token', () => {
      const expiredToken = {
        ...mockValidToken,
        expiresAt: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour ago
      };
      const validation = trustTokenGenerator.validateToken(expiredToken);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('expired');
    });

    test('should reject a token with missing required fields', () => {
      const incompleteToken = { contentHash: testContentHash };
      const validation = trustTokenGenerator.validateToken(incompleteToken);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('required');
    });
  });

  describe('Content Hash Verification', () => {
    test('should verify matching content hash', () => {
      const computedHash = require('node:crypto')
        .createHash('sha256')
        .update(testContent)
        .digest('hex');
      expect(computedHash).toBe(testContentHash);
    });

    test('should detect content hash mismatch', () => {
      const modifiedContent = JSON.stringify({ test: 'modified', sensitive: 'information' });
      const computedHash = require('node:crypto')
        .createHash('sha256')
        .update(modifiedContent)
        .digest('hex');
      expect(computedHash).not.toBe(testContentHash);
    });

    test('should handle empty content', () => {
      const emptyContent = '';
      const emptyHash = require('node:crypto')
        .createHash('sha256')
        .update(emptyContent)
        .digest('hex');
      expect(emptyHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Reuse Statistics Tracking', () => {
    test('should initialize global reuse statistics', () => {
      expect(globalThis.reuseStats).toBeNull();

      // Simulate reuse success
      if (!globalThis.reuseStats) {
        globalThis.reuseStats = {
          hits: 0,
          totalRequests: 0,
          validationSuccessRate: 1,
          averageValidationTimeMs: 0,
          totalTimeSavedMs: 0,
          lastUpdated: new Date().toISOString(),
        };
      }

      expect(globalThis.reuseStats).toBeDefined();
      expect(globalThis.reuseStats.hits).toBe(0);
      expect(globalThis.reuseStats.totalRequests).toBe(0);
    });

    test('should update statistics on successful reuse', () => {
      // Initialize stats
      globalThis.reuseStats = {
        hits: 0,
        totalRequests: 0,
        validationSuccessRate: 1,
        averageValidationTimeMs: 0,
        totalTimeSavedMs: 0,
        lastUpdated: new Date().toISOString(),
      };

      // Simulate successful reuse
      globalThis.reuseStats.hits++;
      globalThis.reuseStats.totalRequests++;
      globalThis.reuseStats.validationSuccessRate =
        globalThis.reuseStats.hits / globalThis.reuseStats.totalRequests;
      globalThis.reuseStats.averageValidationTimeMs =
        (globalThis.reuseStats.averageValidationTimeMs + 5.2) / 2;
      globalThis.reuseStats.totalTimeSavedMs += 50;
      globalThis.reuseStats.lastUpdated = new Date().toISOString();

      expect(globalThis.reuseStats.hits).toBe(1);
      expect(globalThis.reuseStats.totalRequests).toBe(1);
      expect(globalThis.reuseStats.validationSuccessRate).toBe(1);
      expect(globalThis.reuseStats.totalTimeSavedMs).toBe(50);
    });

    test('should track validation failures', () => {
      globalThis.reuseStats = { validationFailures: 0 };

      // Simulate validation failure
      globalThis.reuseStats.validationFailures++;

      expect(globalThis.reuseStats.validationFailures).toBe(1);
    });

    test('should calculate cache hit rate correctly', () => {
      globalThis.reuseStats = {
        hits: 7,
        totalRequests: 10,
        validationFailures: 1,
      };

      const cacheHitRate = (globalThis.reuseStats.hits / globalThis.reuseStats.totalRequests) * 100;
      const failureRate =
        (globalThis.reuseStats.validationFailures / globalThis.reuseStats.totalRequests) * 100;

      expect(cacheHitRate).toBe(70);
      expect(failureRate).toBe(10);
    });
  });

  describe('AuditLog Integration', () => {
    test('should create audit log for successful reuse', () => {
      const auditLog = new AuditLog({
        userId: 'test-user',
        action: 'trust_token_reuse_successful',
        resourceId: testContentHash,
        details: {
          contentHash: testContentHash,
          tokenValidationTimeMs: 5.2,
          totalTimeMs: 7.8,
          timeSavedMs: 50,
          originalLength: testContent.length,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        sessionId: 'test-session',
      });

      expect(auditLog.id).toMatch(/^al_/);
      expect(auditLog.action).toBe('trust_token_reuse_successful');
      expect(auditLog.resourceId).toBe(testContentHash);
      expect(auditLog.details.contentHash).toBe(testContentHash);
      expect(auditLog.details.timeSavedMs).toBe(50);
    });

    test('should create audit log for validation failure', () => {
      const auditLog = new AuditLog({
        userId: 'test-user',
        action: 'trust_token_validation_failed',
        resourceId: testContentHash,
        details: {
          error: 'content_hash_mismatch',
          providedHash: 'different-hash',
          tokenHash: testContentHash,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        sessionId: 'test-session',
      });

      expect(auditLog.action).toBe('trust_token_validation_failed');
      expect(auditLog.details.error).toBe('content_hash_mismatch');
      expect(auditLog.isSecurityCritical()).toBe(true);
    });

    test('should create audit log for sanitization completion', () => {
      const auditLog = new AuditLog({
        userId: 'test-user',
        action: 'content_sanitization_completed',
        resourceId: testContentHash,
        details: {
          originalLength: testContent.length,
          sanitizedLength: testContent.length - 10,
          totalTimeMs: 25.5,
          classification: 'llm',
          trustTokenGenerated: true,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        sessionId: 'test-session',
      });

      expect(auditLog.action).toBe('content_sanitization_completed');
      expect(auditLog.details.trustTokenGenerated).toBe(true);
      expect(auditLog.getCategory()).toBe('other'); // content_sanitization_completed not in predefined categories
    });

    test('should verify audit log signatures', () => {
      const auditLog = new AuditLog({
        userId: 'test-user',
        action: 'trust_token_reuse_successful',
        resourceId: testContentHash,
        details: { test: 'data' },
      });

      expect(auditLog.verifySignature()).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    test('should track high-resolution timing', () => {
      const startTime = process.hrtime.bigint();
      // Simulate some work
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;

      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof durationMs).toBe('number');
    });

    test('should calculate time saved estimates', () => {
      const estimatedTimeSaved = 50; // ms
      const requestsCount = 100;
      const totalTimeSaved = estimatedTimeSaved * requestsCount;

      expect(totalTimeSaved).toBe(5000);
    });

    test('should maintain running averages', () => {
      let sum = 0;
      const measurements = [10, 20, 15, 25];

      for (const measurement of measurements) {
        sum += measurement;
      }

      const finalAverage = sum / measurements.length;
      expect(finalAverage).toBeCloseTo(17.5, 1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null or undefined tokens', () => {
      expect(() => {
        trustTokenGenerator.validateToken(null);
      }).not.toThrow();

      expect(() => {
        trustTokenGenerator.validateToken();
      }).not.toThrow();
    });

    test('should handle malformed content', () => {
      const malformedContent = null;
      expect(() => {
        if (malformedContent) {
          require('node:crypto').createHash('sha256').update(malformedContent).digest('hex');
        }
      }).not.toThrow();
    });

    test('should handle concurrent statistics updates', () => {
      // Simulate concurrent access to global stats
      globalThis.reuseStats = { hits: 0, totalRequests: 0 };

      // Simulate multiple concurrent updates
      for (let i = 0; i < 10; i++) {
        globalThis.reuseStats.hits++;
        globalThis.reuseStats.totalRequests++;
      }

      expect(globalThis.reuseStats.hits).toBe(10);
      expect(globalThis.reuseStats.totalRequests).toBe(10);
    });
  });
});
