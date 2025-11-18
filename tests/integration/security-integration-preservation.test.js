// Integration tests to validate functionality preservation after security hardening
// Story 1.1.4: Manual Workarounds & Integration Testing

// Mock environment variables
process.env.TRUST_TOKEN_SECRET = 'test-secret-key-for-integration-tests';

// Mock external dependencies BEFORE requiring modules
jest.mock('pdfjs-dist', () => ({
  getDocument: jest.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getMetadata: jest.fn().mockResolvedValue({
        info: {
          Title: 'Test PDF',
          Author: 'Test Author',
        },
      }),
      getPage: jest.fn().mockImplementation(() => ({
        getTextContent: jest.fn().mockResolvedValue({
          items: [{ str: 'This is test PDF content for integration testing.' }],
        }),
      })),
    }),
  }),
  GlobalWorkerOptions: { workerSrc: '' },
}));

jest.mock('../../src/components/MarkdownConverter', () => {
  const MockMarkdownConverter = jest.fn();
  MockMarkdownConverter.mockImplementation(() => ({
    convert: jest
      .fn()
      .mockReturnValue('# Test PDF Content\n\nThis is test PDF content for integration testing.'),
  }));
  return MockMarkdownConverter;
});

jest.mock('../../src/middleware/AccessValidationMiddleware', () =>
  jest.fn((req, res, next) => next()),
);
jest.mock('../../src/components/AccessControlEnforcer', () => ({
  enforce: jest.fn().mockReturnValue({ allowed: true }),
}));

jest.mock('../../src/components/TrustTokenGenerator', () => {
  return jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockReturnValue({
      contentHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
      originalHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
      sanitizationVersion: '1.0',
      rulesApplied: ['symbol_stripping'],
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      signature: 'mock-signature',
    }),
    validateToken: jest.fn().mockReturnValue({ isValid: true }),
  }));
});

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/routes/api');
const jobStatusRoutes = require('../../src/routes/jobStatus');

