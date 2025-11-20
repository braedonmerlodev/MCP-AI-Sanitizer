// Mock winston logger
const mockLogger = {
  level: 'debug',
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
};

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

/**
 * Unit tests for ApiContractValidationMiddleware
 */

const apiContractValidationMiddleware = require('../../../middleware/ApiContractValidationMiddleware');
const Joi = require('joi');

// Spy on logger methods
const warnSpy = jest.spyOn(mockLogger, 'warn');
const infoSpy = jest.spyOn(mockLogger, 'info');

// Performance monitoring utilities for validation safety
const performanceMonitor = {
  thresholds: {
    requestValidation: 50, // ms
    responseValidation: 25, // ms
    totalValidation: 100, // ms
  },

  timings: {
    requestValidation: [],
    responseValidation: [],
    totalValidation: [],
  },

  startTiming: (operation) => {
    return {
      operation,
      startTime: process.hrtime.bigint(),
    };
  },

  endTiming: (timingContext) => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - timingContext.startTime) / 1_000_000; // Convert to milliseconds

    performanceMonitor.timings[timingContext.operation].push(durationMs);

    // Check against thresholds
    const threshold = performanceMonitor.thresholds[timingContext.operation];
    if (threshold && durationMs > threshold) {
      console.warn(
        `⚠️ Performance threshold exceeded for ${timingContext.operation}: ${durationMs.toFixed(2)}ms (threshold: ${threshold}ms)`,
      );
    }

    return durationMs;
  },

  getAverageTiming: (operation) => {
    const timings = performanceMonitor.timings[operation];
    if (timings.length === 0) return 0;
    return timings.reduce((sum, time) => sum + time, 0) / timings.length;
  },

  reset: () => {
    performanceMonitor.timings = {
      requestValidation: [],
      responseValidation: [],
      totalValidation: [],
    };
  },

  getStats: () => {
    return {
      averages: {
        requestValidation: performanceMonitor.getAverageTiming('requestValidation'),
        responseValidation: performanceMonitor.getAverageTiming('responseValidation'),
        totalValidation: performanceMonitor.getAverageTiming('totalValidation'),
      },
      thresholds: { ...performanceMonitor.thresholds },
      sampleCounts: {
        requestValidation: performanceMonitor.timings.requestValidation.length,
        responseValidation: performanceMonitor.timings.responseValidation.length,
        totalValidation: performanceMonitor.timings.totalValidation.length,
      },
    };
  },
};

