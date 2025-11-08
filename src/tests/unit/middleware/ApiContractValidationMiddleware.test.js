/**
 * Unit tests for ApiContractValidationMiddleware
 */

const apiContractValidationMiddleware = require('../../../middleware/ApiContractValidationMiddleware');
const Joi = require('joi');

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    level: 'debug',
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  })),
  format: {
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

const winston = require('winston');
const mockLogger = winston.createLogger();

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
    };
    next = jest.fn();

    // Reset mocks
    warnSpy.mockClear();
    infoSpy.mockClear();
    res.json.mockClear();
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
});
