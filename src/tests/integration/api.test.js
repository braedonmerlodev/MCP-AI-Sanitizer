// Mock environment variable for trust token secret BEFORE requiring modules
process.env.TRUST_TOKEN_SECRET = 'test-secret-key-for-integration-tests';

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

describe('API Integration Tests - Access Validation Middleware', () => {
  let app;
  let trustTokenGenerator;
  let validToken;
  let expiredToken;
  let invalidSignatureToken;

  beforeAll(() => {
    // Initialize trust token generator
    trustTokenGenerator = new TrustTokenGenerator();

    // Create test tokens
    const sanitizedContent = 'This is sanitized content';
    const originalContent = 'This is original content';
    const rulesApplied = ['symbol_stripping'];

    // Valid token
    validToken = trustTokenGenerator.generateToken(sanitizedContent, originalContent, rulesApplied);

    // Expired token (set expiration to past)
    expiredToken = { ...validToken };
    expiredToken.expiresAt = new Date(Date.now() - 3_600_000).toISOString(); // 1 hour ago
    // Recalculate signature for expired token
    const signaturePayload = {
      contentHash: expiredToken.contentHash,
      originalHash: expiredToken.originalHash,
      sanitizationVersion: expiredToken.sanitizationVersion,
      rulesApplied: expiredToken.rulesApplied,
      timestamp: expiredToken.timestamp,
      expiresAt: expiredToken.expiresAt,
    };
    expiredToken.signature = require('node:crypto')
      .createHmac('sha256', process.env.TRUST_TOKEN_SECRET)
      .update(JSON.stringify(signaturePayload))
      .digest('hex');

    // Invalid signature token
    invalidSignatureToken = { ...validToken };
    invalidSignatureToken.signature = 'invalid-signature';
  });

  beforeEach(() => {
    // Create Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
  });

  describe('Document Upload Endpoint (/api/documents/upload)', () => {
    test('should reject requests without trust token', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        )
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Trust token required');
      expect(response.body.message).toContain(
        'Trust token is required for AI agent document access',
      );
    });

    test('should reject requests with invalid trust token', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('x-trust-token', JSON.stringify(invalidSignatureToken))
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        )
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid trust token');
    });

    test('should reject requests with expired trust token', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('x-trust-token', JSON.stringify(expiredToken))
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        )
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid trust token');
      expect(response.body.message).toContain('expired');
    });

    test('should accept requests with valid trust token', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('x-trust-token', JSON.stringify(validToken))
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        )
        .set('Content-Type', 'multipart/form-data');

      // Should proceed to PDF processing (may fail due to mock PDF, but middleware should pass)
      expect(response.status).not.toBe(403);
    });
  });

  describe('PDF Generation Endpoint (/api/documents/generate-pdf)', () => {
    test('should reject requests without trust token', async () => {
      const response = await request(app).post('/api/documents/generate-pdf').send({
        data: 'Test content',
        trustToken: validToken,
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Trust token required');
    });

    test('should reject requests with invalid trust token', async () => {
      const response = await request(app)
        .post('/api/documents/generate-pdf')
        .set('x-trust-token', JSON.stringify(invalidSignatureToken))
        .send({
          data: 'Test content',
          trustToken: validToken,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid trust token');
    });

    test('should accept requests with valid trust token', async () => {
      const response = await request(app)
        .post('/api/documents/generate-pdf')
        .set('x-trust-token', JSON.stringify(validToken))
        .send({
          data: 'Test content',
          trustToken: validToken,
        });

      // Should proceed to PDF generation (may fail due to missing components, but middleware should pass)
      expect(response.status).not.toBe(403);
    });
  });

  describe('Backward Compatibility - Non-Protected Endpoints', () => {
    test('should allow access to /api/sanitize without trust token', async () => {
      const response = await request(app).post('/api/sanitize').send({ data: 'test data' });

      expect(response.status).not.toBe(403);
      expect(response.status).toBe(200);
    });

    test('should allow access to /api/webhook/n8n without trust token', async () => {
      const response = await request(app)
        .post('/api/webhook/n8n')
        .send({ data: 'test webhook data' });

      expect(response.status).not.toBe(403);
      expect(response.status).toBe(200);
    });

    test('should allow access to /api/trust-tokens/validate without trust token', async () => {
      const response = await request(app).post('/api/trust-tokens/validate').send(validToken);

      expect(response.status).not.toBe(403);
      expect(response.status).toBe(200);
    });
  });

  describe('Performance Tests', () => {
    test('middleware overhead should be less than 2ms', async () => {
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .post('/api/documents/generate-pdf')
          .set('x-trust-token', JSON.stringify(validToken))
          .send({
            data: 'Test content for performance measurement',
            trustToken: validToken,
          });
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000; // Convert to milliseconds
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(
        `Performance test results: Average ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );

      // Allow some buffer for test environment variability
      expect(averageTime).toBeLessThan(2);
      expect(maxTime).toBeLessThan(5); // Max should also be reasonable
    });
  });

  describe('Security Tests - Bypass Prevention', () => {
    test('should reject malformed JSON in trust token header', async () => {
      const malformedTokens = ['{invalid json', 'null', '"string"', '123', '[]'];

      for (const token of malformedTokens) {
        const response = await request(app)
          .post('/api/documents/upload')
          .set('x-trust-token', token)
          .attach(
            'pdf',
            Buffer.from(
              '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
            ),
            'test.pdf',
          )
          .set('Content-Type', 'multipart/form-data');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid trust token format');
      }
    });

    test('should reject tokens with tampered signature', async () => {
      const tamperedToken = { ...validToken };
      tamperedToken.signature = tamperedToken.signature.replace(/.$/, 'x'); // Change last character

      const response = await request(app)
        .post('/api/documents/upload')
        .set('x-trust-token', JSON.stringify(tamperedToken))
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        )
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid trust token');
    });

    test('should reject tokens with missing required fields', async () => {
      const incompleteTokens = [
        { signature: 'sig' }, // Missing all other fields
        { ...validToken, contentHash: undefined }, // Missing contentHash
        { ...validToken, signature: undefined }, // Missing signature
      ];

      for (const token of incompleteTokens) {
        const response = await request(app)
          .post('/api/documents/upload')
          .set('x-trust-token', JSON.stringify(token))
          .attach(
            'pdf',
            Buffer.from(
              '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
            ),
            'test.pdf',
          )
          .set('Content-Type', 'multipart/form-data');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid trust token');
      }
    });
    test('should allow access to /api/webhook/n8n without trust token', async () => {
      const response = await request(app)
        .post('/api/webhook/n8n')
        .send({ data: 'test webhook data' });

      expect(response.status).not.toBe(403);
      expect(response.status).toBe(200);
    });

    test('should allow access to /api/trust-tokens/validate without trust token', async () => {
      const response = await request(app).post('/api/trust-tokens/validate').send(validToken);

      expect(response.status).not.toBe(403);
      expect(response.status).toBe(200);
    });
  });

  describe('Performance Tests', () => {
    test('middleware overhead should be less than 2ms', async () => {
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .post('/api/documents/generate-pdf')
          .set('x-trust-token', JSON.stringify(validToken))
          .send({
            data: 'Test content for performance measurement',
            trustToken: validToken,
          });
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000; // Convert to milliseconds
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(
        `Performance test results: Average ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );

      // Allow some buffer for test environment variability
      expect(averageTime).toBeLessThan(2);
      expect(maxTime).toBeLessThan(5); // Max should also be reasonable
    });
  });

  describe('Security Tests - Bypass Prevention', () => {
    test('should reject malformed JSON in trust token header', async () => {
      const malformedTokens = ['{invalid json', 'null', '"string"', '123', '[]'];

      for (const token of malformedTokens) {
        const response = await request(app)
          .post('/api/documents/upload')
          .set('x-trust-token', token)
          .attach(
            'pdf',
            Buffer.from(
              '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
            ),
            'test.pdf',
          )
          .set('Content-Type', 'multipart/form-data');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid trust token format');
      }
    });

    test('should reject tokens with tampered signature', async () => {
      const tamperedToken = { ...validToken };
      tamperedToken.signature = tamperedToken.signature.replace(/.$/, 'x'); // Change last character

      const response = await request(app)
        .post('/api/documents/upload')
        .set('x-trust-token', JSON.stringify(tamperedToken))
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        )
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid trust token');
    });

    test('should reject tokens with missing required fields', async () => {
      const incompleteTokens = [
        { signature: 'sig' }, // Missing all other fields
        { ...validToken, contentHash: undefined }, // Missing contentHash
        { ...validToken, signature: undefined }, // Missing signature
      ];

      for (const token of incompleteTokens) {
        const response = await request(app)
          .post('/api/documents/upload')
          .set('x-trust-token', JSON.stringify(token))
          .attach(
            'pdf',
            Buffer.from(
              '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
            ),
            'test.pdf',
          )
          .set('Content-Type', 'multipart/form-data');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid trust token');
      }
    });
  });
});
