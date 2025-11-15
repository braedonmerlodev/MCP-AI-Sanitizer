const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('QueueManager', () => {
  let mockQueue;
  let QueueManager;

  beforeEach(() => {
    mockQueue = {
      push: sinon.stub().callsArgWith(1, null),
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

  it('should get queue stats', () => {
    const stats = QueueManager.getStats();

    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
    expect(mockQueue.getStats.calledOnce).toBe(true);
  });
});
