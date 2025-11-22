const ErrorQueue = require('../../models/ErrorQueue');

describe('ErrorQueue', () => {
  let errorQueue;
  let mockData;

  beforeEach(() => {
    const recentTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    mockData = {
      id: 'test-id',
      timestamp: recentTime,
      dataId: 'data-123',
      errorType: 'schema',
      errorDetails: { field: 'name', issue: 'required' },
      retryCount: 1,
      status: 'queued',
      queuedAt: recentTime,
      lastAttempt: recentTime,
      resolvedAt: null,
      resolution: null,
      createdAt: recentTime,
      updatedAt: recentTime,
    };
    errorQueue = new ErrorQueue(mockData);
  });

  describe('constructor', () => {
    it('should initialize with provided data', () => {
      expect(errorQueue.id).toBe('test-id');
      expect(errorQueue.dataId).toBe('data-123');
      expect(errorQueue.errorType).toBe('schema');
      expect(errorQueue.retryCount).toBe(1);
      expect(errorQueue.status).toBe('queued');
    });

    it('should generate id if not provided', () => {
      const newErrorQueue = new ErrorQueue();
      expect(newErrorQueue.id).toMatch(/^eq_\d+_[a-z0-9]+$/);
    });

    it('should set default values', () => {
      const newErrorQueue = new ErrorQueue({ dataId: 'test' });
      expect(newErrorQueue.errorType).toBe('unknown');
      expect(newErrorQueue.retryCount).toBe(0);
      expect(newErrorQueue.status).toBe('queued');
      expect(newErrorQueue.createdAt).toBeDefined();
    });
  });

  describe('canRetry', () => {
    it('should return true if retry count is less than max and status is queued', () => {
      expect(errorQueue.canRetry(3)).toBe(true);
    });

    it('should return false if retry count exceeds max', () => {
      errorQueue.retryCount = 3;
      expect(errorQueue.canRetry(3)).toBe(false);
    });

    it('should return false if status is not queued', () => {
      errorQueue.status = 'processing';
      expect(errorQueue.canRetry(3)).toBe(false);
    });

    it('should use default maxRetries of 3', () => {
      expect(errorQueue.canRetry()).toBe(true);
    });
  });

  describe('incrementRetry', () => {
    it('should increment retry count and update timestamps', () => {
      const before = errorQueue.retryCount;
      errorQueue.incrementRetry();
      expect(errorQueue.retryCount).toBe(before + 1);
      expect(errorQueue.lastAttempt).toBeDefined();
      expect(errorQueue.updatedAt).toBeDefined();
    });
  });

  describe('resolve', () => {
    it('should mark as resolved and set resolution', () => {
      errorQueue.resolve('Fixed by admin');
      expect(errorQueue.status).toBe('resolved');
      expect(errorQueue.resolution).toBe('Fixed by admin');
      expect(errorQueue.resolvedAt).toBeDefined();
      expect(errorQueue.updatedAt).toBeDefined();
    });

    it('should use empty string if no resolution provided', () => {
      errorQueue.resolve();
      expect(errorQueue.resolution).toBe('');
    });
  });

  describe('abandon', () => {
    it('should mark as abandoned and set reason', () => {
      errorQueue.abandon('Too many retries');
      expect(errorQueue.status).toBe('abandoned');
      expect(errorQueue.resolution).toBe('Too many retries');
      expect(errorQueue.resolvedAt).toBeDefined();
      expect(errorQueue.updatedAt).toBeDefined();
    });

    it('should use empty string if no reason provided', () => {
      errorQueue.abandon();
      expect(errorQueue.resolution).toBe('');
    });
  });

  describe('isExpired', () => {
    it('should return false if not expired', () => {
      expect(errorQueue.isExpired(24)).toBe(false);
    });

    it('should return true if expired', () => {
      errorQueue.queuedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      expect(errorQueue.isExpired(24)).toBe(true);
    });

    it('should use default maxAgeHours of 24', () => {
      expect(errorQueue.isExpired()).toBe(false);
    });
  });

  describe('getPriority', () => {
    it('should return correct priority for known error types', () => {
      errorQueue.errorType = 'cryptographic';
      expect(errorQueue.getPriority()).toBe('critical');

      errorQueue.errorType = 'atomic_operation';
      expect(errorQueue.getPriority()).toBe('high');

      errorQueue.errorType = 'referential';
      expect(errorQueue.getPriority()).toBe('high');

      errorQueue.errorType = 'schema';
      expect(errorQueue.getPriority()).toBe('medium');

      errorQueue.errorType = 'null_value';
      expect(errorQueue.getPriority()).toBe('low');
    });

    it('should return medium for unknown error types', () => {
      errorQueue.errorType = 'unknown_type';
      expect(errorQueue.getPriority()).toBe('medium');
    });
  });

  describe('toObject', () => {
    it('should return plain object representation', () => {
      const obj = errorQueue.toObject();
      expect(obj).toEqual(mockData);
      expect(typeof obj).toBe('object');
    });
  });

  describe('fromObject', () => {
    it('should create ErrorQueue from plain object', () => {
      const obj = errorQueue.toObject();
      const newErrorQueue = ErrorQueue.fromObject(obj);
      expect(newErrorQueue.id).toBe(errorQueue.id);
      expect(newErrorQueue.dataId).toBe(errorQueue.dataId);
    });
  });
});
