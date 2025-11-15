process.env.TRUST_TOKEN_SECRET = 'test-secret-key-for-agent-sync-tests';

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

describe('Agent Sync Mode Integration Tests', () => {
  let app;
  let trustTokenGenerator;
  let validToken;

  beforeAll(() => {
    // Initialize trust token generator
    trustTokenGenerator = new TrustTokenGenerator();

    // Create test token
    const sanitizedContent = 'This is sanitized content';
    const originalContent = 'This is original content';
    const rulesApplied = ['symbol_stripping'];

    validToken = trustTokenGenerator.generateToken(sanitizedContent, originalContent, rulesApplied);
  });

  beforeEach(() => {
    // Create Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
  });

  describe('Agent Detection and Sync Enforcement', () => {
    test('should detect agent request via X-Agent-Key header', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .set('X-Agent-Key', 'agent-security-123')
        .set('User-Agent', 'SecurityAgent/1.0')
        .set('x-trust-token', JSON.stringify(validToken))
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
        .set('x-trust-token', JSON.stringify(validToken))
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
      const response = await request(app)
        .post('/api/sanitize/json?sync=true')
        .set('x-trust-token', JSON.stringify(validToken))
        .send({
          content: 'Test content with sync parameter',
          async: true, // Should be overridden by query param
        });

      expect(response.status).toBe(200);
      expect(response.body.sanitizedContent).toBeDefined();
      // Should not have async processing headers
      expect(response.headers['x-api-version']).toBeUndefined();
      expect(response.headers['x-async-processing']).toBeUndefined();
    });

    test('should process small PDF synchronously for agent requests', async () => {
      // Create a small valid PDF buffer
      const smallPdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
        'utf8',
      );

      const response = await request(app)
        .post('/api/documents/upload?sync=true')
        .set('X-Agent-Key', 'agent-bmad-789')
        .set('x-trust-token', JSON.stringify(validToken))
        .attach('pdf', smallPdfBuffer, 'small-test.pdf')
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
        const response = await request(app)
          .post('/api/sanitize/json')
          .set('X-Agent-Key', 'agent-performance-test')
          .set('x-trust-token', JSON.stringify(validToken))
          .send({
            content: `Performance test content ${i}`,
          });
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        times.push(durationMs);

        // Ensure response is successful
        expect(response.status).toBe(200);
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
});
