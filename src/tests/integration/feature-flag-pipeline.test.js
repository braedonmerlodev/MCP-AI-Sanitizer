const request = require('supertest');
const app = require('../../app');
const fs = require('fs');
const path = require('path');

// Mock environment for tests
const originalEnv = process.env;

describe('Feature Flag Pipeline Tests', () => {
  let testPdf;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';

    // Load test fixture
    testPdf = fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/simple-document.pdf'));
  });

  afterEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    // Clear any cached modules that depend on env
    delete require.cache[require.resolve('../../config/index')];
    delete require.cache[require.resolve('../../routes/api')];
    delete require.cache[require.resolve('../../components/sanitization-pipeline')];
  });

  describe('Trust Token Feature Flag Interactions', () => {
    test('should generate trust tokens when feature is enabled (default)', async () => {
      // Ensure trust tokens are enabled (default)
      delete process.env.TRUST_TOKENS_ENABLED;

      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
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

      // Validate trust token is generated
      expect(processResponse.body).toHaveProperty('trustToken');
      expect(processResponse.body.trustToken).not.toBeNull();
      expect(processResponse.body.trustToken).toHaveProperty('contentHash');
      expect(processResponse.body.trustToken).toHaveProperty('originalHash');
      expect(processResponse.body.trustToken).toHaveProperty('sanitizationVersion');
      expect(processResponse.body.trustToken).toHaveProperty('rulesApplied');
      expect(processResponse.body.trustToken).toHaveProperty('timestamp');
      expect(processResponse.body.trustToken).toHaveProperty('expiresAt');
      expect(processResponse.body.trustToken).toHaveProperty('signature');
    });

    test('should not generate trust tokens when feature is disabled', async () => {
      // Disable trust tokens
      process.env.TRUST_TOKENS_ENABLED = 'false';

      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
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

      // Validate trust token is not generated
      expect(processResponse.body).toHaveProperty('trustToken');
      expect(processResponse.body.trustToken).toBeNull();
    });

    test('should handle feature flag changes during pipeline execution', async () => {
      // Start with tokens enabled
      delete process.env.TRUST_TOKENS_ENABLED;

      const uploadResponse1 = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
        .expect(200);

      const taskId1 = uploadResponse1.body.taskId;

      const processResponse1 = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId1,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      expect(processResponse1.body.trustToken).not.toBeNull();

      // Change feature flag to disabled
      process.env.TRUST_TOKENS_ENABLED = 'false';

      // Clear module cache to pick up environment change
      delete require.cache[require.resolve('../../config/index')];

      const uploadResponse2 = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
        .expect(200);

      const taskId2 = uploadResponse2.body.taskId;

      const processResponse2 = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId2,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      expect(processResponse2.body.trustToken).toBeNull();
    });

    test('should maintain consistent behavior with trust tokens disabled', async () => {
      process.env.TRUST_TOKENS_ENABLED = 'false';

      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
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

      // Should still return sanitized content and metadata
      expect(processResponse.body).toHaveProperty('sanitizedContent');
      expect(processResponse.body).toHaveProperty('metadata');
      expect(processResponse.body.trustToken).toBeNull();

      // Metadata should still contain processing information
      expect(processResponse.body.metadata).toHaveProperty('processingTime');
      expect(processResponse.body.metadata).toHaveProperty('originalLength');
      expect(processResponse.body.metadata).toHaveProperty('sanitizedLength');
    });

    test('should handle feature flag edge cases', async () => {
      // Test various falsy values
      const falsyValues = ['false', '0', 'no', 'off', 'FALSE', 'False'];

      for (const falsyValue of falsyValues) {
        process.env.TRUST_TOKENS_ENABLED = falsyValue;

        // Clear cache to pick up change
        delete require.cache[require.resolve('../../config/index')];

        const uploadResponse = await request(app)
          .post('/api/pdf/upload')
          .attach('pdf', testPdf, 'simple-document.pdf')
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

        expect(processResponse.body.trustToken).toBeNull();
      }
    });

    test('should handle feature flag truthy values', async () => {
      // Test various truthy values
      const truthyValues = ['true', '1', 'yes', 'on', 'TRUE', 'True', 'any_value'];

      for (const truthyValue of truthyValues) {
        process.env.TRUST_TOKENS_ENABLED = truthyValue;

        // Clear cache to pick up change
        delete require.cache[require.resolve('../../config/index')];

        const uploadResponse = await request(app)
          .post('/api/pdf/upload')
          .attach('pdf', testPdf, 'simple-document.pdf')
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

        expect(processResponse.body.trustToken).not.toBeNull();
        expect(processResponse.body.trustToken).toHaveProperty('contentHash');
      }
    });

    test('should maintain pipeline performance with trust tokens disabled', async () => {
      process.env.TRUST_TOKENS_ENABLED = 'false';

      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;
      const startTime = Date.now();

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should still complete within reasonable time
      expect(processingTime).toBeLessThan(2000); // 2 seconds max
      expect(processResponse.body.metadata.processingTime).toBeLessThan(1000); // 1 second processing time
    });

    test('should handle concurrent requests with different feature flag settings', async () => {
      // This test would require running requests in parallel with different env settings
      // For now, we'll test sequential requests with flag changes

      // Request 1: tokens enabled
      delete process.env.TRUST_TOKENS_ENABLED;

      const upload1Response = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
        .expect(200);

      const taskId1 = upload1Response.body.taskId;

      const process1Response = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId1,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      expect(process1Response.body.trustToken).not.toBeNull();

      // Request 2: tokens disabled
      process.env.TRUST_TOKENS_ENABLED = 'false';
      delete require.cache[require.resolve('../../config/index')];

      const upload2Response = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
        .expect(200);

      const taskId2 = upload2Response.body.taskId;

      const process2Response = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId2,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      expect(process2Response.body.trustToken).toBeNull();
    });
  });
});
