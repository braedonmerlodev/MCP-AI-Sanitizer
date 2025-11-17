const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('QueueManager', () => {
  let mockQueue;
  let QueueManager;
  let mockJobStatus;

  beforeEach(() => {
    mockQueue = {
      push: sinon.stub().resolves(),
      getStats: sinon.stub().returns({ total: 0 }),
    };

    const MockQueue = function () {
      console.log('MockQueue constructor called, returning mockQueue');
      return mockQueue;
    };

    mockJobStatus = {
      save: sinon.stub().resolves(),
    };
    const MockJobStatus = sinon.stub().returns(mockJobStatus);

    const jobStatusPath = require.resolve('../../models/JobStatus');
    QueueManager = proxyquire('../../utils/queueManager', {
      'better-queue': MockQueue,
      [jobStatusPath]: MockJobStatus,
    });

    // Reset static queue
    QueueManager.constructor.queue = null;
  });

  it('should add a job successfully', async () => {
    const data = 'test data';
    const options = { classification: 'llm' };

    const jobId = await QueueManager.addJob(data, options);

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should add a job with priority', async () => {
    const data = 'test data';
    const options = { classification: 'llm', priority: 8 };

    const jobId = await QueueManager.addJob(data, options);

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should get queue stats', () => {
    const stats = QueueManager.getStats();

    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
  });

  it('should resolve all module dependencies correctly', () => {
    // Test that the module can be required without errors
    const QueueManagerModule = require('../../utils/queueManager');
    expect(QueueManagerModule).toBeDefined();
    expect(typeof QueueManagerModule.addJob).toBe('function');
    expect(typeof QueueManagerModule.getStats).toBe('function');
  });
});