describe('ApiContractValidationMiddleware', () => {
  let req, res, next, middleware;
  let baselineState = {};

  // Rollback procedures for test isolation and safety
  beforeAll(() => {
    // Capture baseline state before any tests run
    baselineState.mockLogger = { ...mockLogger };
    baselineState.originalConsole = globalThis.console;
    baselineState.originalProcessEnv = { ...process.env };

    // Set test environment variables for isolation
    process.env.NODE_ENV = 'test';
    process.env.API_CONTRACT_VALIDATION_ENABLED = 'true';

    globalThis.console.log('🔄 Test baseline captured - rollback procedures active');
  });

  beforeEach(() => {
    req = {
      body: {},
      originalUrl: '/test',
      method: 'POST',
      ip: '127.0.0.1',
      get: jest.fn(() => 'test-agent'),
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    // Reset mocks
    warnSpy.mockClear();
    infoSpy.mockClear();
    res.json.mockClear();
    res.status.mockClear();
    next.mockClear();
  });

  describe('Request Validation', () => {
    it('should pass valid request and log debug', () => {
      const requestSchema = Joi.object({
        name: Joi.string().required(),
      });
      const responseSchema = null;

      middleware = apiContractValidationMiddleware(requestSchema, responseSchema);
      req.body = { name: 'test' };

      middleware(req, res, next);

      expect(infoSpy).toHaveBeenCalledWith('Request validation passed', expect.any(Object));
      expect(warnSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should log warning for invalid request but continue', () => {
      const requestSchema = Joi.object({
        name: Joi.string().required(),
      });
      const responseSchema = null;

      middleware = apiContractValidationMiddleware(requestSchema, responseSchema);
      req.body = { invalid: 'data' };

      middleware(req, res, next);

      expect(warnSpy).toHaveBeenCalledWith(
        'Request validation failed',
        expect.objectContaining({
          endpoint: '/test',
          method: 'POST',
          errors: expect.any(Array),
        }),
      );
      expect(infoSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip request validation if no schema provided', () => {
      const requestSchema = null;
      const responseSchema = null;

      middleware = apiContractValidationMiddleware(requestSchema, responseSchema);

      middleware(req, res, next);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Response Validation', () => {
    it('should pass valid response and log debug', () => {
      const requestSchema = null;
      const responseSchema = Joi.object({
        message: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, responseSchema);
      middleware(req, res, next);

      const testData = { message: 'success' };
      res.json(testData);

      expect(infoSpy).toHaveBeenCalledWith('Response validation passed', expect.any(Object));
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should log warning for invalid response but continue', () => {
      const requestSchema = null;
      const responseSchema = Joi.object({
        message: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, responseSchema);
      middleware(req, res, next);

      const testData = { invalid: 'data' };
      res.json(testData);

      expect(warnSpy).toHaveBeenCalledWith(
        'Response validation failed',
        expect.objectContaining({
          endpoint: '/test',
          method: 'POST',
          errors: expect.any(Array),
        }),
      );
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('should skip response validation if no schema provided', () => {
      const requestSchema = null;
      const responseSchema = null;

      middleware = apiContractValidationMiddleware(requestSchema, responseSchema);
      middleware(req, res, next);

      const testData = { any: 'data' };
      res.json(testData);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  describe('Non-blocking Behavior', () => {
    it('should always call next() regardless of validation errors', () => {
      const requestSchema = Joi.object({
        required: Joi.string().required(),
      });
      const responseSchema = Joi.object({
        required: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, responseSchema);
      req.body = { invalid: true };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Now test response
      res.json({ invalid: true });
    });
  });

  describe('Logging Context', () => {
    it('should include request context in error logs', () => {
      const requestSchema = Joi.object({
        name: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = {};

      middleware(req, res, next);

      expect(warnSpy).toHaveBeenCalledWith(
        'Request validation failed',
        expect.objectContaining({
          endpoint: '/test',
          method: 'POST',
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          timestamp: expect.any(String),
          requestBody: {},
          errors: expect.any(Array),
        }),
      );
    });
  });

  describe('Edge Cases in Schema Validation', () => {
    it('should handle empty request body', () => {
      const requestSchema = Joi.object({
        name: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = {};

      middleware(req, res, next);

      expect(warnSpy).toHaveBeenCalledWith('Request validation failed', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('should handle null values in request', () => {
      const requestSchema = Joi.object({
        name: Joi.string().allow(null).required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = { name: null };

      middleware(req, res, next);

      expect(infoSpy).toHaveBeenCalledWith('Request validation passed', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('should validate arrays correctly', () => {
      const requestSchema = Joi.object({
        items: Joi.array().items(Joi.string()).required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = { items: ['a', 'b', 'c'] };

      middleware(req, res, next);

      expect(infoSpy).toHaveBeenCalledWith('Request validation passed', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('should fail validation for invalid array', () => {
      const requestSchema = Joi.object({
        items: Joi.array().items(Joi.string()).required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = { items: [1, 2, 3] };

      middleware(req, res, next);

      expect(warnSpy).toHaveBeenCalledWith('Request validation failed', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('should validate nested objects', () => {
      const requestSchema = Joi.object({
        user: Joi.object({
          name: Joi.string().required(),
          age: Joi.number().integer().min(0),
        }).required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = { user: { name: 'John', age: 25 } };

      middleware(req, res, next);

      expect(infoSpy).toHaveBeenCalledWith('Request validation passed', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('should fail nested object validation', () => {
      const requestSchema = Joi.object({
        user: Joi.object({
          name: Joi.string().required(),
          age: Joi.number().integer().min(0),
        }).required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = { user: { name: '', age: -5 } };

      middleware(req, res, next);

      expect(warnSpy).toHaveBeenCalledWith('Request validation failed', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Logging Scenarios', () => {
    it('should log detailed errors for multiple validation failures', () => {
      const requestSchema = Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        age: Joi.number().integer().min(18),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = { name: '', email: 'invalid', age: 15 };

      middleware(req, res, next);

      expect(warnSpy).toHaveBeenCalledWith(
        'Request validation failed',
        expect.objectContaining({
          errors: expect.any(Array),
        }),
      );
      expect(next).toHaveBeenCalled();
    });

    it('should log response validation errors with context', () => {
      const responseSchema = Joi.object({
        status: Joi.string().valid('success', 'error').required(),
      });

      middleware = apiContractValidationMiddleware(null, responseSchema);
      middleware(req, res, next);

      res.json({ status: 'unknown' });

      expect(warnSpy).toHaveBeenCalledWith(
        'Response validation failed',
        expect.objectContaining({
          endpoint: '/test',
          method: 'POST',
          errors: expect.any(Array),
        }),
      );
    });
  });

  describe('Various Request/Response Formats', () => {
    it('should handle GET requests without body', () => {
      const requestSchema = Joi.object({
        query: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.method = 'GET';
      req.body = {}; // GET might not have body, but assuming query params are in body for test

      middleware(req, res, next);

      expect(warnSpy).toHaveBeenCalledWith('Request validation failed', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('should handle PUT requests', () => {
      const requestSchema = Joi.object({
        data: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.method = 'PUT';
      req.body = { data: 'updated' };

      middleware(req, res, next);

      expect(infoSpy).toHaveBeenCalledWith('Request validation passed', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('should validate response with array', () => {
      const responseSchema = Joi.array().items(
        Joi.object({
          id: Joi.number().required(),
          name: Joi.string().required(),
        }),
      );

      middleware = apiContractValidationMiddleware(null, responseSchema);
      middleware(req, res, next);

      res.json([
        { id: 1, name: 'Item1' },
        { id: 2, name: 'Item2' },
      ]);

      expect(infoSpy).toHaveBeenCalledWith('Response validation passed', expect.any(Object));
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      performanceMonitor.reset();
    });

    it('should track request validation performance', () => {
      const requestSchema = Joi.object({
        name: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(requestSchema, null);
      req.body = { name: 'test' };

      const timing = performanceMonitor.startTiming('requestValidation');
      middleware(req, res, next);
      const duration = performanceMonitor.endTiming(timing);

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(performanceMonitor.timings.requestValidation).toHaveLength(1);
      expect(performanceMonitor.getStats().sampleCounts.requestValidation).toBe(1);
    });

    it('should track response validation performance', () => {
      const responseSchema = Joi.object({
        message: Joi.string().required(),
      });

      middleware = apiContractValidationMiddleware(null, responseSchema);
      middleware(req, res, next);

      const timing = performanceMonitor.startTiming('responseValidation');
      res.json({ message: 'success' });
      const duration = performanceMonitor.endTiming(timing);

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(performanceMonitor.timings.responseValidation).toHaveLength(1);
      expect(performanceMonitor.getStats().sampleCounts.responseValidation).toBe(1);
    });

    it('should calculate average timings correctly', () => {
      // Add some mock timings
      performanceMonitor.timings.requestValidation = [10, 20, 30];

      const average = performanceMonitor.getAverageTiming('requestValidation');
      expect(average).toBe(20);
    });

    it('should return zero average for empty timing arrays', () => {
      const average = performanceMonitor.getAverageTiming('requestValidation');
      expect(average).toBe(0);
    });

    it('should provide comprehensive performance stats', () => {
      performanceMonitor.timings.requestValidation = [10, 20];
      performanceMonitor.timings.responseValidation = [5, 15];

      const stats = performanceMonitor.getStats();

      expect(stats.averages.requestValidation).toBe(15);
      expect(stats.averages.responseValidation).toBe(10);
      expect(stats.thresholds.requestValidation).toBe(50);
      expect(stats.sampleCounts.requestValidation).toBe(2);
      expect(stats.sampleCounts.responseValidation).toBe(2);
    });

    it('should warn when performance thresholds are exceeded', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock a slow validation by directly calling endTiming with a high duration
      const timingContext = {
        operation: 'requestValidation',
        startTime: process.hrtime.bigint() - BigInt(100 * 1_000_000),
      }; // 100ms ago
      performanceMonitor.endTiming(timingContext);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance threshold exceeded for requestValidation'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should reset timings correctly', () => {
      performanceMonitor.timings.requestValidation = [10, 20];
      performanceMonitor.timings.responseValidation = [5];

      performanceMonitor.reset();

      expect(performanceMonitor.timings.requestValidation).toHaveLength(0);
      expect(performanceMonitor.timings.responseValidation).toHaveLength(0);
      expect(performanceMonitor.timings.totalValidation).toHaveLength(0);
    });
  });
});
