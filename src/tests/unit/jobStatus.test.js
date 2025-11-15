const JobStatus = require('../../models/JobStatus');
const fs = require('node:fs').promises;
const path = require('node:path');

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
});
