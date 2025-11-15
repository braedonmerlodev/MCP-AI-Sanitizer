const JobStatus = require('../../models/JobStatus');

describe('JobStatus', () => {
  it('should create a job status with default values', () => {
    const jobStatus = new JobStatus({ jobId: '123' });

    expect(jobStatus.jobId).toBe('123');
    expect(jobStatus.status).toBe('queued');
    expect(jobStatus.retryCount).toBe(0);
  });

  it('should update status', () => {
    const jobStatus = new JobStatus({ jobId: '123' });

    jobStatus.updateStatus('completed');

    expect(jobStatus.status).toBe('completed');
    expect(jobStatus.updatedAt).toBeDefined();
  });

  it('should increment retry count', () => {
    const jobStatus = new JobStatus({ jobId: '123' });

    jobStatus.incrementRetry();

    expect(jobStatus.retryCount).toBe(1);
  });

  it('should convert to object', () => {
    const jobStatus = new JobStatus({ jobId: '123' });

    const obj = jobStatus.toObject();

    expect(obj.jobId).toBe('123');
  });
});
