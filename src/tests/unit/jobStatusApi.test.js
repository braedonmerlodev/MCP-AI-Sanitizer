const request = require('supertest');
const app = require('../../app');
const JobStatus = require('../models/JobStatus');
const fs = require('node:fs').promises;
const path = require('node:path');

describe('Job Status API Routes', () => {
  const testDbPath = path.join(__dirname, '../../../data/test-job-status-api.db');

  beforeEach(async () => {
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  describe('GET /api/jobs/:taskId', () => {
    it('should return 400 for invalid taskId', async () => {
      const response = await request(app).get('/api/jobs/invalid').expect(400);

      expect(response.body.error).toContain('taskId');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app).get('/api/jobs/nonexistent123').expect(404);

      expect(response.body.error).toBe('Job not found');
    });

    it('should return job status for existing job', async () => {
      // Create a test job status
      const jobStatus = new JobStatus({
        jobId: 'test123',
        status: 'processing',
        dbPath: testDbPath,
      });
      await jobStatus.save();

      const response = await request(app).get('/api/jobs/test123').expect(200);

      expect(response.body.taskId).toBe('test123');
      expect(response.body.status).toBe('processing');
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should return result for completed job', async () => {
      const result = { sanitizedContent: 'test', trustToken: {} };
      const jobStatus = new JobStatus({
        jobId: 'completed123',
        status: 'completed',
        result,
        dbPath: testDbPath,
      });
      await jobStatus.save();

      const response = await request(app).get('/api/jobs/completed123').expect(200);

      expect(response.body.taskId).toBe('completed123');
      expect(response.body.status).toBe('completed');
      expect(response.body.result).toEqual(result);
      expect(response.body.completedAt).toBeDefined();
    });

    it('should return error for failed job', async () => {
      const jobStatus = new JobStatus({
        jobId: 'failed123',
        status: 'failed',
        errorMessage: 'Processing failed',
        dbPath: testDbPath,
      });
      await jobStatus.save();

      const response = await request(app).get('/api/jobs/failed123').expect(200);

      expect(response.body.taskId).toBe('failed123');
      expect(response.body.status).toBe('failed');
      expect(response.body.error).toBe('Processing failed');
    });
  });
});
