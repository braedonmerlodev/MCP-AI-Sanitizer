// Mock environment variable for trust token secret BEFORE requiring modules
process.env.TRUST_TOKEN_SECRET = 'test-secret-key-for-integration-tests';

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

// Mock pdfjs-dist for testing
jest.mock('pdfjs-dist', () => ({
  getDocument: jest.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 5,
      getMetadata: jest.fn().mockResolvedValue({
        info: {
          Title: 'Test PDF Document',
          Author: 'Test Author',
          Subject: 'Test Subject',
          Creator: 'Test Creator',
          Producer: 'Test Producer',
          CreationDate: 'D:20231101120000',
          ModDate: 'D:20231101120000',
        },
      }),
      getPage: jest.fn().mockImplementation(() => ({
        getTextContent: jest.fn().mockResolvedValue({
          items: [
            { str: 'Test Document' },
            { str: '\n\nThis is a test PDF document.' },
            { str: '\n\nSection 1' },
            { str: '\n\n- Item 1' },
            { str: '\n- Item 2' },
            { str: '\n\n1. Numbered item' },
            { str: '\n2. Another item' },
          ],
        }),
      })),
    }),
  }),
  GlobalWorkerOptions: {
    workerSrc: '',
  },
}));

// Mock MarkdownConverter for testing
jest.mock('../../components/MarkdownConverter', () => {
  return jest.fn().mockImplementation(() => ({
    convert: jest
      .fn()
      .mockReturnValue(
        '# Test Document\n\nThis is a test PDF document.\n\n## Section 1\n\n- Item 1\n- Item 2\n\n1. Numbered item\n2. Another item',
      ),
  }));
});

// Mock access validation middleware for testing
jest.mock('../../middleware/AccessValidationMiddleware', () => {
  return jest.fn((req, res, next) => next());
});

// Mock access control enforcer for testing
jest.mock('../../components/AccessControlEnforcer', () => {
  return jest.fn().mockImplementation(() => ({
    enforce: jest.fn().mockReturnValue({ allowed: true }),
  }));
});

