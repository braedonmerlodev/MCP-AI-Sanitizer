const {
  validateTrustToken,
  getTokenFormat,
  extractTrustToken,
  generateTrustTokenCacheKey,
  invalidateCacheByTrustToken,
  getCacheStatsByTrustToken,
} = require('./proxy');

// Mock winston logger to avoid console output during tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('Trust Token Validation', () => {
  describe('validateTrustToken', () => {
    test('validates basic alphanumeric token', () => {
      const result = validateTrustToken('valid-token-12345');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('custom');
    });

    test('validates UUID format', () => {
      const result = validateTrustToken('550e8400-e29b-41d4-a716-446655440000');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('uuid');
    });

    test('validates JWT format', () => {
      const jwt = 'header.payload.signature';
      const result = validateTrustToken(jwt);
      expect(result.valid).toBe(true);
      expect(result.format).toBe('jwt');
    });

    test('validates base64 format', () => {
      const result = validateTrustToken('SGVsbG8gV29ybGQgVGVzdCBTdHJpbmcgTG9uZ2Vy');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('base64');
    });

    test('rejects tokens that are too short', () => {
      const result = validateTrustToken('short');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('too_short');
    });

    test('rejects tokens that are too long', () => {
      const longToken = 'a'.repeat(3000);
      const result = validateTrustToken(longToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('too_long');
    });

    test('rejects tokens with invalid characters', () => {
      const result = validateTrustToken('invalid@token!');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_characters');
    });

    test('rejects invalid JWT format (wrong number of dots)', () => {
      const result = validateTrustToken('header.signature');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_jwt_format');
    });

    test('rejects invalid base64', () => {
      const result = validateTrustToken(
        'invalid-base64-string-that-is-long-enough-to-be-detected-as-base64-but-invalid',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_base64');
    });

    test('handles null input', () => {
      const result = validateTrustToken(null);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_or_invalid_type');
    });

    test('handles undefined input', () => {
      const result = validateTrustToken(undefined);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_or_invalid_type');
    });

    test('handles empty string', () => {
      const result = validateTrustToken('');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_or_invalid_type');
    });

    test('handles non-string input', () => {
      const result = validateTrustToken(12345);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_or_invalid_type');
    });
  });

  describe('getTokenFormat', () => {
    test('detects JWT format', () => {
      expect(getTokenFormat('header.payload.signature')).toBe('jwt');
    });

    test('detects UUID format', () => {
      expect(getTokenFormat('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
    });

    test('detects base64 format', () => {
      expect(getTokenFormat('SGVsbG8gV29ybGQgVGVzdCBTdHJpbmcgTG9uZ2Vy')).toBe('base64');
    });

    test('defaults to custom format', () => {
      expect(getTokenFormat('some-custom-token')).toBe('custom');
    });

    test('handles null input', () => {
      expect(getTokenFormat(null)).toBe('none');
    });

    test('handles empty string', () => {
      expect(getTokenFormat('')).toBe('none');
    });
  });

  describe('generateTrustTokenCacheKey', () => {
    test('generates consistent key for same valid token', () => {
      const token = 'test-token-123';
      const validation = { valid: true, format: 'custom' };
      const key1 = generateTrustTokenCacheKey(token, validation);
      const key2 = generateTrustTokenCacheKey(token, validation);
      expect(key1).toBe(key2);
    });

    test('generates different keys for different tokens', () => {
      const validation = { valid: true, format: 'custom' };
      const key1 = generateTrustTokenCacheKey('token1', validation);
      const key2 = generateTrustTokenCacheKey('token2', validation);
      expect(key1).not.toBe(key2);
    });

    test('uses consistent key for invalid tokens', () => {
      const key1 = generateTrustTokenCacheKey(null, { valid: false });
      const key2 = generateTrustTokenCacheKey('invalid', { valid: false });
      expect(key1).toBe('no_token');
      expect(key2).toBe('no_token');
    });

    test('includes format in key', () => {
      const token = 'test-token';
      const validation = { valid: true, format: 'uuid' };
      const key = generateTrustTokenCacheKey(token, validation);
      expect(key.startsWith('uuid_')).toBe(true);
    });

    test('does not expose original token in key', () => {
      const token = 'sensitive-token-123';
      const validation = { valid: true, format: 'custom' };
      const key = generateTrustTokenCacheKey(token, validation);
      expect(key.includes(token)).toBe(false);
    });

    test('generates reasonably sized key', () => {
      const token = 'test-token';
      const validation = { valid: true, format: 'custom' };
      const key = generateTrustTokenCacheKey(token, validation);
      expect(key.length).toBeLessThanOrEqual(25);
    });
  });
});

describe('Trust Token Extraction Middleware', () => {
  const createMockReq = (headers = {}, cookies = {}) => ({
    get: jest.fn((header) => headers[header.toLowerCase()]),
    cookies,
    method: 'POST',
    path: '/api/test',
    ip: '127.0.0.1',
    requestId: 'test-request-id',
  });

  const createMockRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  const createMockNext = () => jest.fn();

  describe('extractTrustToken', () => {
    test('extracts token from Authorization header', () => {
      const req = createMockReq({ authorization: 'Bearer test-token-123' });
      const res = createMockRes();
      const next = createMockNext();

      extractTrustToken(req, res, next);

      expect(req.trustToken).toBe('test-token-123');
      expect(req.trustTokenValidation.valid).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    test('extracts token from X-Trust-Token header', () => {
      const req = createMockReq({ 'x-trust-token': 'custom-token-456' });
      const res = createMockRes();
      const next = createMockNext();

      extractTrustToken(req, res, next);

      expect(req.trustToken).toBe('custom-token-456');
      expect(req.trustTokenValidation.valid).toBe(true);
    });

    test('extracts token from cookie', () => {
      const req = createMockReq({}, { trust_token: 'cookie-token-789' });
      const res = createMockRes();
      const next = createMockNext();

      extractTrustToken(req, res, next);

      expect(req.trustToken).toBe('cookie-token-789');
      expect(req.trustTokenValidation.valid).toBe(true);
    });

    test('prioritizes Authorization header over others', () => {
      const req = createMockReq(
        {
          authorization: 'Bearer auth-token',
          'x-trust-token': 'header-token',
        },
        { trust_token: 'cookie-token' },
      );
      const res = createMockRes();
      const next = createMockNext();

      extractTrustToken(req, res, next);

      expect(req.trustToken).toBe('auth-token');
    });

    test('prioritizes X-Trust-Token over cookie', () => {
      const req = createMockReq(
        { 'x-trust-token': 'header-token' },
        { trust_token: 'cookie-token' },
      );
      const res = createMockRes();
      const next = createMockNext();

      extractTrustToken(req, res, next);

      expect(req.trustToken).toBe('header-token');
    });

    test('handles missing token gracefully', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      extractTrustToken(req, res, next);

      expect(req.trustToken).toBeNull();
      expect(req.trustTokenValidation.valid).toBe(false);
      expect(next).toHaveBeenCalled();
    });

    test('handles invalid token format', () => {
      const req = createMockReq({ authorization: 'Bearer short' });
      const res = createMockRes();
      const next = createMockNext();

      extractTrustToken(req, res, next);

      expect(req.trustToken).toBe('short');
      expect(req.trustTokenValidation.valid).toBe(false);
      expect(req.trustTokenValidation.reason).toBe('too_short');
    });

    test('sets requestId on req object', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      extractTrustToken(req, res, next);

      expect(req.requestId).toBeDefined();
      expect(typeof req.requestId).toBe('string');
    });
  });
});

// Cache management functions require integration testing with actual cache instances
// Unit tests for cache logic would require mocking NodeCache, which is complex
// These functions are tested in integration tests
