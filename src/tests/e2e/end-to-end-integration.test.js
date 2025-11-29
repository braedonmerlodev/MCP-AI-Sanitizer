const request = require('supertest');
const sinon = require('sinon');
const fs = require('node:fs');
const path = require('node:path');

// Mock AITextTransformer to avoid ES module issues
jest.mock('../../components/AITextTransformer', () => {
  const mockTransform = jest.fn().mockResolvedValue({
    text: '{"structured": "content"}',
    metadata: { aiProcessed: true },
  });
  const MockAITextTransformer = jest.fn().mockImplementation(() => ({
    transform: mockTransform,
  }));
  return MockAITextTransformer;
});

const app = require('../../app');
const JobStatus = require('../../models/JobStatus');
const queueManager = require('../../utils/queueManager');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
const ProxySanitizer = require('../../components/proxy-sanitizer');

describe('End-to-End Integration Validation Tests', () => {
  let validTrustToken;
  let trustTokenGenerator;

  beforeAll(() => {
    trustTokenGenerator = new TrustTokenGenerator();
    validTrustToken = trustTokenGenerator.generateToken('test content', 'test content', ['test'], {
      expirationHours: 1,
    });
  });

  beforeEach(() => {
    // Stub queue operations to avoid real processing
    sinon.stub(queueManager, 'addJob');
    sinon.stub(JobStatus, 'load');
    // Stub sanitization components to avoid external calls
    sinon.stub(ProxySanitizer.prototype, 'sanitize').resolves({
      sanitizedData: 'sanitized content',
      trustToken: { id: 'token123' },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('PDF Upload and Processing Integration', () => {
    it('should complete full PDF upload and processing workflow', async () => {
      const taskId = '1234567890123';
      const pdfBuffer = fs.readFileSync(path.join(__dirname, '../../../test-valid.pdf'));

      // Mock queue submission
      queueManager.addJob.resolves(taskId);

      // Mock job status progression
      JobStatus.load.onCall(0).resolves({
        jobId: taskId,
        status: 'processing',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      JobStatus.load.onCall(1).resolves({
        jobId: taskId,
        status: 'completed',
        result: {
          sanitizedContent: 'processed PDF content',
          trustToken: { id: 'token123' },
          metadata: {
            pages: 1,
            aiProcessed: true,
          },
        },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:10.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // Step 1: Upload PDF with AI processing
      const uploadResponse = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('pdf', pdfBuffer, 'test-valid.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty(
        'message',
        'PDF uploaded and processed successfully',
      );
      expect(uploadResponse.body).toHaveProperty('sanitizedContent');
      expect(uploadResponse.body).toHaveProperty('trustToken');
      expect(uploadResponse.body).toHaveProperty('processingMetadata');
      expect(uploadResponse.body.processingMetadata.aiProcessed).toBe(true);
    });

    it('should handle PDF upload with async processing for large files', async () => {
      const taskId = '1234567890456';
      // Create a larger buffer to simulate large file
      const largePdfBuffer = Buffer.alloc(15 * 1024 * 1024, '%PDF-1.4 test content'); // 15MB

      // Mock queue submission
      queueManager.addJob.resolves(taskId);

      // Mock job status
      JobStatus.load.resolves({
        jobId: taskId,
        status: 'completed',
        result: {
          sanitizedContent: 'processed large PDF content',
          trustToken: { id: 'token456' },
        },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:10.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // Upload large PDF (should trigger async)
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', largePdfBuffer, 'large-test.pdf')
        .expect(202);

      expect(uploadResponse.body).toHaveProperty('taskId');
      expect(uploadResponse.body).toHaveProperty('status', 'processing');

      // Poll for completion
      const statusResponse = await request(app).get(`/api/jobs/${taskId}`).expect(200);

      expect(statusResponse.body.status).toBe('completed');
      expect(statusResponse.body.result).toBeDefined();
    });
  });

  describe('JSON Sanitization with AI Processing Integration', () => {
    it('should process JSON content with AI transformation', async () => {
      const content = 'raw json content for AI processing';

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content, ai_transform: true })
        .expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(true);
    });

    it('should handle trust token reuse for repeated requests', async () => {
      const content = 'test content'; // Match the token content

      // First request
      const firstResponse = await request(app)
        .post('/api/sanitize/json')
        .send({ content, trustToken: validTrustToken })
        .expect(200);

      expect(firstResponse.body).toHaveProperty('sanitizedContent', content);
      expect(firstResponse.body.metadata.reused).toBe(true);
    });
  });

  describe('Real-time Status Updates via Polling', () => {
    it('should provide status updates during async processing', async () => {
      const taskId = '1234567890789';

      // Mock job status progression
      JobStatus.load.onCall(0).resolves({
        jobId: taskId,
        status: 'processing',
        progress: 50,
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      JobStatus.load.onCall(1).resolves({
        jobId: taskId,
        status: 'completed',
        result: { sanitizedContent: 'final result' },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:10.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // First status check
      const status1 = await request(app).get(`/api/jobs/${taskId}`).expect(200);
      expect(status1.body.status).toBe('processing');
      expect(status1.body.taskId).toBe(taskId);

      // Second status check
      const status2 = await request(app).get(`/api/jobs/${taskId}`).expect(200);
      expect(status2.body.status).toBe('completed');
      expect(status2.body.result).toBeDefined();
    });
  });

  describe('Chat Agent Integration (AI Processing)', () => {
    it('should process chat-like messages through AI transformer', async () => {
      const message = 'Hello, can you help me analyze this document?';

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content: message, ai_transform: true, outputFormat: 'structure' })
        .expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid PDF files gracefully', async () => {
      const invalidBuffer = Buffer.from('not a pdf content');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', invalidBuffer, 'invalid.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle network-like errors in async processing', async () => {
      const taskId = '1234567890124';

      // Mock failed job
      JobStatus.load.resolves({
        jobId: taskId,
        status: 'failed',
        errorMessage: 'Processing failed due to network timeout',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      const statusResponse = await request(app).get(`/api/jobs/${taskId}`).expect(200);

      expect(statusResponse.body.status).toBe('failed');
      expect(statusResponse.body.message).toBe('Processing failed due to network timeout');
    });

    it('should return 404 for non-existent jobs', async () => {
      JobStatus.load.resolves(null);

      const response = await request(app).get('/api/jobs/9999999999999').expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('Performance Validation', () => {
    it('should complete sanitization within performance targets', async () => {
      const startTime = Date.now();
      const content = 'test content for performance validation';

      const response = await request(app).post('/api/sanitize/json').send({ content }).expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Less than 100ms target
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata.performance.totalTimeMs).toBeLessThan(100);
    });
  });

  describe('Security Verification', () => {
    it('should validate trust tokens correctly', async () => {
      const validationResponse = await request(app)
        .post('/api/trust-tokens/validate')
        .send(validTrustToken)
        .expect(200);

      expect(validationResponse.body.valid).toBe(true);
      expect(validationResponse.body.message).toBe('Trust token is valid');
    });

    it('should reject invalid trust tokens', async () => {
      const invalidToken = { ...validTrustToken, signature: 'invalid' };

      const response = await request(app)
        .post('/api/trust-tokens/validate')
        .send(invalidToken)
        .expect(400);

      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should sanitize input to prevent injection attacks', async () => {
      const maliciousContent = '<script>alert("xss")</script> malicious content';

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content: maliciousContent })
        .expect(200);

      expect(response.body.sanitizedContent).not.toContain('<script>');
      expect(response.body).toHaveProperty('trustToken');
    });
  });

  describe('Integration with Existing Functionality', () => {
    it('should maintain backward compatibility with existing sanitize endpoint', async () => {
      const content = 'legacy content';

      const response = await request(app).post('/api/sanitize').send({ data: content }).expect(200);

      expect(response.body).toHaveProperty('sanitizedData');
    });

    it('should work with PDF generation from sanitized content', async () => {
      const sanitizedContent = 'clean content for PDF generation';
      const trustToken = validTrustToken;

      const response = await request(app)
        .post('/api/documents/generate-pdf')
        .set('x-trust-token', JSON.stringify(trustToken))
        .send({ data: sanitizedContent, trustToken })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['x-trust-token-status']).toBe('embedded');
    });
  });
});
