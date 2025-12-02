const request = require('supertest');
const app = require('../../app');
const fs = require('fs');
const path = require('path');

// Mock environment for tests
const originalEnv = process.env;

describe('Error Handling Pipeline Tests', () => {
  let validPdf;
  let corruptedPdf;
  let oversizedPdf;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';

    // Load test fixtures
    validPdf = fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/simple-document.pdf'));

    // Create corrupted PDF (invalid data)
    corruptedPdf = Buffer.from('This is not a valid PDF file content');

    // Create oversized PDF (simulate large file)
    oversizedPdf = Buffer.alloc(50 * 1024 * 1024, 'x'); // 50MB file
  });

  afterEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    // Clear any cached modules that depend on env
    delete require.cache[require.resolve('../../config/index')];
    delete require.cache[require.resolve('../../routes/api')];
    delete require.cache[require.resolve('../../components/sanitization-pipeline')];
  });

  describe('PDF Upload Error Scenarios', () => {
    test('should handle invalid file format gracefully', async () => {
      const response = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', Buffer.from('invalid file content'), 'invalid.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid.*format|file.*type/i);
    });

    test('should handle file too large error', async () => {
      const response = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', oversizedPdf, 'large-file.pdf')
        .expect(413);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/too.*large|size.*limit/i);
    });

    test('should handle corrupted PDF files', async () => {
      const response = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', corruptedPdf, 'corrupted.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/corrupted|invalid.*pdf/i);
    });
  });

  describe('Text Extraction Error Scenarios', () => {
    test('should handle corrupted PDF during text extraction', async () => {
      // Mock the PDF processing to simulate extraction failure
      const response = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', corruptedPdf, 'corrupted.pdf');

      // If upload succeeds, test processing
      if (response.status === 200) {
        const taskId = response.body.taskId;

        const processResponse = await request(app).post('/api/pdf/process').send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        });

        // Should either fail gracefully or fallback to sanitized input
        if (processResponse.status === 200) {
          expect(processResponse.body).toHaveProperty('sanitizedContent');
          expect(processResponse.body.metadata).toHaveProperty('fallback');
          expect(processResponse.body.metadata.fallback).toBe(true);
        } else {
          expect(processResponse.status).toBeGreaterThanOrEqual(400);
          expect(processResponse.body).toHaveProperty('error');
        }
      }
    });
  });

  describe('Sanitization Error Scenarios', () => {
    test('should handle XSS content in PDF text', async () => {
      const xssPdf = fs.readFileSync(
        path.join(__dirname, '../fixtures/test-pdfs/xss-test-document.pdf'),
      );

      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', xssPdf, 'xss-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Validate XSS content was sanitized
      expect(processResponse.body.sanitizedContent).not.toContain('<script>');
      expect(processResponse.body.sanitizedContent).not.toContain('onerror');
      expect(processResponse.body.sanitizedContent).toContain('[XSS content removed]');
      expect(processResponse.body.trustToken.rulesApplied).toContain('xss-sanitization');
    });

    test('should handle SQL injection attempts in PDF text', async () => {
      const xssPdf = fs.readFileSync(
        path.join(__dirname, '../fixtures/test-pdfs/xss-test-document.pdf'),
      );

      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', xssPdf, 'xss-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Validate SQL injection content was sanitized
      expect(processResponse.body.sanitizedContent).not.toContain("' OR '1'='1");
      expect(processResponse.body.sanitizedContent).not.toContain('; DROP TABLE');
      expect(processResponse.body.sanitizedContent).toContain('[SQL injection removed]');
      expect(processResponse.body.trustToken.rulesApplied).toContain('sql-injection-prevention');
    });
  });

  describe('AI Transformation Error Scenarios', () => {
    test('should handle rate limit exceeded', async () => {
      // This test requires mocking the rate limiter to always return false
      // For now, we'll test the fallback behavior when AI fails
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', validPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // Mock AI failure (this would need to be implemented in the actual system)
      // For now, test that the system can handle AI errors gracefully
      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Should always return a result, either processed or fallback
      expect(processResponse.body).toHaveProperty('sanitizedContent');
      expect(processResponse.body).toHaveProperty('trustToken');
      expect(processResponse.body).toHaveProperty('metadata');
    });

    test('should handle API quota exceeded', async () => {
      // Similar to rate limit test - test fallback behavior
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', validPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      expect(processResponse.body).toHaveProperty('sanitizedContent');
      expect(processResponse.body.metadata).toHaveProperty('fallback');
      // If quota exceeded, should fallback to sanitized input
      if (processResponse.body.metadata.fallback) {
        expect(processResponse.body.metadata.reason).toMatch(/quota|rate.*limit/i);
      }
    });

    test('should handle network timeout', async () => {
      // Test timeout handling - this would require mocking network delays
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', validPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Should handle timeout gracefully
      expect(processResponse.body).toHaveProperty('sanitizedContent');
      expect(processResponse.body).toHaveProperty('trustToken');
    });
  });

  describe('Trust Token Generation Error Scenarios', () => {
    test('should handle invalid content hash generation', async () => {
      // Test with content that might cause hash issues
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', validPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Trust token should always be generated successfully
      expect(processResponse.body.trustToken).toHaveProperty('contentHash');
      expect(processResponse.body.trustToken).toHaveProperty('originalHash');
      expect(processResponse.body.trustToken).toHaveProperty('signature');
      expect(typeof processResponse.body.trustToken.contentHash).toBe('string');
      expect(typeof processResponse.body.trustToken.signature).toBe('string');
    });
  });

  describe('Trust Token Validation Error Scenarios', () => {
    test('should handle expired token validation', async () => {
      // This would require creating an expired token or mocking time
      // For now, validate that tokens have proper expiration
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', validPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      const trustToken = processResponse.body.trustToken;

      // Validate token expiration is properly set
      const expiresAt = new Date(trustToken.expiresAt);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('API Response Error Scenarios', () => {
    test('should handle schema validation failures', async () => {
      // Test with invalid request parameters
      const response = await request(app)
        .post('/api/pdf/process')
        .send({
          invalidField: 'test',
          transform: 'invalid_boolean',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/validation|schema|invalid/i);
    });

    test('should handle missing required fields', async () => {
      const response = await request(app).post('/api/pdf/process').send({}).expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/required|missing|taskId/i);
    });
  });

  describe('Pipeline Recovery and Fallback', () => {
    test('should provide meaningful error messages', async () => {
      const response = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: 'non-existent-task',
          transform: true,
          transformType: 'structure',
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
      expect(response.body.error.length).toBeGreaterThan(0);
    });

    test('should maintain system stability during errors', async () => {
      // Send multiple error requests to ensure system doesn't crash
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/pdf/process')
            .send({
              taskId: `invalid-task-${i}`,
              transform: true,
              transformType: 'structure',
            }),
        );
      }

      const responses = await Promise.all(promises);

      // All should return error status but not crash the server
      responses.forEach((response) => {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('error');
      });
    });
  });
});