describe('Security Integration Preservation Tests - Story 1.1.4', () => {
  let app;
  let trustTokenGenerator;

  beforeAll(() => {
    // Initialize trust token generator
    const TrustTokenGenerator = require('../../src/components/TrustTokenGenerator');
    trustTokenGenerator = new TrustTokenGenerator();
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    app.use('/api/job-status', jobStatusRoutes);
  });

  describe('Critical Workflow 1: Sanitization Endpoints (/api/sanitize/json)', () => {
    const testContent = {
      content: JSON.stringify({
        user: 'test@example.com',
        message: 'This is a test message with <script>alert("xss")</script> potential XSS',
        data: { sensitive: 'information' },
      }),
      classification: 'user_input',
    };

    test('should sanitize JSON content successfully', async () => {
      const response = await request(app).post('/api/sanitize/json').send(testContent).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('metadata');

      // Verify sanitization worked (script tags removed)
      const sanitized = JSON.parse(response.body.sanitizedContent);
      expect(sanitized.message).not.toContain('<script>');
      expect(sanitized.message).toContain('alert("xss")'); // Content preserved but sanitized
    });

    test('should handle trust token reuse correctly', async () => {
      // First request to get a trust token
      const firstResponse = await request(app)
        .post('/api/sanitize/json')
        .send(testContent)
        .expect(200);

      const trustToken = firstResponse.body.trustToken;

      // Second request with trust token should reuse
      const reuseResponse = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: testContent.content,
          trustToken: trustToken,
        })
        .expect(200);

      expect(reuseResponse.body.metadata.reused).toBe(true);
      expect(reuseResponse.body.sanitizedContent).toBe(firstResponse.body.sanitizedContent);
    });

    test('should maintain API contract consistency', async () => {
      const response = await request(app).post('/api/sanitize/json').send(testContent).expect(200);

      // Verify response structure matches contract
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.trustToken).toHaveProperty('contentHash');
      expect(response.body.trustToken).toHaveProperty('signature');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('timestamp');
    });

    test('should validate performance within baseline (< 50ms)', async () => {
      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app).post('/api/sanitize/json').send(testContent);
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(
        `Sanitization performance: Avg ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );

      // Validate against baseline from docs/performance-baselines.md
      expect(averageTime).toBeLessThan(50); // Baseline: < 50ms average
      expect(maxTime).toBeLessThan(100); // Allow some buffer
    });
  });

  describe('Critical Workflow 2: Document Processing (/api/documents/upload)', () => {
    const validPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
    );

    const validToken = {
      contentHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
      originalHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
      sanitizationVersion: '1.0',
      rulesApplied: ['symbol_stripping'],
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      signature: 'mock-signature',
    };

    test('should process PDF documents successfully', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('x-trust-token', JSON.stringify(validToken))
        .attach('pdf', validPdfBuffer, 'test.pdf')
        .field('ai_transform', 'true')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('processed successfully');
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('pages', 1);
    });

    test('should maintain data format consistency', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', validPdfBuffer, 'test.pdf')
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('fileName', 'test.pdf');
      expect(response.body).toHaveProperty('size');
      expect(response.body).toHaveProperty('status', 'processed');
      expect(typeof response.body.size).toBe('number');
    });

    test('should validate performance within baseline (< 200ms)', async () => {
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .post('/api/documents/upload')
          .set('x-trust-token', JSON.stringify(validToken))
          .attach('pdf', validPdfBuffer, `test${i}.pdf`);
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(
        `Document upload performance: Avg ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );

      // Validate against baseline from docs/performance-baselines.md
      expect(averageTime).toBeLessThan(200); // Baseline: < 200ms average
      expect(maxTime).toBeLessThan(300); // Allow some buffer
    });
  });

  describe('Critical Workflow 3: Job Management (/api/export/training-data)', () => {
    test('should export training data successfully', async () => {
      const response = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'json' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('recordCount');
      expect(response.body).toHaveProperty('format', 'json');
      expect(response.headers['x-export-format']).toBe('json');
      expect(response.headers['x-export-record-count']).toBeDefined();
    });

    test('should support multiple export formats', async () => {
      const formats = ['json', 'csv', 'parquet'];

      for (const format of formats) {
        const response = await request(app)
          .post('/api/export/training-data')
          .send({ format })
          .expect(200);

        expect(response.body.format).toBe(format);
        expect(response.headers['x-export-format']).toBe(format);
      }
    });

    test('should maintain API contract for data export', async () => {
      const response = await request(app)
        .post('/api/export/training-data')
        .send({
          format: 'json',
          maxRecords: 100,
        })
        .expect(200);

      expect(response.body).toHaveProperty('filePath');
      expect(response.body).toHaveProperty('fileSize');
      expect(typeof response.body.recordCount).toBe('number');
      expect(typeof response.body.fileSize).toBe('number');
    });

    test('should validate performance within baseline (< 100ms)', async () => {
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app).post('/api/export/training-data').send({ format: 'json' });
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(
        `Data export performance: Avg ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );

      // Validate against baseline from docs/performance-baselines.md
      expect(averageTime).toBeLessThan(100); // Baseline: < 100ms average
      expect(maxTime).toBeLessThan(150); // Allow some buffer
    });
  });

  describe('API Contract Validation', () => {
    test('should maintain consistent response schemas across endpoints', async () => {
      // Test sanitization endpoint
      const sanitizeResponse = await request(app)
        .post('/api/sanitize/json')
        .send({ content: '{"test": "data"}' })
        .expect(200);

      expect(sanitizeResponse.body).toHaveProperty('sanitizedContent');
      expect(sanitizeResponse.body).toHaveProperty('trustToken');
      expect(sanitizeResponse.body).toHaveProperty('metadata');

      // Test document upload
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('%PDF-1.4\n%EOF'), 'test.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('sanitizedContent');
      expect(uploadResponse.body).toHaveProperty('trustToken');
      expect(uploadResponse.body).toHaveProperty('metadata');

      // Test data export
      const exportResponse = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'json' })
        .expect(200);

      expect(exportResponse.body).toHaveProperty('success');
      expect(exportResponse.body).toHaveProperty('recordCount');
      expect(exportResponse.body).toHaveProperty('format');
    });

    test('should handle error responses consistently', async () => {
      // Test invalid JSON in sanitization
      const invalidJsonResponse = await request(app)
        .post('/api/sanitize/json')
        .send({ content: 'invalid json' })
        .expect(400);

      expect(invalidJsonResponse.body).toHaveProperty('error');

      // Test invalid format in export
      const invalidFormatResponse = await request(app)
        .post('/api/export/training-data')
        .send({ format: 'invalid' })
        .expect(400);

      expect(invalidFormatResponse.body).toHaveProperty('error');
    });
  });

  describe('Security Verification - No New Vulnerabilities', () => {
    test('should not introduce new security vulnerabilities in sanitization', async () => {
      const maliciousContent = {
        content: JSON.stringify({
          script: '<script>alert("xss")</script>',
          sql: "'; DROP TABLE users; --",
          path: '../../../etc/passwd',
        }),
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send(maliciousContent)
        .expect(200);

      const sanitized = JSON.parse(response.body.sanitizedContent);

      // Verify malicious content is sanitized
      expect(sanitized.script).not.toContain('<script>');
      expect(sanitized.sql).not.toContain('DROP TABLE');
      expect(sanitized.path).not.toContain('../');
    });

    test('should maintain secure file upload handling', async () => {
      // Test with non-PDF file (should be rejected)
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('not a pdf'), 'fake.pdf')
        .expect(400);

      expect(response.body.error).toContain('Invalid file type');
    });
  });
});
