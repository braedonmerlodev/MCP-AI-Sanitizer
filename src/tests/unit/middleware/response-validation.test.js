// Mock winston logger
const mockLogger = {
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
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

const responseValidationMiddleware = require('../../../middleware/response-validation');

describe('Response Validation Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let logger;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Get the mocked logger instance
    logger = mockLogger;

    // Mock request
    mockReq = {
      originalUrl: '/health',
    };

    // Mock response with json method
    const originalJson = jest.fn();
    mockRes = {
      json: originalJson,
    };

    // Store original for verification
    mockRes._originalJson = originalJson;

    // Mock next
    mockNext = jest.fn();
  });

  it('should pass valid /health response without logging errors', () => {
    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const validResponse = {
      status: 'healthy',
      timestamp: '2023-11-02T12:00:00.000Z',
    };

    mockRes.json(validResponse);

    expect(mockRes._originalJson).toHaveBeenCalledWith(validResponse);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should log validation errors for invalid /health response but still send response', () => {
    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const invalidResponse = {
      status: 'unhealthy', // Invalid status
      timestamp: 'invalid-date',
    };

    mockRes.json(invalidResponse);

    expect(mockRes._originalJson).toHaveBeenCalledWith(invalidResponse);
    expect(logger.warn).toHaveBeenCalledWith(
      'Response validation failed',
      expect.objectContaining({
        endpoint: '/health',
        schema: '/health',
        errors: expect.any(Array),
      }),
    );
  });

  it('should validate /api/documents/upload response correctly', () => {
    mockReq.originalUrl = '/api/documents/upload';

    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const validResponse = {
      message: 'PDF uploaded and processed successfully',
      fileName: 'test.pdf',
      size: 1024,
      status: 'processed',
      trustToken: { hash: 'abc123' },
      metadata: { pages: 5 },
      sanitizedContent: 'clean content',
    };

    mockRes.json(validResponse);

    expect(mockRes._originalJson).toHaveBeenCalledWith(validResponse);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should validate /api/trust-tokens/validate valid response', () => {
    mockReq.originalUrl = '/api/trust-tokens/validate';

    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const validResponse = {
      valid: true,
      message: 'Trust token is valid',
    };

    mockRes.json(validResponse);

    expect(mockRes._originalJson).toHaveBeenCalledWith(validResponse);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should validate /api/trust-tokens/validate invalid response', () => {
    mockReq.originalUrl = '/api/trust-tokens/validate';

    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const invalidResponse = {
      valid: false,
      error: 'Token has expired',
    };

    mockRes.json(invalidResponse);

    expect(mockRes._originalJson).toHaveBeenCalledWith(invalidResponse);
    expect(logger.warn).not.toHaveBeenCalled(); // This should be valid
  });

  it('should log errors for invalid /api/trust-tokens/validate response', () => {
    mockReq.originalUrl = '/api/trust-tokens/validate';

    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const invalidResponse = {
      valid: 'not-boolean', // Invalid type
      message: 'Something',
    };

    mockRes.json(invalidResponse);

    expect(mockRes._originalJson).toHaveBeenCalledWith(invalidResponse);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should validate /api/webhook/n8n response', () => {
    mockReq.originalUrl = '/api/webhook/n8n';

    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const validResponse = {
      result: {
        sanitizedData: 'Sanitized and processed response',
      },
    };

    mockRes.json(validResponse);

    expect(mockRes._originalJson).toHaveBeenCalledWith(validResponse);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should not validate endpoints without defined schemas', () => {
    mockReq.originalUrl = '/api/unknown-endpoint';

    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const response = { data: 'anything' };

    mockRes.json(response);

    expect(mockRes._originalJson).toHaveBeenCalledWith(response);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should handle query parameters in URL', () => {
    mockReq.originalUrl = '/health?param=value';

    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    const validResponse = {
      status: 'healthy',
      timestamp: '2023-11-02T12:00:00.000Z',
    };

    mockRes.json(validResponse);

    expect(mockRes._originalJson).toHaveBeenCalledWith(validResponse);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should call next() to continue middleware chain', () => {
    const middleware = responseValidationMiddleware;
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