// Mock TrustTokenGenerator for testing
jest.mock('../../components/TrustTokenGenerator', () => {
  return jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockReturnValue({
      contentHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72', // hash calculated in code
      originalHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
      sanitizationVersion: '1.0',
      rulesApplied: ['symbol_stripping'],
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(), // 1 hour from now
      signature: 'mock-signature',
    }),
    validateToken: jest.fn().mockReturnValue({ isValid: true }),
  }));
});

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

    test('/api/sanitize/json should respond in less than 100ms average', async () => {
      const iterations = 50;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .post('/api/sanitize/json')
          .set('x-trust-token', JSON.stringify(validToken))
          .send({
            content: 'Test content for performance measurement ' + i,
            classification: 'test',
          });
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000; // Convert to milliseconds
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(
        `/api/sanitize/json performance: Average ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );

      // Story 11.1 requirement: <100ms average response time
      expect(averageTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(200); // Allow some buffer
    });
  });

  describe('Admin Override API Tests', () => {
    const adminAuthHeader = 'test-admin-secret';
    const adminIdHeader = 'test-admin-user';

    describe('POST /api/admin/override/activate', () => {
      test('should activate admin override with valid credentials', async () => {
        const response = await request(app)
          .post('/api/admin/override/activate')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader)
          .send({
            justification: 'Emergency system maintenance required for critical security patch',
            duration: 900_000, // 15 minutes
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Admin override activated successfully');
        expect(response.body).toHaveProperty('overrideId');
        expect(response.body.adminId).toBe(adminIdHeader);
        expect(response.body.justification).toBe(
          'Emergency system maintenance required for critical security patch',
        );
        expect(response.body.duration).toBe(900_000);
      });

      test('should reject activation without admin auth', async () => {
        const response = await request(app).post('/api/admin/override/activate').send({
          justification: 'Test justification',
        });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication failed');
      });

      test('should reject activation with invalid justification', async () => {
        const response = await request(app)
          .post('/api/admin/override/activate')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader)
          .send({
            justification: 'short',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Justification required');
      });

      test('should use default duration when not specified', async () => {
        const response = await request(app)
          .post('/api/admin/override/activate')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader)
          .send({
            justification: 'Test default duration',
          });

        expect(response.status).toBe(200);
        expect(response.body.duration).toBe(900_000); // 15 minutes default
      });
    });

    describe('DELETE /api/admin/override/:overrideId', () => {
      let overrideId;

      beforeEach(async () => {
        // Activate an override for testing deactivation
        const activateResponse = await request(app)
          .post('/api/admin/override/activate')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader)
          .send({
            justification: 'Test deactivation',
          });

        overrideId = activateResponse.body.overrideId;
      });

      test('should deactivate active override', async () => {
        const response = await request(app)
          .delete(`/api/admin/override/${overrideId}`)
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Admin override deactivated successfully');
        expect(response.body.overrideId).toBe(overrideId);
      });

      test('should reject deactivation without auth', async () => {
        const response = await request(app).delete(`/api/admin/override/${overrideId}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication failed');
      });
    });

    describe('GET /api/admin/override/status', () => {
      test('should return override status', async () => {
        const response = await request(app)
          .get('/api/admin/override/status')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('activeOverrides');
        expect(response.body).toHaveProperty('maxConcurrent');
        expect(response.body).toHaveProperty('overrides');
        expect(Array.isArray(response.body.overrides)).toBe(true);
      });

      test('should reject status request without auth', async () => {
        const response = await request(app).get('/api/admin/override/status');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication failed');
      });
    });

    describe('Override Integration with Access Control', () => {
      let overrideId;

      beforeEach(async () => {
        // Activate override
        const activateResponse = await request(app)
          .post('/api/admin/override/activate')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader)
          .send({
            justification: 'Integration test override',
          });

        overrideId = activateResponse.body.overrideId;
      });

      afterEach(async () => {
        // Clean up override
        if (overrideId) {
          await request(app)
            .delete(`/api/admin/override/${overrideId}`)
            .set('x-admin-auth', adminAuthHeader)
            .set('x-admin-id', adminIdHeader);
        }
      });

      test('should allow access to protected endpoint when override is active', async () => {
        // This test verifies that the override bypasses access control
        // Since the override is active, access should be granted even without valid trust token
        const response = await request(app).post('/api/documents/generate-pdf').send({
          data: 'Test content',
          trustToken: {}, // Invalid token
        });

        // With override active, this should succeed (access granted via override)
        // Note: This assumes the override integration is working
        // In a real scenario, we'd check the response more specifically
        expect(response.status).not.toBe(403); // Should not be access denied
      });
    });

    describe('Security Tests - Override Abuse Prevention', () => {
      test('should reject override activation with invalid duration', async () => {
        const response = await request(app)
          .post('/api/admin/override/activate')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader)
          .send({
            justification: 'Test invalid duration',
            duration: 30_000, // 30 seconds - below minimum
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid duration');
      });

      test('should limit concurrent overrides', async () => {
        // First override
        await request(app)
          .post('/api/admin/override/activate')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader)
          .send({
            justification: 'First override',
          });

        // Second override should be rejected (assuming maxConcurrent = 1)
        const response = await request(app)
          .post('/api/admin/override/activate')
          .set('x-admin-auth', adminAuthHeader)
          .set('x-admin-id', adminIdHeader)
          .send({
            justification: 'Second override - should fail',
          });

        expect(response.status).toBe(429);
        expect(response.body.error).toBe('Concurrent override limit exceeded');
      });
    });
  });

  describe('Agent Sync Mode Tests', () => {
    test('should detect agent request via X-Agent-Key header', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .set('X-Agent-Key', 'agent-security-123')
        .set('User-Agent', 'SecurityAgent/1.0')
        .send({
          content: 'Test content for agent sanitization',
          async: true, // Should be overridden to sync
        });

      expect(response.status).toBe(200);
      expect(response.body.sanitizedContent).toBeDefined();
      expect(response.body.trustToken).toBeDefined();
      expect(response.headers['x-agent-request']).toBe('true');
      expect(response.headers['x-agent-type']).toBe('security');
    });

    test('should enforce sync mode for agent requests overriding async preference', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .set('X-API-Key', 'agent-monitor-456')
        .send({
          content: 'Test content for sync override',
          async: true, // This should be ignored for agents
        });

      expect(response.status).toBe(200);
      expect(response.body.sanitizedContent).toBeDefined();
      // Should not have async processing headers
      expect(response.headers['x-api-version']).toBeUndefined();
      expect(response.headers['x-async-processing']).toBeUndefined();
    });

    test('should support explicit sync=true parameter for non-agent requests', async () => {
      const response = await request(app).post('/api/sanitize/json?sync=true').send({
        content: 'Test content with sync parameter',
        async: true, // Should be overridden by query param
      });

      expect(response.status).toBe(200);
      expect(response.body.sanitizedContent).toBeDefined();
      // Should not have async processing headers
      expect(response.headers['x-api-version']).toBeUndefined();
      expect(response.headers['x-async-processing']).toBeUndefined();
    });

    test('should process large PDF synchronously for agent requests', async () => {
      // Create a large PDF buffer (>10MB threshold)
      const largePdfBuffer = Buffer.alloc(15 * 1024 * 1024, '%PDF-1.4\n'); // 15MB

      const response = await request(app)
        .post('/api/documents/upload?sync=true')
        .set('X-Agent-Key', 'agent-bmad-789')
        .set('x-trust-token', JSON.stringify(validToken))
        .attach('pdf', largePdfBuffer, 'large-test.pdf')
        .set('Content-Type', 'multipart/form-data');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('processed successfully');
      expect(response.body.sanitizedContent).toBeDefined();
      expect(response.body.trustToken).toBeDefined();
      // Should not have async processing headers
      expect(response.headers['x-api-version']).toBeUndefined();
      expect(response.headers['x-async-processing']).toBeUndefined();
    });

    test('should maintain <100ms response time for agent sanitization', async () => {
      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .post('/api/sanitize/json')
          .set('X-Agent-Key', 'agent-performance-test')
          .send({
            content: `Performance test content ${i}`,
          });
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(
        `Agent sync performance: Average ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );

      // Agent operations should be <100ms as per requirements
      expect(averageTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(100);
    });
  });

  describe('JSON Transformation', () => {
    test('should apply key normalization to camelCase', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({
            user_name: 'john',
            user_age: 30,
          }),
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
          },
        });

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.body.sanitizedContent);
      expect(parsed).toHaveProperty('userName');
      expect(parsed).toHaveProperty('userAge');
      expect(parsed).not.toHaveProperty('user_name');
      expect(parsed).not.toHaveProperty('user_age');
    });

    test('should apply key normalization to snake_case', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({
            userName: 'john',
            userAge: 30,
          }),
          transform: true,
          transformOptions: {
            normalizeKeys: 'snake_case',
          },
        });

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.body.sanitizedContent);
      expect(parsed).toHaveProperty('user_name');
      expect(parsed).toHaveProperty('user_age');
      expect(parsed).not.toHaveProperty('userName');
      expect(parsed).not.toHaveProperty('userAge');
    });

    test('should remove specified fields', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({
            name: 'john',
            password: 'secret',
            age: 30,
          }),
          transform: true,
          transformOptions: {
            removeFields: ['password'],
          },
        });

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.body.sanitizedContent);
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('age');
      expect(parsed).not.toHaveProperty('password');
    });

    test('should apply both normalization and field removal', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({
            user_name: 'john',
            user_password: 'secret',
            user_age: 30,
          }),
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
            removeFields: ['userPassword'],
          },
        });

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.body.sanitizedContent);
      expect(parsed).toHaveProperty('userName');
      expect(parsed).toHaveProperty('userAge');
      expect(parsed).not.toHaveProperty('user_name');
      expect(parsed).not.toHaveProperty('user_password');
      expect(parsed).not.toHaveProperty('userPassword');
    });

    test('should work with async processing', async () => {
      const response = await request(app)
        .post('/api/sanitize/json?sync=true')
        .send({
          content: JSON.stringify({
            user_name: 'john',
          }),
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
          },
          async: true,
        });

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.body.sanitizedContent);
      expect(parsed).toHaveProperty('userName');
    });

    test('should skip transformation for invalid JSON', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: 'invalid json',
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
          },
        });

      expect(response.status).toBe(200);
      // Should sanitize the string as is
      expect(typeof response.body.sanitizedContent).toBe('string');
    });

    test('should maintain backward compatibility when transform is false', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({
            user_name: 'john',
          }),
          transform: false,
        });

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.body.sanitizedContent);
      expect(parsed).toHaveProperty('user_name');
      expect(parsed).not.toHaveProperty('userName');
    });
  });
});
