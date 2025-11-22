const request = require('supertest');
const sinon = require('sinon');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../../app');
const JobStatus = require('../../models/JobStatus');
const queueManager = require('../../utils/queueManager');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
const ProxySanitizer = require('../../components/proxy-sanitizer');
const AITextTransformer = require('../../components/AITextTransformer');

describe('Async Workflow E2E Tests', () => {
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
    // Stub AI and sanitization components to avoid external calls
    sinon.stub(ProxySanitizer.prototype, 'sanitize').resolves({
      sanitizedData: 'sanitized content',
      trustToken: { id: 'token123' },
    });
    sinon.stub(AITextTransformer.prototype, 'transform').resolves({
      text: '{"structured": "content"}',
      metadata: { aiProcessed: true },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('PDF Upload Async Workflow', () => {
    it('should complete full async PDF upload workflow', async () => {
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
        },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:10.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // Step 1: Submit PDF upload job (force async)
      const uploadResponse = await request(app)
        .post('/api/documents/upload?async=true')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('pdf', pdfBuffer, 'test-valid.pdf')
        .expect(202);

      expect(uploadResponse.body).toHaveProperty('taskId');
      expect(uploadResponse.body).toHaveProperty('status', 'processing');

      const returnedTaskId = uploadResponse.body.taskId;

      // Step 2: Poll for status (processing)
      const statusResponse1 = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse1.body.status).toBe('processing');
      expect(statusResponse1.body.taskId).toBe(returnedTaskId);

      // Step 3: Poll for status (completed)
      const statusResponse2 = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse2.body.status).toBe('completed');
      expect(statusResponse2.body.result).toBeDefined();
      expect(statusResponse2.body.result.sanitizedContent).toBe('processed PDF content');
      expect(statusResponse2.body.completedAt).toBeDefined();
    });
  });

  describe('Sanitize JSON Async Workflow', () => {
    it('should complete full async sanitize/json workflow', async () => {
      const content = 'content to sanitize asynchronously';
      const taskId = '1234567890456';

      // Mock queue submission
      queueManager.addJob.resolves(taskId);

      // Mock job status progression
      JobStatus.load.onCall(0).resolves({
        jobId: taskId,
        status: 'processing',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:02.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      JobStatus.load.onCall(1).resolves({
        jobId: taskId,
        status: 'completed',
        result: {
          sanitizedContent: 'sanitized content',
          trustToken: { id: 'token456' },
        },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // Step 1: Submit async sanitization job
      const sanitizeResponse = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: true })
        .expect(202);

      expect(sanitizeResponse.body.taskId).toBeDefined();
      expect(sanitizeResponse.body.status).toBe('processing');

      const returnedTaskId = sanitizeResponse.body.taskId;

      // Step 2: Poll for status (processing)
      const statusResponse1 = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse1.body.status).toBe('processing');

      // Step 3: Poll for status (completed)
      const statusResponse2 = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse2.body.status).toBe('completed');
      expect(statusResponse2.body.message).toBe('Completed successfully');
    });
  });

  describe('Error Handling in Async Workflows', () => {
    it('should handle job failure gracefully', async () => {
      const taskId = '1234567890789';

      // Mock queue submission
      queueManager.addJob.resolves(taskId);

      // Mock failed job status
      JobStatus.load.resolves({
        jobId: taskId,
        status: 'failed',
        errorMessage: 'Processing failed due to invalid content',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
      });

      // Submit job
      const submitResponse = await request(app)
        .post('/api/sanitize/json')
        .send({ content: 'invalid content', async: true })
        .expect(202);

      const returnedTaskId = submitResponse.body.taskId;

      // Stub the load to return failed status
      JobStatus.load.resolves({
        jobId: returnedTaskId,
        status: 'failed',
        errorMessage: 'Processing failed due to invalid content',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // Poll for failed status
      const statusResponse = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse.body.status).toBe('failed');
      expect(statusResponse.body.message).toBe('Processing failed due to invalid content');
    });

    it('should return 404 for non-existent job', async () => {
      JobStatus.load.resolves(null);

      const response = await request(app).get('/api/jobs/9999999999999').expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });
});
