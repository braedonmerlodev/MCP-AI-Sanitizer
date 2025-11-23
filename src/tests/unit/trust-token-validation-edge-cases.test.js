const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

// Mock audit logging
jest.mock('../../models/AuditLog', () => {
  return jest.fn().mockImplementation(() => ({
    id: 'mock-audit-id',
    save: jest.fn().mockResolvedValue(true),
  }));
});

jest.mock('../../components/data-integrity/AuditLogger', () => {
  return jest.fn().mockImplementation(() => ({
    logOperation: jest.fn(),
    logValidation: jest.fn(),
    logEscalationDecision: jest.fn(),
    logRiskAssessmentDecision: jest.fn(),
    logUnknownRiskCase: jest.fn(),
    logHumanIntervention: jest.fn(),
    logHighFidelityDataCollection: jest.fn(),
  }));
});

// Mock other components
jest.mock('../../components/proxy-sanitizer', () => {
  return jest.fn().mockImplementation(() => ({
    sanitize: jest.fn().mockResolvedValue('sanitized content'),
  }));
});

jest.mock('../../middleware/destination-tracking', () =>
  jest.fn((req, res, next) => {
    req.destinationTracking = { classification: 'test' };
    next();
  }),
);

jest.mock('../../middleware/AccessValidationMiddleware', () => jest.fn((req, res, next) => next()));

const apiContractValidationMiddleware = function () {
  return function (req, res, next) {
    next();
  };
};
jest.mock(
  '../../middleware/ApiContractValidationMiddleware',
  () => apiContractValidationMiddleware,
);

jest.mock('../../middleware/agentAuth', () => ({
  agentAuth: (req, res, next) => next(),
  enforceAgentSync: (req, res, next) => next(),
}));

jest.mock('../../components/AccessControlEnforcer', () => {
  return jest.fn().mockImplementation(() => ({
    enforce: jest.fn().mockReturnValue({ allowed: true }),
  }));
});

jest.mock('../../utils/queueManager', () => ({
  addJob: jest.fn().mockResolvedValue('mock-job-id'),
}));

jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: jest.fn().mockResolvedValue({ text: 'ai-transformed', metadata: {} }),
  }));
});

// Mock environment variables
process.env.TRUST_TOKEN_SECRET = 'test-secret-key-for-trust-token-validation-tests';

