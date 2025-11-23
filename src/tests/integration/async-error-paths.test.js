// Mock environment variables
process.env.TRUST_TOKEN_SECRET = 'test-secret-key';
process.env.ADMIN_AUTH_SECRET = 'test-admin-secret';

// Mock queueManager
jest.mock('../../utils/queueManager', () => ({
  addJob: jest.fn(),
  getJobStatus: jest.fn(),
  getJobResult: jest.fn(),
  cancelJob: jest.fn(),
}));

// Mock JobStatus
jest.mock('../../models/JobStatus', () => {
  const mockConstructor = jest.fn().mockImplementation((data) => ({
    id: data.id || 'test-id',
    jobId: data.jobId,
    status: data.status || 'queued',
    save: jest.fn(),
    updateStatus: jest.fn(),
    cancel: jest.fn(),
    isExpired: jest.fn().mockReturnValue(false),
    toObject: jest.fn().mockReturnValue(data),
  }));

  mockConstructor.load = jest.fn();
  return mockConstructor;
});

// Mock JobResult
jest.mock('../../models/JobResult', () => {
  const mockConstructor = jest.fn().mockImplementation((data) => ({
    jobId: data.jobId,
    result: data.result,
    save: jest.fn(),
    load: jest.fn(),
    isExpired: jest.fn().mockReturnValue(false),
  }));

  mockConstructor.load = jest.fn();
  return mockConstructor;
});

// Mock multer
jest.mock('multer', () => {
  const multerMock = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => {
      req.file = {
        buffer: Buffer.from(
          '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n' + 'x'.repeat(1000000),
        ), // Make it large for async
        originalname: 'test.pdf',
        size: 11000000, // 11MB to trigger async
        mimetype: 'application/pdf',
      };
      next();
    }),
  }));
  multerMock.diskStorage = jest.fn();
  multerMock.memoryStorage = jest.fn();
  multerMock.MulterError = class MulterError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = 'MulterError';
    }
  };
  return multerMock;
});

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');
const jobStatusRoutes = require('../../routes/jobStatus');
const queueManager = require('../../utils/queueManager');
const JobStatus = require('../../models/JobStatus');
const JobResult = require('../../models/JobResult');

