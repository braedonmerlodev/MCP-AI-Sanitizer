const request = require('supertest');
const sinon = require('sinon');
const app = require('../../app');
const JobStatus = require('../../models/JobStatus');
const queueManager = require('../../utils/queueManager');

describe('Async Workflow E2E Tests', () => {
  beforeEach(() => {
    // Stub queue operations to avoid real processing
    sinon.stub(queueManager, 'addJob');
    sinon.stub(JobStatus, 'load');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('PDF Upload Async Workflow', () => {
    it('should complete full async PDF upload workflow', async () => {
      const taskId = 'pdf_upload_123';

      // Mock queue submission
      queueManager.addJob.resolves(taskId);

      // Mock job status progression
      JobStatus.load.onCall(0).resolves({
        jobId: taskId,
        status: 'processing',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:05.000Z',
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
      });

      // Step 1: Submit PDF upload job
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .send({}) // In real E2E, this would be multipart/form-data
        .expect(200);

      expect(uploadResponse.body.taskId).toBeDefined();
      expect(uploadResponse.body.status).toBe('processing');

      const returnedTaskId = uploadResponse.body.taskId;

      // Step 2: Poll for status (processing)
      const statusResponse1 = await request(app)
        .get(`/api/jobs/${returnedTaskId}`)
        .expect(200);

      expect(statusResponse1.body.status).toBe('processing');
      expect(statusResponse1.body.taskId).toBe(returnedTaskId);

      // Step 3: Poll for status (completed)
      const statusResponse2 = await request(app)
        .get(`/api/jobs/${returnedTaskId}`)
        .expect(200);

      expect(statusResponse2.body.status).toBe('completed');
      expect(statusResponse2.body.result).toBeDefined();
      expect(statusResponse2.body.result.sanitizedContent).toBe('processed PDF content');
      expect(statusResponse2.body.completedAt).toBeDefined();
    });
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
      });

      // Step 1: Submit PDF upload job
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .send({}) // In real E2E, this would be multipart/form-data
        .expect(200);

      expect(uploadResponse.body.taskId).toBeDefined();
      expect(uploadResponse.body.status).toBe('processing');

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
      const taskId = 'sanitize_async_456';

      // Mock queue submission
      queueManager.addJob.resolves(taskId);

      // Mock job status progression
      JobStatus.load.onCall(0).resolves({
        jobId: taskId,
        status: 'processing',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:02.000Z',
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
      });

      // Step 1: Submit async sanitization job
      const sanitizeResponse = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: true })
        .expect(200);

      expect(sanitizeResponse.body.taskId).toBeDefined();
      expect(sanitizeResponse.body.status).toBe('processing');

      const returnedTaskId = sanitizeResponse.body.taskId;

      // Step 2: Poll for status (processing)
      const statusResponse1 = await request(app)
        .get(`/api/jobs/${returnedTaskId}`)
        .expect(200);

      expect(statusResponse1.body.status).toBe('processing');

      // Step 3: Poll for status (completed)
      const statusResponse2 = await request(app)
        .get(`/api/jobs/${returnedTaskId}`)
        .expect(200);

      expect(statusResponse2.body.status).toBe('completed');
      expect(statusResponse2.body.result).toBeDefined();
      expect(statusResponse2.body.result.sanitizedContent).toBe('sanitized content');
    });
  });

  describe('Error Handling in Async Workflows', () => {
    it('should handle job failure gracefully', async () => {
      const taskId = 'failed_job_789';

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
        .expect(200);

      const returnedTaskId = submitResponse.body.taskId;

      // Poll for failed status
      const statusResponse = await request(app)
        .get(`/api/jobs/${returnedTaskId}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('failed');
      expect(statusResponse.body.error).toBe('Processing failed due to invalid content');
    });

    it('should return 404 for non-existent job', async () => {
      JobStatus.load.resolves(null);

      const response = await request(app)
        .get('/api/jobs/non_existent_job')
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });
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
      });

      // Step 1: Submit async sanitization job
      const sanitizeResponse = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: true })
        .expect(200);

      expect(sanitizeResponse.body.taskId).toBeDefined();
      expect(sanitizeResponse.body.status).toBe('processing');

      const returnedTaskId = sanitizeResponse.body.taskId;

      // Step 2: Poll for status (processing)
      const statusResponse1 = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse1.body.status).toBe('processing');

      // Step 3: Poll for status (completed)
      const statusResponse2 = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse2.body.status).toBe('completed');
      expect(statusResponse2.body.result).toBeDefined();
      expect(statusResponse2.body.result.sanitizedContent).toBe('sanitized content');
    });
  });

  describe('Error Handling in Async Workflows', () => {
    it('should handle job failure gracefully', async () => {
      const taskId = 'failed_job_789';

      // Mock queue submission
      mockQueueManager.addJob = sinon.stub().resolves(taskId);

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
        .expect(200);

      const returnedTaskId = submitResponse.body.taskId;

      // Poll for failed status
      const statusResponse = await request(app).get(`/api/jobs/${returnedTaskId}`).expect(200);

      expect(statusResponse.body.status).toBe('failed');
      expect(statusResponse.body.error).toBe('Processing failed due to invalid content');
    });

    it('should return 404 for non-existent job', async () => {
      JobStatus.load.resolves(null);

      const response = await request(app).get('/api/jobs/non_existent_job').expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });
});
