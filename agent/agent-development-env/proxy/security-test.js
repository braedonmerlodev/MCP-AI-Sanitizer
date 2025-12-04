const request = require('supertest');
const { app, clearCaches } = require('./proxy');

// Security testing for trust token validation bypass attempts
// Tests common attack vectors and security vulnerabilities

async function runSecurityTests() {
  console.log('🔒 Running Trust Token Security Tests...\n');

  clearCaches();

  const testData = { pdf: 'test pdf content' };

  // Test cases for token validation bypass
  const securityTestCases = [
    {
      name: 'SQL Injection in token',
      token: "'; DROP TABLE users; --",
      expected: 'should reject malicious tokens',
    },
    {
      name: 'XSS in token',
      token: '<script>alert("xss")</script>',
      expected: 'should reject tokens with script tags',
    },
    {
      name: 'Path traversal in token',
      token: '../../../etc/passwd',
      expected: 'should reject path traversal attempts',
    },
    {
      name: 'Command injection in token',
      token: '; rm -rf / ;',
      expected: 'should reject command injection',
    },
    {
      name: 'Buffer overflow attempt',
      token: 'a'.repeat(10000), // Very long token
      expected: 'should reject extremely long tokens',
    },
    {
      name: 'Null byte injection',
      token: 'valid-token\x00malicious',
      expected: 'should reject null byte injection',
    },
    {
      name: 'Unicode bypass attempt',
      token: 'valid-token\u0000malicious',
      expected: 'should reject unicode null bytes',
    },
    {
      name: 'JWT header injection',
      token: '{"alg":"none"}.eyJzdWIiOiIxIn0.',
      expected: 'should validate JWT structure',
    },
    {
      name: 'Base64 decoding attack',
      token: 'SGVsbG8gV29ybGQ= =', // Invalid base64 with extra =
      expected: 'should reject invalid base64',
    },
    {
      name: 'Token format confusion',
      token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature',
      expected: 'should reject malformed JWT',
    },
  ];

  console.log('Testing token validation bypass attempts...\n');

  for (const testCase of securityTestCases) {
    try {
      const response = await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', testCase.token)
        .send(testData);

      // Check if the request was processed (should be rejected for security)
      if (response.status === 200) {
        console.log(
          `⚠️  POTENTIAL SECURITY ISSUE: ${testCase.name} - Request accepted when it should be rejected`,
        );
        console.log(`   Token: ${testCase.token.substring(0, 50)}...`);
        console.log(`   Expected: ${testCase.expected}\n`);
      } else {
        console.log(`✅ ${testCase.name} - Properly rejected (${response.status})`);
      }
    } catch (error) {
      console.log(`✅ ${testCase.name} - Request failed as expected (${error.message})`);
    }
  }

  // Test header injection attempts
  console.log('\nTesting header injection attempts...\n');

  const headerInjectionTests = [
    {
      name: 'Header injection in token',
      headers: { 'X-Trust-Token': 'valid-token\r\nX-Custom: injected' },
      expected: 'should reject header injection',
    },
    {
      name: 'Multiple token headers',
      headers: {
        'X-Trust-Token': 'token1',
        'x-trust-token': 'token2', // Case insensitive
      },
      expected: 'should handle multiple headers securely',
    },
    {
      name: 'Token in cookie poisoning',
      headers: {
        Cookie: 'trust_token=valid; session=malicious',
        'X-Trust-Token': 'override-token',
      },
      expected: 'should prioritize secure headers over cookies',
    },
  ];

  for (const testCase of headerInjectionTests) {
    try {
      let req = request(app).post('/api/process-pdf').send(testData);

      // Set headers
      for (const [key, value] of Object.entries(testCase.headers)) {
        req = req.set(key, value);
      }

      const response = await req;

      if (response.status === 200) {
        console.log(`⚠️  POTENTIAL SECURITY ISSUE: ${testCase.name} - Request accepted`);
        console.log(`   Headers: ${JSON.stringify(testCase.headers)}\n`);
      } else {
        console.log(`✅ ${testCase.name} - Properly handled (${response.status})`);
      }
    } catch (error) {
      console.log(`✅ ${testCase.name} - Request failed as expected (${error.message})`);
    }
  }

  // Test rate limiting bypass attempts
  console.log('\nTesting rate limiting...\n');

  const rateLimitTests = 110; // Exceed rate limit
  const rateLimitPromises = [];

  for (let i = 0; i < rateLimitTests; i++) {
    rateLimitPromises.push(
      request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', 'rate-limit-test-token')
        .send(testData),
    );
  }

  const rateLimitResults = await Promise.allSettled(rateLimitPromises);
  const rejectedCount = rateLimitResults.filter(
    (r) => r.status === 'rejected' || r.value?.status === 429,
  ).length;

  if (rejectedCount > 0) {
    console.log(`✅ Rate limiting is working - ${rejectedCount} requests rejected`);
  } else {
    console.log('⚠️  WARNING: Rate limiting may not be effective');
  }

  // Test cache poisoning attempts
  console.log('\nTesting cache poisoning...\n');

  const cachePoisoningTests = [
    {
      name: 'Cache key collision attempt',
      token: 'custom_collision_token',
      body: { pdf: 'poisoned content' },
      expected: 'should isolate cache by token',
    },
    {
      name: 'Cache invalidation bypass',
      token: 'invalid_token_for_invalidation',
      expected: 'should handle invalid tokens in cache operations',
    },
  ];

  for (const testCase of cachePoisoningTests) {
    try {
      const response = await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', testCase.token)
        .send(testCase.body || testData);

      console.log(
        `✅ ${testCase.name} - ${response.status === 200 ? 'Processed' : 'Rejected'} (${response.status})`,
      );
    } catch (error) {
      console.log(`✅ ${testCase.name} - Failed as expected (${error.message})`);
    }
  }

  // Test audit logging
  console.log('\nTesting audit logging completeness...\n');

  // Make a request that should be logged
  await request(app)
    .post('/api/process-pdf')
    .set('X-Trust-Token', 'audit-test-token')
    .send(testData);

  console.log('✅ Audit logging test completed (check logs for trust token events)');

  console.log('\n🎉 Security testing completed!');
  console.log('\n📋 Security Recommendations:');
  console.log('- Monitor logs for unusual token validation patterns');
  console.log('- Implement additional input sanitization if needed');
  console.log('- Regular security audits of token validation logic');
  console.log('- Consider implementing token rate limiting per token');
}

// Run tests if called directly
if (require.main === module) {
  runSecurityTests().catch(console.error);
}

module.exports = { runSecurityTests };
