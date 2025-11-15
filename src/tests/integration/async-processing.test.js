const request = require('supertest');
const sinon = require('sinon');
const AsyncSanitizationController = require('../../controllers/AsyncSanitizationController');

describe('Async Processing Integration Tests', () => {
  let app;
  let mockQueueManager;
  let mockJobStatus;

  beforeEach(() => {
    // Mock dependencies
    mockQueueManager = {
      addJob: sinon.stub(),
    };

    mockJobStatus = {
      load: sinon.stub(),
    };

    // Create app with mocked routes
    const express = require('express');

    // Create controller with mock
    const controller = new AsyncSanitizationController(mockQueueManager);

    // Mock API routes
    const apiRoutes = express.Router();

    // Mock /api/sanitize/json endpoint
    apiRoutes.post('/sanitize/json', async (req, res) => {
      try {
        const { content, async: isAsync } = req.body;
        if (isAsync) {
          const taskId = await controller.submitSanitizationJob(content, req.body);
          return res.json({ taskId, status: 'processing' });
        } else {
          // Mock sync response
          return res.json({ sanitizedContent: content, trustToken: {} });
        }
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });

    // Mock /documents/upload endpoint
    apiRoutes.post('/documents/upload', async (req, res) => {
      try {
        // Simulate file upload
        const fileBuffer = Buffer.from('mock pdf content');
        const fileName = 'test.pdf';
        const taskId = await controller.submitPDFUploadJob(fileBuffer, fileName, {});
        return res.json({ taskId, status: 'processing' });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    });

    // Mock job status routes
    const jobStatusRoutes = express.Router();
    jobStatusRoutes.get('/:taskId', async (req, res) => {
      try {
        const job = await mockJobStatus.load(req.params.taskId);
        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }
        const response = {
          taskId: job.jobId,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        };
        if (job.status === 'completed' && job.result) {
          response.result = job.result;
          response.completedAt = job.updatedAt;
        } else if (job.status === 'failed') {
          response.error = job.errorMessage;
        }
        return res.json(response);
      } catch (error) {
        return res.status(500).json({ error: 'Failed to retrieve job status' });
      }
    });

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

  describe('POST /api/sanitize/json - Async Mode', () => {
    it('should submit async sanitization job and return task ID', async () => {
      const content = 'test content to sanitize';
      const expectedTaskId = 'sanitize_task_123';

      mockQueueManager.addJob.resolves(expectedTaskId);

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: true })
        .expect(200);

      expect(response.body.taskId).toBe(expectedTaskId);
      expect(response.body.status).toBe('processing');
      expect(mockQueueManager.addJob.calledOnce).toBe(true);
    });

    it('should handle queue submission errors', async () => {
      const content = 'test content';
      const error = new Error('Queue full');

      mockQueueManager.addJob.rejects(error);

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: true })
        .expect(500);

      expect(response.body.error).toBe('Queue full');
    });

    it('should process synchronously when async is false', async () => {
      const content = 'test content';

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: false })
        .expect(200);

      expect(response.body.sanitizedContent).toBe(content);
      expect(response.body.trustToken).toEqual({});
      expect(mockQueueManager.addJob.called).toBe(false);
    });
  });

  describe('POST /api/documents/upload - Async Processing', () => {
    it('should submit PDF upload job and return task ID', async () => {
      const expectedTaskId = 'upload_task_456';

      mockQueueManager.addJob.resolves(expectedTaskId);

      const response = await request(app)
        .post('/api/documents/upload')
        .send({}) // Mock file upload
        .expect(200);

      expect(response.body.taskId).toBe(expectedTaskId);
      expect(response.body.status).toBe('processing');
      expect(mockQueueManager.addJob.calledOnce).toBe(true);
    });

    it('should handle upload job submission errors', async () => {
      const error = new Error('Storage error');

      mockQueueManager.addJob.rejects(error);

      const response = await request(app).post('/api/documents/upload').send({}).expect(500);

      expect(response.body.error).toBe('Storage error');
    });
  });

  describe('GET /api/jobs/:taskId - Status Polling', () => {
    it('should return job status for processing job', async () => {
      const taskId = 'task_123';
      const mockJob = {
        jobId: taskId,
        status: 'processing',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:01:00.000Z',
      };

      mockJobStatus.load.resolves(mockJob);

      const response = await request(app).get(`/api/jobs/${taskId}`).expect(200);

      expect(response.body.taskId).toBe(taskId);
      expect(response.body.status).toBe('processing');
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should return result for completed job', async () => {
      const taskId = 'task_124';
      const result = { sanitizedContent: 'processed content', trustToken: {} };
      const mockJob = {
        jobId: taskId,
        status: 'completed',
        result,
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:05:00.000Z',
      };

      mockJobStatus.load.resolves(mockJob);

      const response = await request(app).get(`/api/jobs/${taskId}`).expect(200);

      expect(response.body.taskId).toBe(taskId);
      expect(response.body.status).toBe('completed');
      expect(response.body.result).toEqual(result);
      expect(response.body.completedAt).toBeDefined();
    });

    it('should return error for failed job', async () => {
      const taskId = 'task_125';
      const mockJob = {
        jobId: taskId,
        status: 'failed',
        errorMessage: 'Processing failed',
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2025-11-15T10:05:00.000Z',
      };

      mockJobStatus.load.resolves(mockJob);

      const response = await request(app).get(`/api/jobs/${taskId}`).expect(200);

      expect(response.body.taskId).toBe(taskId);
      expect(response.body.status).toBe('failed');
      expect(response.body.error).toBe('Processing failed');
    });

    it('should return 404 for non-existent job', async () => {
      const taskId = 'non_existent';

      mockJobStatus.load.resolves(null);

      const response = await request(app).get(`/api/jobs/${taskId}`).expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });
});
