const JobStatus = require('../../models/JobStatus');
const fs = require('node:fs').promises;
const path = require('node:path');
const request = require('supertest');
const app = require('../../app');

describe('JobStatus', () => {
  const testDbPath = path.join(__dirname, '../../../data/test-job-status.db');

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

  it('should create a job status with default values', () => {
    const jobStatus = new JobStatus({ jobId: '123', dbPath: testDbPath });

    expect(jobStatus.jobId).toBe('123');
    expect(jobStatus.status).toBe('queued');
    expect(jobStatus.retryCount).toBe(0);
  });

  it('should update status and save', async () => {
    const jobStatus = new JobStatus({ jobId: '123', dbPath: testDbPath });

    await jobStatus.updateStatus('completed');

    expect(jobStatus.status).toBe('completed');
    expect(jobStatus.updatedAt).toBeDefined();

    // Load and verify
    const loaded = await JobStatus.load('123', testDbPath);
    expect(loaded.status).toBe('completed');
  });

  it('should increment retry count and save', async () => {
    const jobStatus = new JobStatus({ jobId: '123', dbPath: testDbPath });

    await jobStatus.incrementRetry();

    expect(jobStatus.retryCount).toBe(1);

    // Load and verify
    const loaded = await JobStatus.load('123', testDbPath);
    expect(loaded.retryCount).toBe(1);
  });

  it('should convert to object', () => {
    const jobStatus = new JobStatus({ jobId: '123', dbPath: testDbPath });

    const obj = jobStatus.toObject();

    expect(obj.jobId).toBe('123');
  });

  it('should save and load job status', async () => {
    const jobStatus = new JobStatus({ jobId: '123', status: 'processing', dbPath: testDbPath });
    await jobStatus.save();

    const loaded = await JobStatus.load('123', testDbPath);
    expect(loaded.jobId).toBe('123');
    expect(loaded.status).toBe('processing');
  });

  it('should save and load job status with result', async () => {
    const result = { sanitizedContent: 'test', trustToken: {} };
    const jobStatus = new JobStatus({
      jobId: 'result123',
      status: 'completed',
      result,
      dbPath: testDbPath,
    });
    await jobStatus.save();

    const loaded = await JobStatus.load('result123', testDbPath);
    expect(loaded.jobId).toBe('result123');
    expect(loaded.status).toBe('completed');
    expect(loaded.result).toEqual(result);
  });
});

describe('Job Status API Routes', () => {
  describe('GET /api/jobs/:taskId', () => {
    it('should return 400 for invalid taskId', async () => {
      const response = await request(app).get('/api/jobs/invalid').expect(400);

      expect(response.body.error).toContain('taskId');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app).get('/api/jobs/nonexistent123').expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });
});

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