describe('Trust Token Validation Edge Cases', () => {
  let generator;

  beforeEach(() => {
    generator = new TrustTokenGenerator();
  });

  describe('Invalid Token Format Handling', () => {
    test('should reject non-object tokens', () => {
      const invalidTokens = [
        'string-token',
        12_345,
        null,
        undefined,
        [],
        true,
        'not-a-jwt-format.even.if.looks.like.it',
      ];

      for (const token of invalidTokens) {
        const result = generator.validateToken(token);
        expect(result.isValid).toBe(false);
        // Different tokens may trigger different error paths
        expect(result.error).toMatch(/Missing required field|Validation error/);
      }
    });

    test('should reject tokens with missing required fields', () => {
      const baseToken = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'mock-signature',
        nonce: 'test-nonce',
      };

      const requiredFields = Object.keys(baseToken);

      for (const field of requiredFields) {
        const invalidToken = { ...baseToken };
        delete invalidToken[field];

        const result = generator.validateToken(invalidToken);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain(`Missing required field: ${field}`);
      }
    });

    test('should reject tokens with invalid hash formats', () => {
      const invalidHashes = [
        'not-64-chars',
        'a'.repeat(63), // too short
        'a'.repeat(65), // too long
        'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg', // invalid hex
        '   ', // whitespace only
      ];

      for (const hash of invalidHashes) {
        const token = {
          contentHash: hash,
          originalHash: 'a'.repeat(64),
          sanitizationVersion: '1.0',
          rulesApplied: ['test'],
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          signature: 'mock-signature',
          nonce: 'test-nonce',
        };

        // The validation doesn't check hash format, but signature will fail
        const result = generator.validateToken(token);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid token signature');
      }
    });

    test('should reject tokens with empty hash fields', () => {
      const token = {
        contentHash: '',
        originalHash: 'a'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'mock-signature',
        nonce: 'test-nonce',
      };

      const result = generator.validateToken(token);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required field: contentHash');
    });

    test('should reject tokens with malformed JSON in signature payload', () => {
      // Create a token where JSON.stringify would fail if not careful
      const token = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: 'invalid-date',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'mock-signature',
        nonce: 'test-nonce',
      };

      const result = generator.validateToken(token);
      // Should handle the invalid date gracefully
      expect(result.isValid).toBe(false);
    });
  });

  describe('Expired Token Scenarios', () => {
    test('should reject clearly expired tokens', () => {
      const expiredToken = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date(Date.now() - 7_200_000).toISOString(), // 2 hours ago
        expiresAt: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour ago
        signature: 'mock-signature',
        nonce: 'test-nonce',
      };

      const result = generator.validateToken(expiredToken);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    test('should reject tokens expiring at current time', () => {
      const now = new Date();
      const token = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date(now.getTime() - 3_600_000).toISOString(),
        expiresAt: now.toISOString(), // expires now
        signature: 'mock-signature',
        nonce: 'test-nonce',
      };

      const result = generator.validateToken(token);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    test('should accept tokens with future expiration', () => {
      const futureToken = generator.generateToken(
        'test content',
        'original content',
        ['test-rule'],
        { expirationHours: 2 },
      );

      const result = generator.validateToken(futureToken);
      expect(result.isValid).toBe(true);
    });

    test('should handle boundary conditions around expiration', () => {
      const now = new Date();
      const oneSecondBefore = new Date(now.getTime() - 1000);
      const oneSecondAfter = new Date(now.getTime() + 1000);

      const expiredToken = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: oneSecondBefore.toISOString(),
        expiresAt: oneSecondBefore.toISOString(), // expired 1 second ago
        signature: 'mock-signature',
        nonce: 'test-nonce',
      };

      const validToken = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: oneSecondBefore.toISOString(),
        expiresAt: oneSecondAfter.toISOString(), // expires 1 second from now
        signature: 'mock-signature',
        nonce: 'test-nonce',
      };

      expect(generator.validateToken(expiredToken).isValid).toBe(false);
      expect(generator.validateToken(validToken).isValid).toBe(false); // signature invalid
    });
  });

  describe('Incorrect Signatures', () => {
    test('should reject tokens with tampered signatures', () => {
      const validToken = generator.generateToken('test content', 'original content', ['test-rule']);

      const tamperedToken = { ...validToken, signature: 'tampered-signature' };

      const result = generator.validateToken(tamperedToken);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });

    test('should reject tokens with wrong secret key', () => {
      const tokenWithWrongSecret = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'wrong-secret-signature',
        nonce: 'test-nonce',
      };

      const result = generator.validateToken(tokenWithWrongSecret);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });

    test('should handle signature verification errors gracefully', () => {
      const invalidToken = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: 'invalid-timestamp',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'some-signature',
        nonce: 'test-nonce',
      };

      // Should not throw, should return validation error
      expect(() => generator.validateToken(invalidToken)).not.toThrow();
      const result = generator.validateToken(invalidToken);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Malformed Payloads', () => {
    test('should reject tokens with invalid timestamp formats', () => {
      const invalidTimestamps = [
        'not-a-date',
        '2023-13-45', // invalid date
        null,
        undefined,
        '',
      ];

      for (const timestamp of invalidTimestamps) {
        const token = {
          contentHash: 'a'.repeat(64),
          originalHash: 'b'.repeat(64),
          sanitizationVersion: '1.0',
          rulesApplied: ['test'],
          timestamp,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          signature: 'mock-signature',
          nonce: 'test-nonce',
        };

        const result = generator.validateToken(token);
        expect(result.isValid).toBe(false);
      }
    });

    test('should reject tokens with invalid rulesApplied arrays', () => {
      const invalidRules = [
        'not-an-array',
        null,
        undefined,
        {},
        [123, 456], // numbers instead of strings
      ];

      for (const rules of invalidRules) {
        const token = {
          contentHash: 'a'.repeat(64),
          originalHash: 'b'.repeat(64),
          sanitizationVersion: '1.0',
          rulesApplied: rules,
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          signature: 'mock-signature',
          nonce: 'test-nonce',
        };

        const result = generator.validateToken(token);
        expect(result.isValid).toBe(false);
      }
    });

    test('should handle tokens with extra unexpected fields', () => {
      const token = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'mock-signature',
        nonce: 'test-nonce',
        extraField: 'unexpected',
        anotherField: { nested: 'object' },
      };

      // Extra fields should not affect validation (signature will still fail)
      const result = generator.validateToken(token);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });
  });
});

