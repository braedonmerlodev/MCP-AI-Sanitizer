const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

describe('TrustTokenGenerator', () => {
  let generator;
  const testSecret = 'test-secret-key-for-unit-tests';

  beforeEach(() => {
    generator = new TrustTokenGenerator({ secret: testSecret });
  });

  describe('constructor', () => {
    it('should throw error if no secret provided', () => {
      expect(() => new TrustTokenGenerator()).toThrow(
        'TRUST_TOKEN_SECRET environment variable must be set',
      );
    });

    it('should accept custom options', () => {
      const customGenerator = new TrustTokenGenerator({
        secret: testSecret,
        defaultExpirationHours: 48,
        defaultVersion: '2.0',
      });
      expect(customGenerator.defaultExpirationHours).toBe(48);
      expect(customGenerator.defaultVersion).toBe('2.0');
    });
  });

  describe('generateToken', () => {
    it('should generate a valid token structure', () => {
      const sanitizedContent = 'sanitized text';
      const originalContent = 'original text';
      const rulesApplied = ['unicode-normalization', 'symbol-stripping'];

      const token = generator.generateToken(sanitizedContent, originalContent, rulesApplied);

      expect(token).toHaveProperty('contentHash');
      expect(token).toHaveProperty('originalHash');
      expect(token).toHaveProperty('sanitizationVersion', '1.0');
      expect(token).toHaveProperty('rulesApplied', rulesApplied);
      expect(token).toHaveProperty('timestamp');
      expect(token).toHaveProperty('expiresAt');
      expect(token).toHaveProperty('signature');

      // Check types
      expect(typeof token.contentHash).toBe('string');
      expect(typeof token.originalHash).toBe('string');
      expect(typeof token.sanitizationVersion).toBe('string');
      expect(Array.isArray(token.rulesApplied)).toBe(true);
      expect(token.timestamp).toBeInstanceOf(Date);
      expect(token.expiresAt).toBeInstanceOf(Date);
      expect(typeof token.signature).toBe('string');
    });

    it('should use custom options', () => {
      const token = generator.generateToken('content', 'original', [], {
        version: '2.0',
        expirationHours: 48,
      });

      expect(token.sanitizationVersion).toBe('2.0');
      const expectedExpiry = new Date(token.timestamp.getTime() + 48 * 60 * 60 * 1000);
      expect(token.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });

    it('should generate different hashes for different content', () => {
      const token1 = generator.generateToken('content1', 'original1', []);
      const token2 = generator.generateToken('content2', 'original2', []);

      expect(token1.contentHash).not.toBe(token2.contentHash);
      expect(token1.originalHash).not.toBe(token2.originalHash);
    });
  });

  describe('validateToken', () => {
    let validToken;

    beforeEach(() => {
      validToken = generator.generateToken('test content', 'original content', ['rule1', 'rule2']);
    });

    it('should validate a correct token', () => {
      const result = generator.validateToken(validToken);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject token with missing fields', () => {
      const incompleteToken = { ...validToken };
      delete incompleteToken.contentHash;

      const result = generator.validateToken(incompleteToken);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing required field');
    });

    it('should reject expired token', () => {
      const expiredToken = {
        ...validToken,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      };

      const result = generator.validateToken(expiredToken);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    it('should reject token with invalid signature', () => {
      const tamperedToken = {
        ...validToken,
        signature: 'invalid-signature',
      };

      const result = generator.validateToken(tamperedToken);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });

    it('should reject token with modified content', () => {
      const tamperedToken = {
        ...validToken,
        contentHash: 'modified-hash',
      };

      const result = generator.validateToken(tamperedToken);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });

    it('should handle malformed token gracefully', () => {
      const result = generator.validateToken(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('integration', () => {
    it('should generate and validate token successfully', () => {
      const content = 'This is test content with special chars: <script>alert("xss")</script>';
      const original = content;
      const rules = ['unicode-normalization', 'escape-neutralization'];

      const token = generator.generateToken(content, original, rules);
      const validation = generator.validateToken(token);

      expect(validation.isValid).toBe(true);
    });

    it('should maintain token validity across generator instances with same secret', () => {
      const gen1 = new TrustTokenGenerator({ secret: testSecret });
      const gen2 = new TrustTokenGenerator({ secret: testSecret });

      const token = gen1.generateToken('content', 'original', ['rule']);
      const validation = gen2.validateToken(token);

      expect(validation.isValid).toBe(true);
    });

    it('should reject tokens from different secrets', () => {
      const gen1 = new TrustTokenGenerator({ secret: testSecret });
      const gen2 = new TrustTokenGenerator({ secret: 'different-secret' });

      const token = gen1.generateToken('content', 'original', ['rule']);
      const validation = gen2.validateToken(token);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid token signature');
    });
  });
});
