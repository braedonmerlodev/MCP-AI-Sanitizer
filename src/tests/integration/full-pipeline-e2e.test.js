const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Mock AITextTransformer before requiring app
jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: jest.fn().mockResolvedValue({
      title: 'Mocked Title',
      summary: 'Mocked summary for testing',
      content: 'Mocked content',
      key_points: ['Point 1', 'Point 2'],
    }),
    validateTransformation: jest.fn().mockReturnValue(true),
  }));
});

const app = require('../../app');

// Mock environment for tests
const originalEnv = process.env;

describe('Full Pipeline E2E Test Suite', () => {
  let testPdfs;
  let expectedOutputs;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';

    // Load test fixtures
    testPdfs = {
      simple: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/simple-document.pdf')),
      complex: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/complex-document.pdf')),
      xss: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/xss-test-document.pdf')),
    };

    expectedOutputs = {
      simple: JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../fixtures/expected-outputs/simple-document-expected.json'),
          'utf8',
        ),
      ),
      complex: JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../fixtures/expected-outputs/complex-document-expected.json'),
          'utf8',
        ),
      ),
      xss: JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../fixtures/expected-outputs/xss-test-document-expected.json'),
          'utf8',
        ),
      ),
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    // Clear any cached modules that depend on env
    delete require.cache[require.resolve('../../config/index')];
    delete require.cache[require.resolve('../../routes/api')];
    delete require.cache[require.resolve('../../components/sanitization-pipeline')];
  });

  describe('Complete PDF-to-AI Pipeline', () => {
    test('should process simple PDF through complete pipeline', async () => {
      // Upload PDF
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('taskId');
      const taskId = uploadResponse.body.taskId;

      // Wait for processing to complete (in real implementation, this would poll)
      // For now, we'll test the synchronous endpoint
      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Validate response structure matches expected output
      expect(processResponse.body).toHaveProperty('sanitizedContent');
      expect(processResponse.body).toHaveProperty('trustToken');
      expect(processResponse.body).toHaveProperty('metadata');

      // Validate trust token structure
      expect(processResponse.body.trustToken).toHaveProperty('contentHash');
      expect(processResponse.body.trustToken).toHaveProperty('originalHash');
      expect(processResponse.body.trustToken).toHaveProperty('sanitizationVersion');
      expect(processResponse.body.trustToken).toHaveProperty('rulesApplied');
      expect(Array.isArray(processResponse.body.trustToken.rulesApplied)).toBe(true);
      expect(processResponse.body.trustToken).toHaveProperty('timestamp');
      expect(processResponse.body.trustToken).toHaveProperty('expiresAt');
      expect(processResponse.body.trustToken).toHaveProperty('signature');

      // Validate metadata
      expect(processResponse.body.metadata).toHaveProperty('processingTime');
      expect(processResponse.body.metadata).toHaveProperty('originalLength');
      expect(processResponse.body.metadata).toHaveProperty('sanitizedLength');
      expect(typeof processResponse.body.metadata.processingTime).toBe('number');
      expect(processResponse.body.metadata.processingTime).toBeGreaterThan(0);
    });

    test('should process complex multi-page PDF through complete pipeline', async () => {
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.complex, 'complex-document.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('taskId');
      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Validate complex document processing
      expect(processResponse.body).toHaveProperty('sanitizedContent');
      expect(processResponse.body.sanitizedContent).toContain('Technical specifications');
      expect(processResponse.body.sanitizedContent).toContain('AI processing capabilities');

      // Validate trust token for complex content
      expect(processResponse.body.trustToken).toBeDefined();
      expect(processResponse.body.trustToken.rulesApplied).toContain('basic-sanitization');

      // Check that processing time is reasonable for complex document
      expect(processResponse.body.metadata.processingTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle security threats in PDF content', async () => {
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.xss, 'xss-test-document.pdf')
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
      expect(processResponse.body.sanitizedContent).not.toContain('javascript:');
      expect(processResponse.body.sanitizedContent).toContain('[XSS content removed]');
      expect(processResponse.body.sanitizedContent).toContain('[SQL injection removed]');

      // Validate trust token reflects security processing
      expect(processResponse.body.trustToken.rulesApplied).toContain('xss-sanitization');
      expect(processResponse.body.trustToken.rulesApplied).toContain('sql-injection-prevention');

      // Check security metadata
      expect(processResponse.body.metadata).toHaveProperty('securityEvents');
      expect(processResponse.body.metadata.securityEvents.xss_detected).toBeGreaterThan(0);
      expect(processResponse.body.metadata.securityEvents.sql_injection_detected).toBeGreaterThan(
        0,
      );
    });

    test('should handle different AI transformation types', async () => {
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      // Test summarize transformation
      const summarizeResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'summarize',
        })
        .expect(200);

      expect(summarizeResponse.body.sanitizedContent).toBeDefined();
      expect(typeof summarizeResponse.body.sanitizedContent).toBe('string');
      expect(summarizeResponse.body.sanitizedContent.length).toBeLessThan(500); // Summary should be concise

      // Test extract_entities transformation
      const entitiesResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'extract_entities',
        })
        .expect(200);

      expect(entitiesResponse.body.sanitizedContent).toBeDefined();
      expect(entitiesResponse.body.trustToken).toBeDefined();
    });

    test('should maintain data integrity through pipeline', async () => {
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
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

      // Validate content hash integrity
      expect(processResponse.body.trustToken.contentHash).toBeDefined();
      expect(processResponse.body.trustToken.originalHash).toBeDefined();
      expect(processResponse.body.trustToken.contentHash).not.toBe(
        processResponse.body.trustToken.originalHash,
      );

      // Validate signature integrity
      expect(processResponse.body.trustToken.signature).toBeDefined();
      expect(typeof processResponse.body.trustToken.signature).toBe('string');

      // Validate timestamp integrity
      const timestamp = new Date(processResponse.body.trustToken.timestamp);
      const expiresAt = new Date(processResponse.body.trustToken.expiresAt);
      expect(timestamp.getTime()).toBeLessThan(expiresAt.getTime());
      expect(expiresAt.getTime() - timestamp.getTime()).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    test('should handle pipeline failures gracefully', async () => {
      // Test with invalid task ID
      const invalidResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: 'invalid-task-id',
          transform: true,
          transformType: 'structure',
        })
        .expect(404);

      expect(invalidResponse.body).toHaveProperty('error');
      expect(invalidResponse.body.error).toContain('not found');
    });
  });

  describe('Pipeline Performance Validation', () => {
    test('should meet performance SLAs', async () => {
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
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
      const clientSideTime = endTime - startTime;

      // Validate server-reported processing time
      expect(processResponse.body.metadata.processingTime).toBeLessThan(200); // < 200ms SLA

      // Validate client-side total time (includes network)
      expect(clientSideTime).toBeLessThan(1000); // < 1 second total
    });
  });
});
