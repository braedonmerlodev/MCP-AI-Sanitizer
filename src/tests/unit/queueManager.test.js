const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('QueueManager', () => {
  let mockQueue;
  let QueueManager;

  beforeEach(() => {
    mockQueue = {
      push: sinon.stub().callsArgWith(2, null), // Updated for priority parameter
      getStats: sinon.stub().returns({ total: 0 }),
    };

    const MockQueue = sinon.stub().returns(mockQueue);

    QueueManager = proxyquire('../../utils/queueManager', {
      'better-queue': MockQueue,
    });
  });

  it('should add a job successfully', async () => {
    const data = 'test data';
    const options = { classification: 'llm' };

    const jobId = await QueueManager.addJob(data, options);

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
    expect(mockQueue.push.calledOnce).toBe(true);
  });

  it('should add a job with priority', async () => {
    const data = 'test data';
    const options = { classification: 'llm', priority: 8 };

    const jobId = await QueueManager.addJob(data, options);

    expect(jobId).toBeDefined();
    expect(mockQueue.push.calledWith(sinon.match.object, { priority: 8 }, sinon.match.func)).toBe(
      true,
    );
  });

  it('should get queue stats', () => {
    const stats = QueueManager.getStats();

    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
    expect(mockQueue.getStats.calledOnce).toBe(true);
  });

  it('should resolve all module dependencies correctly', () => {
    // Test that the module can be required without errors
    const QueueManagerModule = require('../../utils/queueManager');
    expect(QueueManagerModule).toBeDefined();
    expect(typeof QueueManagerModule.addJob).toBe('function');
    expect(typeof QueueManagerModule.getStats).toBe('function');
  });
});
