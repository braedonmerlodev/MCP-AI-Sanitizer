const request = require('supertest');
const app = require('../../app');
const fs = require('fs');
const path = require('path');

// Mock environment for tests
const originalEnv = process.env;

describe('Trust Token Caching Integration Tests', () => {
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

  describe('Trust Token Caching and Reuse', () => {
    test('should generate consistent trust tokens for identical content', async () => {
      // First processing
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

      const token1 = process1Response.body.trustToken;

      // Second processing of identical content
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

      const token2 = process2Response.body.trustToken;

      // Validate token consistency
      expect(token1.contentHash).toBe(token2.contentHash);
      expect(token1.originalHash).toBe(token2.originalHash);
      expect(token1.sanitizationVersion).toBe(token2.sanitizationVersion);
      expect(token1.signature).toBe(token2.signature);
    });

    test('should cache and reuse trust tokens for repeated requests', async () => {
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // First request
      const startTime1 = Date.now();
      const process1Response = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);
      const endTime1 = Date.now();

      // Second request (should use cache)
      const startTime2 = Date.now();
      const process2Response = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);
      const endTime2 = Date.now();

      // Validate caching behavior
      expect(process1Response.body.sanitizedContent).toBe(process2Response.body.sanitizedContent);
      expect(process1Response.body.trustToken.contentHash).toBe(
        process2Response.body.trustToken.contentHash,
      );

      // Second request should be faster (cached)
      const processingTime1 = process1Response.body.metadata.processingTime;
      const processingTime2 = process2Response.body.metadata.processingTime;

      // Allow some variance but second should be significantly faster
      expect(processingTime2).toBeLessThanOrEqual(processingTime1);
    });

    test('should validate cached trust tokens correctly', async () => {
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

      const trustToken = processResponse.body.trustToken;

      // Validate token structure
      expect(trustToken).toHaveProperty('contentHash');
      expect(trustToken).toHaveProperty('originalHash');
      expect(trustToken).toHaveProperty('sanitizationVersion');
      expect(trustToken).toHaveProperty('rulesApplied');
      expect(trustToken).toHaveProperty('timestamp');
      expect(trustToken).toHaveProperty('expiresAt');
      expect(trustToken).toHaveProperty('signature');

      // Validate token hasn't expired
      const expiresAt = new Date(trustToken.expiresAt);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());

      // Validate signature format (basic check)
      expect(typeof trustToken.signature).toBe('string');
      expect(trustToken.signature.length).toBeGreaterThan(0);
    });

    test('should handle trust token expiration', async () => {
      // This test would require mocking the system time or using a very short expiration
      // For now, we'll validate that tokens have reasonable expiration times
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

      const trustToken = processResponse.body.trustToken;

      const timestamp = new Date(trustToken.timestamp);
      const expiresAt = new Date(trustToken.expiresAt);

      // Token should expire within a reasonable timeframe (24 hours)
      const expirationTime = expiresAt.getTime() - timestamp.getTime();
      expect(expirationTime).toBeGreaterThan(0);
      expect(expirationTime).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // 24 hours in milliseconds
    });

    test('should maintain cache integrity across different transformation types', async () => {
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // Process with structure transformation
      const structureResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Process with summarize transformation
      const summarizeResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'summarize',
        })
        .expect(200);

      // Both should have valid trust tokens
      expect(structureResponse.body.trustToken).toBeDefined();
      expect(summarizeResponse.body.trustToken).toBeDefined();

      // Content hashes should be different (different transformations)
      expect(structureResponse.body.trustToken.contentHash).not.toBe(
        summarizeResponse.body.trustToken.contentHash,
      );

      // Original hashes should be the same (same input)
      expect(structureResponse.body.trustToken.originalHash).toBe(
        summarizeResponse.body.trustToken.originalHash,
      );
    });

    test('should handle cache misses gracefully', async () => {
      // Test with non-existent cached content
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdf, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // Force a cache miss by using different content that hasn't been processed
      const modifiedPdf = Buffer.from(testPdf.toString() + ' modified');

      const modifiedUploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', modifiedPdf, 'modified-document.pdf')
        .expect(200);

      const modifiedTaskId = modifiedUploadResponse.body.taskId;

      const modifiedProcessResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: modifiedTaskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Should still process successfully
      expect(modifiedProcessResponse.body).toHaveProperty('sanitizedContent');
      expect(modifiedProcessResponse.body).toHaveProperty('trustToken');
      expect(modifiedProcessResponse.body.trustToken).toBeDefined();
    });
  });
});
