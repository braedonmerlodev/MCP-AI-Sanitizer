const request = require('supertest');
const sinon = require('sinon');
const JobStatus = require('../../models/JobStatus');
const JobResult = require('../../models/JobResult');

describe('Job Status API Routes', () => {
  let app;

  beforeEach(() => {
    // Stub models to avoid database operations
    sinon.stub(JobStatus, 'load');
    sinon.stub(JobResult, 'load');

    // Create app with routes
    const express = require('express');

    // Require the jobStatus routes
    const jobStatusRoutes = require('../../routes/jobStatus');

    // Mock api routes to avoid complex dependencies
    const apiRoutes = express.Router();
    apiRoutes.get('/test', (req, res) => res.json({ ok: true }));

    app = express();

    // Middleware
    app.use(express.json({ limit: '25mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Routes
    app.use('/api', apiRoutes);
    app.use('/api/jobs', jobStatusRoutes);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('GET /api/jobs/:taskId/status', () => {
    it('should return 400 for invalid taskId', async () => {
      const response = await request(app).get('/api/jobs/invalid/status').expect(400);

      expect(response.body.error).toContain('taskId');
    });

    it('should return 404 for non-existent job', async () => {
      JobStatus.load.resolves(null);

      const response = await request(app).get('/api/jobs/1234567890123/status').expect(404);

      expect(response.body.error).toBe('Job not found');
    });

    it('should return 410 for expired job', async () => {
      const expiredJob = {
        jobId: '1234567890123',
        status: 'completed',
        expiresAt: '2025-11-14T10:00:00.000Z', // Past date
        isExpired: () => true,
      };
      JobStatus.load.resolves(expiredJob);

      const response = await request(app).get('/api/jobs/1234567890123/status').expect(410);

      expect(response.body.error).toBe('Job has expired');
    });

    it('should return job status with progress for processing job', async () => {
      const mockJob = {
        jobId: '1234567890123',
        status: 'processing',
        progress: 50,
        currentStep: 'Sanitizing content',
        totalSteps: 4,
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:02:30.000Z',
        expiresAt: '2025-11-16T10:00:00.000Z',
        isExpired: () => false,
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).get('/api/jobs/1234567890123/status').expect(200);

      expect(response.body.taskId).toBe('1234567890123');
      expect(response.body.status).toBe('processing');
      expect(response.body.progress).toBe(50);
      expect(response.body.currentStep).toBe('Sanitizing content');
      expect(response.body.estimatedCompletion).toBeDefined();
    });

    it('should return job status for completed job', async () => {
      const mockJob = {
        jobId: '1234567890124',
        status: 'completed',
        progress: 100,
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:05:00.000Z',
        expiresAt: '2025-11-16T10:00:00.000Z',
        isExpired: () => false,
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).get('/api/jobs/1234567890124/status').expect(200);

      expect(response.body.taskId).toBe('1234567890124');
      expect(response.body.status).toBe('completed');
      expect(response.body.progress).toBe(100);
    });
  });

  describe('GET /api/jobs/:taskId/result', () => {
    it('should return 400 for invalid taskId', async () => {
      const response = await request(app).get('/api/jobs/invalid/result').expect(400);

      expect(response.body.error).toContain('taskId');
    });

    it('should return 409 for incomplete job', async () => {
      const mockJob = {
        jobId: '1234567890123',
        status: 'processing',
        progress: 50,
        isExpired: () => false,
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).get('/api/jobs/1234567890123/result').expect(409);

      expect(response.body.error).toBe('Job not completed');
    });

    it('should return cached result for completed job', async () => {
      const result = { sanitizedContent: 'test content', trustToken: {} };
      const mockJob = {
        jobId: '1234567890124',
        status: 'completed',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:05:00.000Z',
        isExpired: () => false,
      };
      const mockResult = {
        result: result,
        isExpired: () => false,
      };

      JobStatus.load.resolves(mockJob);
      JobResult.load.resolves(mockResult);

      const response = await request(app).get('/api/jobs/1234567890124/result').expect(200);

      expect(response.body.taskId).toBe('1234567890124');
      expect(response.body.status).toBe('completed');
      expect(response.body.result).toEqual(result);
      expect(response.body.processingTime).toBeDefined();
    });

    it('should return 404 when no result available', async () => {
      const mockJob = {
        jobId: '1234567890125',
        status: 'completed',
        result: null,
        isExpired: () => false,
      };
      JobStatus.load.resolves(mockJob);
      JobResult.load.resolves(null);

      const response = await request(app).get('/api/jobs/1234567890125/result').expect(404);

      expect(response.body.error).toBe('No result available');
    });
  });

  describe('DELETE /api/jobs/:taskId', () => {
    it('should return 400 for invalid taskId', async () => {
      const response = await request(app).delete('/api/jobs/invalid').expect(400);

      expect(response.body.error).toContain('taskId');
    });

    it('should cancel a queued job', async () => {
      const mockJob = {
        jobId: '1234567890123',
        status: 'queued',
        updatedAt: '2025-11-15T10:00:00.000Z',
        isExpired: () => false,
        cancel: sinon.stub().resolves(),
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).delete('/api/jobs/1234567890123').expect(200);

      expect(response.body.taskId).toBe('1234567890123');
      expect(response.body.status).toBe('cancelled');
      expect(mockJob.cancel.calledOnce).toBe(true);
    });

    it('should return 409 for non-cancellable job', async () => {
      const mockJob = {
        jobId: '1234567890124',
        status: 'completed',
        isExpired: () => false,
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).delete('/api/jobs/1234567890124').expect(409);

      expect(response.body.error).toBe('Job cannot be cancelled');
    });
  });

  describe('GET /api/jobs/:taskId (legacy)', () => {
    it('should redirect to status endpoint', async () => {
      const response = await request(app).get('/api/jobs/1234567890123').expect(301);

      expect(response.headers.location).toBe('/api/jobs/1234567890123/status');
    });
  });
});
