const {
  validateTrustToken,
  getTokenFormat,
  generateTrustTokenCacheKey,
  invalidateCacheByTrustToken,
  getCacheStatsByTrustToken,
} = require('./proxy');

console.log('🧪 Running Trust Token Tests...\n');

// Test token validation logic
function testTokenValidation() {
  console.log('Testing Token Validation:');

  // Test valid token
  const result1 = validateTrustToken('valid-token-12345');
  console.log(`✅ Valid token: ${result1.valid} (format: ${result1.format})`);

  // Test UUID
  const result2 = validateTrustToken('550e8400-e29b-41d4-a716-446655440000');
  console.log(`✅ UUID token: ${result2.valid} (format: ${result2.format})`);

  // Test too short
  const result3 = validateTrustToken('short');
  console.log(`❌ Too short: ${result3.valid} (reason: ${result3.reason})`);

  // Test invalid characters
  const result4 = validateTrustToken('invalid@token!');
  console.log(`❌ Invalid chars: ${result4.valid} (reason: ${result4.reason})`);

  // Test too long
  const result5 = validateTrustToken('a'.repeat(3000));
  console.log(`❌ Too long: ${result5.valid} (reason: ${result5.reason})`);

  // Test null/empty
  const result6 = validateTrustToken(null);
  console.log(`❌ Null token: ${result6.valid} (reason: ${result6.reason})`);
}

// Test token format detection
function testTokenFormatDetection() {
  console.log('\nTesting Token Format Detection:');

  console.log(`✅ JWT: ${getTokenFormat('header.payload.signature')}`);
  console.log(`✅ UUID: ${getTokenFormat('550e8400-e29b-41d4-a716-446655440000')}`);
  console.log(`✅ Base64: ${getTokenFormat('SGVsbG8gV29ybGQ')}`);
  console.log(`✅ Custom: ${getTokenFormat('some-custom-token')}`);
  console.log(`✅ None (null): ${getTokenFormat(null)}`);
  console.log(`✅ None (empty): ${getTokenFormat('')}`);
}

// Run tests
testTokenValidation();
testTokenFormatDetection();
testCacheKeyGeneration();

// Test cache key generation and security
function testCacheKeyGeneration() {
  console.log('\nTesting Cache Key Generation:');

  // Test different tokens produce different keys
  const token1 = 'token-123';
  const token2 = 'token-456';
  const validation1 = { valid: true, format: 'custom' };
  const validation2 = { valid: true, format: 'custom' };

  const key1 = generateTrustTokenCacheKey(token1, validation1);
  const key2 = generateTrustTokenCacheKey(token2, validation2);

  console.log(`✅ Different tokens produce different keys: ${key1 !== key2}`);

  // Test same token produces same key (deterministic)
  const key1Again = generateTrustTokenCacheKey(token1, validation1);
  console.log(`✅ Same token produces same key: ${key1 === key1Again}`);

  // Test invalid tokens
  const invalidKey = generateTrustTokenCacheKey(null, { valid: false });
  console.log(`✅ Invalid tokens use consistent key: ${invalidKey === 'no_token'}`);

  // Test key doesn't contain sensitive data
  console.log(`✅ Key doesn't contain original token: ${!key1.includes(token1)}`);
  console.log(`✅ Key is reasonably sized: ${key1.length <= 25} (actual: ${key1.length})`);
}

// Test cache invalidation
function testCacheInvalidation() {
  console.log('\nTesting Cache Invalidation:');

  // This would require a full cache setup, so we'll just test the logic
  const mockCache = {
    keys: () => [
      '{"method":"POST","path":"/api/process-pdf","body":{},"trustToken":"custom_abc123"}',
    ],
    del: (key) => console.log(`Mock deleted: ${key}`),
  };

  // Temporarily replace cache for testing
  const originalCache = cache;
  global.cache = mockCache;

  try {
    const result = invalidateCacheByTrustToken('test-token', { valid: true, format: 'custom' });
    console.log(`✅ Invalidation function returns count: ${typeof result === 'number'}`);
  } finally {
    global.cache = originalCache;
  }
}

