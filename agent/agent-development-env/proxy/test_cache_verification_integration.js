const {
  performBackendValidation,
  validateTrustToken,
  cache,
  validationCache,
  clearCaches,
} = require('./proxy');

// Mock axios for testing
jest.mock('axios');
const axios = require('axios');

describe('Cache Verification Integration Tests', () => {
  beforeEach(() => {
    // Clear cache state between tests for consistent test results
    clearCaches();
    jest.clearAllMocks();
  });

  describe('Backend Validation Integration', () => {
    test('should validate trust tokens with backend API', async () => {
      // Mock successful validation
      axios.post.mockResolvedValue({
        data: { valid: true },
        status: 200,
      });

      const result = await performBackendValidation('valid-token');

      expect(result.isValid).toBe(true);
      expect(result.validationType).toBe('full_backend');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/trust-tokens/validate'),
        'valid-token',
        expect.any(Object),
      );
    });

    test('should handle invalid tokens from backend', async () => {
      // Mock invalid token response
      axios.post.mockResolvedValue({
        data: { valid: false, error: 'Token expired' },
        status: 200,
      });

      const result = await performBackendValidation('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(result.validationType).toBe('full_backend');
    });

    test('should handle validation service errors gracefully', async () => {
      // Mock network error
      axios.post.mockRejectedValue(new Error('Network error'));

      const result = await performBackendValidation('test-token');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation service error');
      expect(result.validationType).toBe('backend_error');
    });

    test('should use validation result caching', async () => {
      // Mock successful validation
      axios.post.mockResolvedValue({
        data: { valid: true },
        status: 200,
      });

      // First call should hit API
      await performBackendValidation('cached-token');
      expect(axios.post).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await performBackendValidation('cached-token');
      expect(axios.post).toHaveBeenCalledTimes(1); // Still 1 call
    });
  });

  describe('Performance Validation', () => {
    test('should validate backend validation performance', async () => {
      // Mock fast validation response
      axios.post.mockResolvedValue({
        data: { valid: true },
        status: 200,
      });

      const startTime = Date.now();
      await performBackendValidation('perf-test-token');
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    test('should handle concurrent validation requests', async () => {
      // Mock axios to resolve for any token
      axios.post.mockImplementation(() => Promise.resolve({
        data: { valid: true },
        status: 200
      }));

      // Create multiple concurrent validation requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(performBackendValidation(`token-${i}`));
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.isValid).toBe(true);
        expect(result.validationType).toBe('full_backend');
      });
    });

      // Create multiple concurrent validation requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(performBackendValidation(`token-${i}`));
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Cache Management Integration', () => {
    test('should properly manage cache state', () => {
      // Test cache clearing
      cache.set('test-key', 'test-value');
      validationCache.set('test-validation', { isValid: true });

      expect(cache.get('test-key')).toBe('test-value');
      expect(validationCache.get('test-validation')).toEqual({ isValid: true });

      // Clear caches
      clearCaches();

      expect(cache.get('test-key')).toBeUndefined();
      expect(validationCache.get('test-validation')).toBeUndefined();
    });

    test('should handle cache key generation consistently', () => {
      const { generateTrustTokenCacheKey } = require('./proxy');

      const validation = { valid: true, format: 'custom' };
      const key1 = generateTrustTokenCacheKey('test-token', validation);
      const key2 = generateTrustTokenCacheKey('test-token', validation);

      expect(key1).toBe(key2); // Same token should produce same key
      expect(typeof key1).toBe('string');
      expect(key1.length).toBeGreaterThan(0);
    });
  });

  describe('Security Validation', () => {
    test('should reject malformed tokens', () => {
      const malformedTokens = [
        '',
        null,
        undefined,
        '@invalid@token!',
        'a'.repeat(3000), // Too long
        'short', // Too short
      ];

      malformedTokens.forEach((token) => {
        const result = validateTrustToken(token);
        expect(result.valid).toBe(false);
      });
    });

    test('should accept valid token formats', () => {
      const validTokens = [
        'valid-token-123',
        '550e8400-e29b-41d4-a716-446655440000', // UUID
      ];

      validTokens.forEach((token) => {
        const result = validateTrustToken(token);
        expect(result.valid).toBe(true);
      });
    });
  });
});
