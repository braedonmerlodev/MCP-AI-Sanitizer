const JobStatus = require('../../models/JobStatus');
const fs = require('node:fs').promises;
const path = require('node:path');
const request = require('supertest');
const app = require('../../app');

describe('JobStatus', () => {
  const testDbPath = path.join(__dirname, '../../../data/job-status.db');

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

  it('should generate unique id', () => {
    const js1 = new JobStatus();
    const js2 = new JobStatus();
    expect(js1.id).not.toBe(js2.id);
    expect(js1.id).toMatch(/^js_\d+_[a-z0-9]+$/);
  });

  it('should calculate expiry 24 hours from creation', () => {
    const createdAt = '2023-01-01T10:00:00.000Z';
    const js = new JobStatus({ createdAt });
    const expectedExpiry = '2023-01-02T10:00:00.000Z';
    expect(js.expiresAt).toBe(expectedExpiry);
  });

  it('should update progress and current step', async () => {
    const jobStatus = new JobStatus({ jobId: '123', dbPath: testDbPath });

    await jobStatus.updateProgress(50, 'Step 1', 10);

    expect(jobStatus.progress).toBe(50);
    expect(jobStatus.currentStep).toBe('Step 1');
    expect(jobStatus.totalSteps).toBe(10);

    // Load and verify
    const loaded = await JobStatus.load('123', testDbPath);
    expect(loaded.progress).toBe(50);
    expect(loaded.currentStep).toBe('Step 1');
    expect(loaded.totalSteps).toBe(10);
  });

  it('should clamp progress to 0-100', async () => {
    const jobStatus = new JobStatus({ jobId: '123', dbPath: testDbPath });

    await jobStatus.updateProgress(150);
    expect(jobStatus.progress).toBe(100);

    await jobStatus.updateProgress(-10);
    expect(jobStatus.progress).toBe(0);
  });

  it('should check if job is expired', () => {
    const jobStatus = new JobStatus({ jobId: '123', dbPath: testDbPath });
    expect(jobStatus.isExpired()).toBe(false);

    // Set expired
    jobStatus.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(jobStatus.isExpired()).toBe(true);
  });

  it('should cancel job if status is queued or processing', async () => {
    const jobStatus = new JobStatus({ jobId: '123', status: 'queued', dbPath: testDbPath });
    await jobStatus.cancel();
    expect(jobStatus.status).toBe('cancelled');

    const loaded = await JobStatus.load('123', testDbPath);
    expect(loaded.status).toBe('cancelled');
  });

  it('should not cancel job if status is completed', async () => {
    const jobStatus = new JobStatus({ jobId: '123', status: 'completed', dbPath: testDbPath });
    await jobStatus.cancel();
    expect(jobStatus.status).toBe('completed');
  });

  it('should create JobStatus from object', () => {
    const obj = { jobId: 'from-obj', status: 'processing' };
    const js = JobStatus.fromObject(obj);
    expect(js).toBeInstanceOf(JobStatus);
    expect(js.jobId).toBe('from-obj');
    expect(js.status).toBe('processing');
  });
});

describe('Job Status API Routes', () => {
  describe('GET /api/jobs/:taskId', () => {
    it('should return 400 for invalid taskId', async () => {
      const response = await request(app).get('/api/jobs/invalid').expect(400);

      expect(response.body.error).toContain('taskId');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app).get('/api/jobs/9999999999999').expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });
});