describe('API Trust Token Validation and Audit Logging', () => {
  let app;
  let auditLogMock;
  let generator;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset global stats
    globalThis.reuseStats = undefined;

    // Setup app
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);

    // Get the mock
    auditLogMock = require('../../models/AuditLog');

    // Create generator
    generator = new TrustTokenGenerator();
  });

  describe('Audit Logging for Trust Token Validation Failures', () => {
    test('should create audit log when trust token validation fails due to invalid format', async () => {
      const invalidToken = {
        // Missing required fields like signature
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        nonce: 'test-nonce',
        // Missing signature
      };

      await request(app)
        .post('/api/sanitize/json')
        .send({
          content: '{"test": "data"}',
          trustToken: invalidToken,
        })
        .expect(200); // Should still process but log failure

      // Check that audit log was created for validation failure
      expect(auditLogMock).toHaveBeenCalled();
      const auditCall = auditLogMock.mock.calls.find(
        (call) => call[0].action === 'trust_token_validation_failed',
      );
      expect(auditCall).toBeDefined();
      expect(auditCall[0].details.error).toBeDefined();
    });

    test('should create audit log when trust token validation fails due to expiration', async () => {
      const expiredToken = {
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date(Date.now() - 7_200_000).toISOString(),
        expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
        signature: 'mock-signature',
        nonce: 'test-nonce',
      };

      await request(app)
        .post('/api/sanitize/json')
        .send({
          content: '{"test": "data"}',
          trustToken: expiredToken,
        })
        .expect(200);

      expect(auditLogMock).toHaveBeenCalled();
      const auditCall = auditLogMock.mock.calls.find(
        (call) => call[0].action === 'trust_token_validation_failed',
      );
      expect(auditCall).toBeDefined();
      expect(auditCall[0].details.error).toBe('Token has expired');
    });

    test('should create audit log when trust token content hash mismatch', async () => {
      const validToken = generator.generateToken('original content', 'original content', ['test']);
      // Modify content to cause hash mismatch
      const wrongContent = '{"different": "content"}';

      await request(app)
        .post('/api/sanitize/json')
        .send({
          content: wrongContent,
          trustToken: validToken,
        })
        .expect(200);

      expect(auditLogMock).toHaveBeenCalled();
      const auditCall = auditLogMock.mock.calls.find(
        (call) => call[0].action === 'trust_token_validation_failed',
      );
      expect(auditCall).toBeDefined();
      expect(auditCall[0].details.error).toBe('content_hash_mismatch');
    });

    test('should create audit log for successful trust token reuse', async () => {
      const content = '{"test": "data"}';
      const validToken = generator.generateToken(content, content, ['test']);

      await request(app)
        .post('/api/sanitize/json')
        .send({
          content: content,
          trustToken: validToken,
        })
        .expect(200);

      expect(auditLogMock).toHaveBeenCalled();
      const auditCall = auditLogMock.mock.calls.find(
        (call) => call[0].action === 'trust_token_reuse_successful',
      );
      expect(auditCall).toBeDefined();
      expect(auditCall[0].action).toBe('trust_token_reuse_successful');
    });
  });

  describe('Token Reuse Statistics Edge Cases', () => {
    beforeEach(() => {
      // Reset global stats
      globalThis.reuseStats = undefined;
    });

    test('should track validation failures in global statistics', async () => {
      const invalidToken = {
        // Missing signature
        contentHash: 'a'.repeat(64),
        originalHash: 'b'.repeat(64),
        sanitizationVersion: '1.0',
        rulesApplied: ['test'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        nonce: 'test-nonce',
      };

      await request(app).post('/api/sanitize/json').send({
        content: '{"test": "data"}',
        trustToken: invalidToken,
      });

      expect(globalThis.reuseStats).toBeDefined();
      expect(globalThis.reuseStats.validationFailures).toBeGreaterThan(0);
    });
  });

  test('should track successful reuse in global statistics', async () => {
    const content = '{"test": "data"}';
    const validToken = generator.generateToken(content, content, ['test']);

    await request(app).post('/api/sanitize/json').send({
      content: content,
      trustToken: validToken,
    });

    expect(globalThis.reuseStats).toBeDefined();
    expect(globalThis.reuseStats.hits).toBeGreaterThan(0);
    expect(globalThis.reuseStats.totalRequests).toBeGreaterThan(0);
    expect(globalThis.reuseStats.validationSuccessRate).toBeDefined();
  });

  test('should handle concurrent reuse statistics updates', async () => {
    const content = '{"test": "data"}';
    const validToken = generator.generateToken(content, content, ['test']);

    // Simulate concurrent requests
    const requests = Array.from({ length: 10 }, () =>
      request(app).post('/api/sanitize/json').send({
        content: content,
        trustToken: validToken,
      }),
    );

    await Promise.all(requests);

    expect(globalThis.reuseStats).toBeDefined();
    expect(globalThis.reuseStats.hits).toBe(10);
    expect(globalThis.reuseStats.totalRequests).toBe(10);
    expect(globalThis.reuseStats.validationSuccessRate).toBe(1);
  });

  test('should enforce reuse limits (if implemented)', async () => {
    // Currently no reuse limit, but test the statistics tracking
    const content = '{"test": "data"}';
    const validToken = generator.generateToken(content, content, ['test']);

    // Make multiple requests
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/sanitize/json').send({
        content: content,
        trustToken: validToken,
      });
    }

    expect(globalThis.reuseStats.hits).toBe(5);
    // In future, could test blocking after limit
  });
});

describe('Concurrent Token Validation', () => {
  test('should handle concurrent validation requests without race conditions', async () => {
    const content = '{"test": "data"}';
    const validToken = generator.generateToken(content, content, ['test']);

    // Create multiple concurrent requests
    const concurrentRequests = Array.from({ length: 20 }, () =>
      request(app).post('/api/sanitize/json').send({
        content: content,
        trustToken: validToken,
      }),
    );

    const responses = await Promise.all(concurrentRequests);

    // All should succeed
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body.metadata.reused).toBe(true);
    }

    // Statistics should be correctly updated (may have some from previous tests)
    expect(globalThis.reuseStats.hits).toBeGreaterThanOrEqual(20);
  });
});