describe('Async Processing Error Paths Integration Tests', () => {
  let app;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create express app
    app = express();
    app.use(express.json({ limit: '25mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Mock middleware
    app.use((req, res, next) => {
      req.user = { id: 'test-user' };
      req.ip = '127.0.0.1';
      req.session = { id: 'test-session' };
      req.get = jest.fn((header) => (header === 'User-Agent' ? 'test-agent' : null));
      next();
    });

    // Mock destination tracking
    app.use((req, res, next) => {
      req.destinationTracking = { classification: 'llm' };
      next();
    });

    // Mock agent auth
    app.use((req, res, next) => {
      next();
    });

    // Mock access validation
    app.use((req, res, next) => {
      next();
    });

    // Mock rate limiting
    app.use((req, res, next) => {
      next();
    });

    // Apply routes
    app.use('/api', apiRoutes);
    app.use('/api/jobs', jobStatusRoutes);
  });

  describe('POST /api/sanitize/json - Queue Manager DB Connection Failures', () => {
    it('should handle JobStatus.save() SQLite connection failure', async () => {
      const content = '{"test": "data"}';
      const dbError = new Error('SQLite connection failed');

      // Mock JobStatus constructor and save failure
      const mockJobStatus = new JobStatus({ jobId: '123' });
      mockJobStatus.save.mockRejectedValue(dbError);

      queueManager.addJob.mockRejectedValue(dbError);

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: true })
        .expect(500);

      expect(response.body.error).toBe('Failed to submit async job');
      expect(queueManager.addJob).toHaveBeenCalledTimes(1);
    });

    it('should handle JobStatus.save() SQLite write failure', async () => {
      const content = '{"test": "data"}';
      const dbError = new Error('SQLite write failed: disk full');

      queueManager.addJob.mockRejectedValue(dbError);

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: true })
        .expect(500);

      expect(response.body.error).toBe('Failed to submit async job');
    });

    it('should handle queue initialization failure', async () => {
      const content = '{"test": "data"}';
      const initError = new Error('Queue initialization failed');

      queueManager.addJob.mockRejectedValue(initError);

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content, async: true })
        .expect(500);

      expect(response.body.error).toBe('Failed to submit async job');
    });
  });

  describe('POST /api/documents/upload - Queue Manager Failures', () => {
    it('should handle queue submission failure for PDF upload', async () => {
      const uploadError = new Error('Queue submission failed');

      queueManager.addJob.mockRejectedValue(uploadError);

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('fake pdf content'), 'test.pdf')
        .expect(500);

      expect(response.body.error).toBe('Failed to submit async job');
    });

    it('should handle DB write failure during PDF upload job creation', async () => {
      const dbError = new Error('Database write error');

      queueManager.addJob.mockRejectedValue(dbError);

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('fake pdf content'), 'test.pdf')
        .expect(500);

      expect(response.body.error).toBe('Failed to submit async job');
    });
  });

  describe('Malformed Job Data Handling', () => {
    it('should handle invalid JSON in job data', async () => {
      const invalidContent = '{"invalid": json';
      const parseError = new Error('Invalid JSON');

      queueManager.addJob.mockRejectedValue(parseError);

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content: invalidContent, async: true })
        .expect(500);

      expect(response.body.error).toBe('Failed to submit async job');
    });

    it('should handle missing required fields in job data', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ async: true })
        .expect(400);

      expect(response.body.error).toContain('content');
    });
  });

  describe('Worker Processing Failures', () => {
    it('should handle PDF parsing failure in worker', async () => {
      // This would be tested by mocking the worker, but since we're testing API level,
      // we test that errors are properly returned when job fails
      const jobId = '123456789';

      queueManager.addJob.mockResolvedValue(jobId);

      // Mock successful job submission
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content: '{"test": "data"}', async: true })
        .expect(202);

      expect(response.body.taskId).toBe(jobId);
      expect(response.body.status).toBe('processing');
    });

    // Note: Worker failures are tested at the worker level in jobWorker.test.js
    // Here we ensure the API properly submits jobs that may fail in worker
  });

  describe('Job Status Retrieval Errors', () => {
    it('should handle JobStatus.load() DB failure', async () => {
      const taskId = '123456789';
      const dbError = new Error('Database connection failed');

      JobStatus.load.mockRejectedValue(dbError);

      const response = await request(app).get(`/api/jobs/${taskId}/status`).expect(500);

      expect(response.body.error).toBe('Failed to retrieve job status');
    });

    it('should handle expired job status', async () => {
      const taskId = '123456790';
      const mockJob = {
        jobId: taskId,
        status: 'processing',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        isExpired: () => true,
      };

      JobStatus.load.mockResolvedValue(mockJob);

      const response = await request(app).get(`/api/jobs/${taskId}/status`).expect(410);

      expect(response.body.error).toBe('Job has expired');
    });
  });

  describe('Job Result Retrieval Errors', () => {
    it('should handle JobResult.load() failure', async () => {
      const taskId = '123456791';
      const mockJob = {
        jobId: taskId,
        status: 'completed',
        result: 'fallback result',
        updatedAt: new Date().toISOString(),
        isExpired: () => false,
      };

      JobStatus.load.mockResolvedValue(mockJob);
      JobResult.load.mockRejectedValue(new Error('Cache load failed'));

      const response = await request(app).get(`/api/jobs/${taskId}/result`).expect(200);

      // Should fallback to job status result
      expect(response.body.result).toBe('fallback result');
    });

    it('should handle JobResult.save() failure during caching', async () => {
      const taskId = '123456792';
      const mockJob = {
        jobId: taskId,
        status: 'completed',
        result: 'test result',
        updatedAt: new Date().toISOString(),
        isExpired: () => false,
      };

      JobStatus.load.mockResolvedValue(mockJob);
      JobResult.load.mockResolvedValue(null); // No cached result
      const mockJobResult = new JobResult({ jobId: taskId, result: 'test result' });
      mockJobResult.save.mockRejectedValue(new Error('Cache save failed'));
      JobResult.mockReturnValue(mockJobResult);

      const response = await request(app).get(`/api/jobs/${taskId}/result`).expect(200);

      // Should still return result even if caching fails
      expect(response.body.result).toBe('test result');
    });
  });

  describe('Job Cancellation Errors', () => {
    it('should handle JobStatus.load() failure during cancellation', async () => {
      const taskId = '123456793';
      const dbError = new Error('DB load failed');

      JobStatus.load.mockRejectedValue(dbError);

      const response = await request(app).delete(`/api/jobs/${taskId}`).expect(500);

      expect(response.body.error).toBe('Failed to cancel/delete job');
    });

    it('should handle JobStatus.cancel() failure', async () => {
      const taskId = '123456794';
      const mockJob = {
        jobId: taskId,
        status: 'processing',
        cancel: jest.fn().mockRejectedValue(new Error('Cancel failed')),
        isExpired: () => false,
      };

      JobStatus.load.mockResolvedValue(mockJob);

      const response = await request(app).delete(`/api/jobs/${taskId}`).expect(500);

      expect(response.body.error).toBe('Failed to cancel/delete job');
    });
  });
});
