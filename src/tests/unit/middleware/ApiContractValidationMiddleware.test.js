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

describe('ApiContractValidationMiddleware', () => {
  let req, res, next, middleware;

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
});
