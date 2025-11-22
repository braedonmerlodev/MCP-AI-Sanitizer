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
      expect(response.body.message).toBe('Processing: Sanitizing content...');
      expect(response.body.createdAt).toBe('2025-11-15T10:00:00.000Z');
      expect(response.body.updatedAt).toBe('2025-11-15T10:02:30.000Z');
      expect(response.body.expiresAt).toBe('2025-11-16T10:00:00.000Z');
      expect(response.body).not.toHaveProperty('currentStep');
      expect(response.body).not.toHaveProperty('totalSteps');
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
      expect(response.body.message).toBe('Completed successfully');
      expect(response.body.createdAt).toBe('2025-11-15T10:00:00.000Z');
      expect(response.body.updatedAt).toBe('2025-11-15T10:05:00.000Z');
      expect(response.body.expiresAt).toBe('2025-11-16T10:00:00.000Z');
    });

    it('should return processing status with fallback message when currentStep is null', async () => {
      const mockJob = {
        jobId: '1234567890123',
        status: 'processing',
        progress: 75,
        currentStep: null,
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:03:45.000Z',
        expiresAt: '2025-11-16T10:00:00.000Z',
        isExpired: () => false,
      };
      JobStatus.load.resolves(mockJob);

      const response = await request(app).get('/api/jobs/1234567890123/status').expect(200);

      expect(response.body.taskId).toBe('1234567890123');
      expect(response.body.status).toBe('processing');
      expect(response.body.progress).toBe(75);
      expect(response.body.message).toBe('Processing...');
      expect(response.body.createdAt).toBe('2025-11-15T10:00:00.000Z');
      expect(response.body.updatedAt).toBe('2025-11-15T10:03:45.000Z');
      expect(response.body.expiresAt).toBe('2025-11-16T10:00:00.000Z');
    });

    it('should include estimated completion time for processing jobs with progress', async () => {
      const mockJob = {
        jobId: '1234567890123',
        status: 'processing',
        progress: 50,
        currentStep: 'Validating input',
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
      expect(response.body.message).toBe('Processing: Validating input...');
      expect(response.body.estimatedCompletion).toBeDefined();
      expect(response.body.createdAt).toBe('2025-11-15T10:00:00.000Z');
      expect(response.body.updatedAt).toBe('2025-11-15T10:02:30.000Z');
      expect(response.body.expiresAt).toBe('2025-11-16T10:00:00.000Z');
    });

    it('should include result and completedAt for completed jobs with result', async () => {
      const jobResult = { sanitizedContent: 'processed content', metadata: { size: 1024 } };
      const mockJob = {
        jobId: '1234567890124',
        status: 'completed',
        progress: 100,
        result: jobResult,
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
      expect(response.body.message).toBe('Completed successfully');
      expect(response.body.result).toEqual(jobResult);
      expect(response.body.completedAt).toBe('2025-11-15T10:05:00.000Z');
      expect(response.body.createdAt).toBe('2025-11-15T10:00:00.000Z');
      expect(response.body.updatedAt).toBe('2025-11-15T10:05:00.000Z');
      expect(response.body.expiresAt).toBe('2025-11-16T10:00:00.000Z');
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
      expect(response.body.message).toBe('Job cancelled successfully');
      expect(mockJob.cancel.calledOnce).toBe(true);
    });

    it('should allow deleting completed jobs', async () => {
      const mockJob = {
        jobId: '1234567890124',
        status: 'completed',
        updatedAt: '2025-11-15T10:00:00.000Z',
        save: sinon.stub().resolves(),
        isExpired: () => false,
      };
      JobStatus.load.resolves(mockJob);
      JobResult.load.resolves(null); // No cached result

      const response = await request(app).delete('/api/jobs/1234567890124').expect(200);

      expect(response.body.taskId).toBe('1234567890124');
      expect(response.body.status).toBe('cancelled');
      expect(response.body.message).toBe('Job deleted successfully');
      expect(mockJob.save.calledOnce).toBe(true);
    });
  });

  describe('GET /api/jobs/:taskId (legacy)', () => {
    it('should return 404 for non-existent job', async () => {
      const response = await request(app).get('/api/jobs/1234567890123').expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('JobStatusController Error Handling Coverage', () => {
    describe('getStatus method', () => {
      it('should handle JobStatus.load errors', async () => {
        JobStatus.load.rejects(new Error('Database connection failed'));

        const response = await request(app).get('/api/jobs/1234567890123/status').expect(500);

        expect(response.body.error).toBe('Failed to retrieve job status');
      });

      it('should return queued status message', async () => {
        const mockJob = {
          jobId: '1234567890123',
          status: 'queued',
          progress: 0,
          isExpired: () => false,
        };
        JobStatus.load.resolves(mockJob);

        const response = await request(app).get('/api/jobs/1234567890123/status').expect(200);

        expect(response.body.message).toBe('Queued for processing...');
      });

      it('should return cancelled status message', async () => {
        const mockJob = {
          jobId: '1234567890123',
          status: 'cancelled',
          progress: 0,
          isExpired: () => false,
        };
        JobStatus.load.resolves(mockJob);

        const response = await request(app).get('/api/jobs/1234567890123/status').expect(200);

        expect(response.body.message).toBe('Job cancelled');
      });

      it('should return unknown status message for invalid status', async () => {
        const mockJob = {
          jobId: '1234567890123',
          status: 'invalid_status',
          progress: 0,
          isExpired: () => false,
        };
        JobStatus.load.resolves(mockJob);

        const response = await request(app).get('/api/jobs/1234567890123/status').expect(200);

        expect(response.body.message).toBe('Unknown status');
      });
    });

    describe('getResult method', () => {
      it('should handle JobStatus.load errors in getResult', async () => {
        JobStatus.load.rejects(new Error('Database error'));

        const response = await request(app).get('/api/jobs/1234567890123/result').expect(500);

        expect(response.body.error).toBe('Failed to retrieve job result');
      });

      it('should return 410 for expired job in getResult', async () => {
        const mockJob = {
          jobId: '1234567890123',
          status: 'completed',
          progress: 100,
          isExpired: () => true,
        };
        JobStatus.load.resolves(mockJob);

        const response = await request(app).get('/api/jobs/1234567890123/result').expect(410);

        expect(response.body.error).toBe('Job has expired');
      });

      it('should handle JobResult.load errors with fallback to job status result', async () => {
        const mockJob = {
          jobId: '1234567890123',
          status: 'completed',
          progress: 100,
          result: { data: 'test result' },
          isExpired: () => false,
        };
        JobStatus.load.resolves(mockJob);
        JobResult.load.rejects(new Error('Result load failed'));

        const response = await request(app).get('/api/jobs/1234567890123/result').expect(200);

        expect(response.body.result).toEqual({ data: 'test result' });
      });

      it('should handle JSON.stringify errors in result size calculation', async () => {
        const mockJob = {
          jobId: '1234567890123',
          status: 'completed',
          progress: 100,
          result: { circular: {} },
          isExpired: () => false,
        };
        // Create circular reference
        mockJob.result.circular.self = mockJob.result;

        JobStatus.load.resolves(mockJob);
        JobResult.load.resolves(null);

        const response = await request(app).get('/api/jobs/1234567890123/result').expect(200);

        expect(response.body.resultSize).toBe(0);
      });
    });

    describe('cancelJob method', () => {
      it('should handle JobStatus.load errors in cancelJob', async () => {
        JobStatus.load.rejects(new Error('Load failed'));

        const response = await request(app).delete('/api/jobs/1234567890123').expect(500);

        expect(response.body.error).toBe('Failed to cancel/delete job');
      });

      it('should return 410 for expired job in cancelJob', async () => {
        const mockJob = {
          jobId: '1234567890123',
          status: 'processing',
          isExpired: () => true,
        };
        JobStatus.load.resolves(mockJob);

        const response = await request(app).delete('/api/jobs/1234567890123').expect(410);

        expect(response.body.error).toBe('Job has expired');
      });

      it('should handle JobResult save errors gracefully', async () => {
        const mockJob = {
          jobId: '1234567890124',
          status: 'completed',
          save: sinon.stub().resolves(),
          cancel: sinon.stub().resolves(),
          isExpired: () => false,
        };
        const mockResult = {
          expiresAt: 'old-date',
          save: sinon.stub().rejects(new Error('Save failed')),
        };

        JobStatus.load.resolves(mockJob);
        JobResult.load.resolves(mockResult);

        const response = await request(app).delete('/api/jobs/1234567890124').expect(200);

        expect(response.body.status).toBe('cancelled');
        expect(response.body.message).toBe('Job deleted successfully');
      });
    });
  });
});
