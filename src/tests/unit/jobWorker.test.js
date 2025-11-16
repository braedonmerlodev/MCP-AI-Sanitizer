const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('jobWorker', () => {
  let mockJobStatus;

  beforeEach(() => {
    mockJobStatus = {
      updateStatus: sinon.stub().resolves(),
    };
  });

  it('should process job successfully', (done) => {
    const mockSanitize = sinon.stub().resolves('sanitized data');
    const MockProxySanitizer = class {
      sanitize = mockSanitize;
    };

    const MockJobStatus = {
      load: sinon.stub().resolves(mockJobStatus),
    };

    const processJob = proxyquire('../../workers/jobWorker', {
      '../components/proxy-sanitizer': MockProxySanitizer,
      '../models/JobStatus': MockJobStatus,
    });

    const job = { id: '123', data: 'test', options: {} };

    processJob(job, (err, result) => {
      expect(err).toBeNull();
      expect(result).toBe('sanitized data');
      expect(mockSanitize.calledOnce).toBe(true);
      expect(mockJobStatus.updateStatus.calledWith('processing')).toBe(true);
      expect(mockJobStatus.updateStatus.calledWith('completed')).toBe(true);
      done();
    });
  });

  it('should handle job processing error', (done) => {
    const mockSanitize = sinon.stub().rejects(new Error('processing error'));
    const MockProxySanitizer = class {
      sanitize = mockSanitize;
    };

    const MockJobStatus = {
      load: sinon.stub().resolves(mockJobStatus),
    };

    const processJob = proxyquire('../../workers/jobWorker', {
      '../components/proxy-sanitizer': MockProxySanitizer,
      '../models/JobStatus': MockJobStatus,
    });

    const job = { id: '123', data: 'test', options: {} };

    processJob(job, (err, result) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('processing error');
      expect(result).toBeUndefined();
      expect(mockJobStatus.updateStatus.calledWith('processing')).toBe(true);
      expect(mockJobStatus.updateStatus.calledWith('failed', 'processing error')).toBe(true);
      done();
    });
  });

  it('should handle invalid callback gracefully', () => {
    const MockJobStatus = {
      load: sinon.stub().resolves(),
    };

    const processJob = proxyquire('../../workers/jobWorker', {
      '../models/JobStatus': MockJobStatus,
    });

    const job = { id: '123', data: 'test', options: {} };

    // Should not throw, just log and return
    expect(() => processJob(job, null)).not.toThrow();
    expect(() => processJob(job, undefined)).not.toThrow();
    expect(() => processJob(job, 'not a function')).not.toThrow();
  });
});
