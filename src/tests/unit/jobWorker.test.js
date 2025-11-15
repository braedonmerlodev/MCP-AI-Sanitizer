const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('jobWorker', () => {
  it('should process job successfully', (done) => {
    const mockSanitize = sinon.stub().resolves('sanitized data');
    const MockProxySanitizer = class {
      sanitize = mockSanitize;
    };

    const processJob = proxyquire('../../workers/jobWorker', {
      '../components/proxy-sanitizer': MockProxySanitizer,
    });

    const job = { id: '123', data: 'test', options: {} };

    processJob(job, (err, result) => {
      expect(err).toBeNull();
      expect(result).toBe('sanitized data');
      expect(mockSanitize.calledOnce).toBe(true);
      done();
    });
  });

  it('should handle job processing error', (done) => {
    const mockSanitize = sinon.stub().rejects(new Error('processing error'));
    const MockProxySanitizer = class {
      sanitize = mockSanitize;
    };

    const processJob = proxyquire('../../workers/jobWorker', {
      '../components/proxy-sanitizer': MockProxySanitizer,
    });

    const job = { id: '123', data: 'test', options: {} };

    processJob(job, (err, result) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('processing error');
      expect(result).toBeUndefined();
      done();
    });
  });
});