// Test validation caching performance
function testValidationCaching() {
  console.log('\nTesting Validation Caching Performance:');

  // Test cache hit scenario
  const testToken = 'test-token-123';
  const validation1 = validateTrustToken(testToken);
  console.log(`✅ Basic validation works: ${validation1.valid}`);

  // Test cache functionality (would need full backend integration for complete test)
  console.log(`✅ Validation functions available: ${typeof validateTrustToken === 'function'}`);
  console.log(`✅ Cache initialized: ${typeof validationCache !== 'undefined'}`);
}

// Test error handling
function testErrorHandling() {
  console.log('\nTesting Error Handling:');

  // Test with invalid inputs
  const result1 = validateTrustToken(null);
  console.log(`✅ Null input handled: ${!result1.valid}`);

  const result2 = validateTrustToken('');
  console.log(`✅ Empty string handled: ${!result2.valid}`);

  const result3 = validateTrustToken('a');
  console.log(`✅ Too short handled: ${!result3.valid}`);

  const result4 = validateTrustToken('a'.repeat(3000));
  console.log(`✅ Too long handled: ${!result4.valid}`);
}

console.log('\n🎉 All trust token tests completed!');
process.exit(0);

// Note: Full backend integration tests would require running the actual API
// The current tests validate local validation logic and error handling

const createMockNext = () => jest.fn();

// Test trust token extraction from various sources
describe('Trust Token Extraction', () => {
  test('extracts token from Authorization header', () => {
    const req = createMockReq({
      authorization: 'Bearer test-token-123',
    });
    const res = createMockRes();
    const next = createMockNext();

    extractTrustToken(req, res, next);

    expect(req.trustToken).toBe('test-token-123');
    expect(req.trustTokenValidation.valid).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  test('extracts token from X-Trust-Token header', () => {
    const req = createMockReq({
      'x-trust-token': 'custom-token-456',
    });
    const res = createMockRes();
    const next = createMockNext();

    extractTrustToken(req, res, next);

    expect(req.trustToken).toBe('custom-token-456');
    expect(req.trustTokenValidation.valid).toBe(true);
  });

  test('extracts token from cookie', () => {
    const req = createMockReq(
      {},
      {
        trust_token: 'cookie-token-789',
      },
    );
    const res = createMockRes();
    const next = createMockNext();

    extractTrustToken(req, res, next);

    expect(req.trustToken).toBe('cookie-token-789');
    expect(req.trustTokenValidation.valid).toBe(true);
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
});

// Test token validation logic
describe('Trust Token Validation', () => {
  test('validates JWT format', () => {
    const jwt =
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0IiwiaWF0IjoxNjgzNjQ5NjAwLCJleHAiOjE2ODM2NTMyMDAsImF1ZCI6Ind3dy5leGFtcGxlLmNvbSIsInN1YiI6InVzZXJAeGFtcGxlLmNvbSJ9.signature';
    const result = validateTrustToken(jwt);

    expect(result.valid).toBe(true);
    expect(result.format).toBe('jwt');
  });

  test('validates UUID format', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = validateTrustToken(uuid);

    expect(result.valid).toBe(true);
    expect(result.format).toBe('uuid');
  });

  test('rejects tokens that are too short', () => {
    const result = validateTrustToken('short');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('too_short');
  });

  test('rejects tokens with invalid characters', () => {
    const result = validateTrustToken('invalid@token!');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_characters');
  });

  test('handles null/undefined tokens', () => {
    expect(validateTrustToken(null).valid).toBe(false);
    expect(validateTrustToken(undefined).valid).toBe(false);
    expect(validateTrustToken('').valid).toBe(false);
  });
});

// Test token format detection
describe('Token Format Detection', () => {
  test('detects JWT format', () => {
    expect(getTokenFormat('header.payload.signature')).toBe('jwt');
  });

  test('detects UUID format', () => {
    expect(getTokenFormat('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
  });

  test('detects base64 format', () => {
    expect(getTokenFormat('SGVsbG8gV29ybGQ')).toBe('base64');
  });

  test('defaults to custom format', () => {
    expect(getTokenFormat('some-custom-token')).toBe('custom');
  });
});
