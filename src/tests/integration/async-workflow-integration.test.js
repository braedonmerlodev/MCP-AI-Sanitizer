const request = require('supertest');
const sinon = require('sinon');
const app = require('../../app');
const JobStatus = require('../../models/JobStatus');
const JobResult = require('../../models/JobResult');
const queueManager = require('../../utils/queueManager');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

describe('Async Workflow Integration Tests', () => {
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
    sinon.stub(JobResult, 'load');
    // Stub JobResult save to avoid database operations
    sinon.stub(JobResult.prototype, 'save').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Async Sanitization Workflow', () => {
    it('should handle async sanitization with trust token validation', async () => {
      const content = 'content to sanitize <script>alert("test")</script>';
      const taskId = '1234567890123';

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
          sanitizedContent: 'content to sanitize',
          trustToken: { id: 'token123' },
          metadata: { reused: false },
        },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:10.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // For the result endpoint call
      JobStatus.load.onCall(2).resolves({
        jobId: taskId,
        status: 'completed',
        result: {
          sanitizedContent: 'content to sanitize',
          trustToken: { id: 'token123' },
          metadata: { reused: false },
        },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:10.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // For the result endpoint call
      JobStatus.load.onCall(2).resolves({
        jobId: taskId,
        status: 'completed',
        result: {
          sanitizedContent: 'content to sanitize',
          trustToken: { id: 'token123' },
          metadata: { reused: false },
        },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:10.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // Mock JobResult.load to return null so it falls back to jobStatus.result
      JobResult.load.resolves(null);

      // Step 1: Submit async sanitization job
      const sanitizeResponse = await request(app)
        .post('/api/sanitize/json')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .send({ content, async: true })
        .expect(202);

      expect(sanitizeResponse.body).toHaveProperty('taskId');
      expect(sanitizeResponse.body).toHaveProperty('status', 'processing');

      const returnedTaskId = sanitizeResponse.body.taskId;

      // Step 2: Poll for status (processing)
      const statusResponse1 = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse1.body.status).toBe('processing');
      expect(statusResponse1.body.taskId).toBe(returnedTaskId);

      // Step 3: Poll for status (completed)
      const statusResponse2 = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse2.body.status).toBe('completed');
      expect(statusResponse2.body.message).toBe('Completed successfully');

      // Step 4: Get the result
      const resultResponse = await request(app)
        .get(`/api/jobs/${returnedTaskId}/result`)
        .expect(200);

      expect(resultResponse.body.result).toBeDefined();
      expect(resultResponse.body.result.sanitizedContent).toBe('content to sanitize');
      expect(resultResponse.body.result.trustToken).toBeDefined();
      expect(resultResponse.body.completedAt).toBeDefined();
    });

    it('should handle trust token reuse in async workflows', async () => {
      const content = 'content with hash collision';
      const taskId = '1234567890456';

      // Mock queue submission
      queueManager.addJob.resolves(taskId);

      // Mock job status with reused result
      JobStatus.load.resolves({
        jobId: taskId,
        status: 'completed',
        result: {
          sanitizedContent: 'content with hash collision',
          trustToken: { id: 'reused-token' },
          metadata: { reused: true, originalJobId: 'original-job' },
        },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      JobResult.load.resolves(null);

      // Submit job with content that should trigger reuse
      const response = await request(app)
        .post('/api/sanitize/json')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .send({ content, async: true })
        .expect(202);

      const returnedTaskId = response.body.taskId;

      // Get result and verify reuse metadata
      const resultResponse = await request(app)
        .get(`/api/jobs/${returnedTaskId}/result`)
        .expect(200);

      expect(resultResponse.body.result.metadata.reused).toBe(true);
      expect(resultResponse.body.result.metadata.originalJobId).toBeDefined();
    });

    it('should handle async workflow errors gracefully', async () => {
      const content = 'invalid content';
      const taskId = '1234567890789';

      // Mock queue submission
      queueManager.addJob.resolves(taskId);

      // Mock failed job status
      JobStatus.load.resolves({
        jobId: taskId,
        status: 'failed',
        errorMessage: 'Content validation failed: invalid format',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      // Submit job
      const submitResponse = await request(app)
        .post('/api/sanitize/json')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .send({ content, async: true })
        .expect(202);

      const returnedTaskId = submitResponse.body.taskId;

      // Poll for failed status
      const statusResponse = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse.body.status).toBe('failed');
      expect(statusResponse.body.message).toBe('Content validation failed: invalid format');
    });

    it('should handle job expiration in async workflows', async () => {
      const taskId = '1234567890123';

      // Mock expired job status
      JobStatus.load.resolves({
        jobId: taskId,
        status: 'completed',
        createdAt: '2025-11-10T10:00:00.000Z', // Old date
        updatedAt: '2025-11-10T10:05:00.000Z',
        expiresAt: '2025-11-15T10:00:00.000Z', // Expired
        isExpired: () => true,
      });

      // Try to get result of expired job
      const response = await request(app).get(`/api/jobs/${taskId}/result`).expect(410);

      expect(response.body.error).toBe('Job has expired');
    });

    it('should handle concurrent async requests', async () => {
      const content1 = 'content 1';
      const content2 = 'content 2';
      const taskId1 = '1234567890123';
      const taskId2 = '1234567890456';

      // Mock queue submissions
      queueManager.addJob.onCall(0).resolves(taskId1);
      queueManager.addJob.onCall(1).resolves(taskId2);

      // Mock job statuses
      JobStatus.load.withArgs(taskId1).resolves({
        jobId: taskId1,
        status: 'completed',
        result: { sanitizedContent: 'content 1 processed', trustToken: {} },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      JobStatus.load.withArgs(taskId2).resolves({
        jobId: taskId2,
        status: 'completed',
        result: { sanitizedContent: 'content 2 processed', trustToken: {} },
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
        expiresAt: '2025-11-15T11:00:00.000Z',
        isExpired: () => false,
      });

      JobResult.load.resolves(null);

      // Submit both jobs concurrently
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/sanitize/json')
          .set('x-trust-token', JSON.stringify(validTrustToken))
          .send({ content: content1, async: true }),
        request(app)
          .post('/api/sanitize/json')
          .set('x-trust-token', JSON.stringify(validTrustToken))
          .send({ content: content2, async: true }),
      ]);

      expect(response1.status).toBe(202);
      expect(response2.status).toBe(202);

      // Get results concurrently
      const [result1, result2] = await Promise.all([
        request(app).get(`/api/jobs/${response1.body.taskId}/result`),
        request(app).get(`/api/jobs/${response2.body.taskId}/result`),
      ]);

      expect(result1.status).toBe(200);
      expect(result2.status).toBe(200);
      expect(result1.body.result.sanitizedContent).toBe('content 1 processed');
      expect(result2.body.result.sanitizedContent).toBe('content 2 processed');
    });
  });
});
