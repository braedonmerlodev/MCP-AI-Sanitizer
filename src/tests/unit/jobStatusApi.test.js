const request = require('supertest');
const sinon = require('sinon');
const JobStatus = require('../../models/JobStatus');

describe('Job Status API Routes', () => {
  let app;

  beforeEach(() => {
    // Stub JobStatus.load to avoid database operations
    sinon.stub(JobStatus, 'load');

    // Create app with routes
    const express = require('express');

    // Require the jobStatus routes (JobStatus.load is now stubbed)
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

  describe('GET /api/jobs/:taskId', () => {
    it('should return 400 for invalid taskId', async () => {
      const response = await request(app).get('/api/jobs/invalid').expect(400);

      expect(response.body.error).toContain('taskId');
    });

    it('should return 404 for non-existent job', async () => {
      JobStatus.load.resolves(null);

      const response = await request(app).get('/api/jobs/1234567890123').expect(404);

      expect(response.body.error).toBe('Job not found');
      expect(JobStatus.load.calledWith('1234567890123')).toBe(true);
    });

    it('should return job status for existing job', async () => {
      const mockJob = {
        jobId: '1234567890123',
        status: 'processing',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:00:00.000Z',
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).get('/api/jobs/1234567890123').expect(200);

      expect(response.body.taskId).toBe('1234567890123');
      expect(response.body.status).toBe('processing');
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should return result for completed job', async () => {
      const result = { sanitizedContent: 'test', trustToken: {} };
      const mockJob = {
        jobId: '1234567890124',
        status: 'completed',
        result,
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:05:00.000Z',
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).get('/api/jobs/1234567890124').expect(200);

      expect(response.body.taskId).toBe('1234567890124');
      expect(response.body.status).toBe('completed');
      expect(response.body.result).toEqual(result);
      expect(response.body.completedAt).toBeDefined();
    });

    it('should return error for failed job', async () => {
      const mockJob = {
        jobId: '1234567890125',
        status: 'failed',
        errorMessage: 'Processing failed',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:05:00.000Z',
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).get('/api/jobs/1234567890125').expect(200);

      expect(response.body.taskId).toBe('1234567890125');
      expect(response.body.status).toBe('failed');
      expect(response.body.error).toBe('Processing failed');
    });
  });
});
