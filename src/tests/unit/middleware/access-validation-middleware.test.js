// Mock TrustTokenGenerator
const mockValidateToken = jest.fn();
jest.mock('../../../components/TrustTokenGenerator', () => {
  return jest.fn().mockImplementation(() => ({
    validateToken: mockValidateToken,
  }));
});

const accessValidationMiddleware = require('../../../middleware/AccessValidationMiddleware');

describe('AccessValidationMiddleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/documents/upload',
      ip: '127.0.0.1',
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();

    mockValidateToken.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Missing trust token header', () => {
    test('should return 403 when x-trust-token header is missing', () => {
      accessValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Trust token required',
        message: 'Access denied: Trust token is required for AI agent document access',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Invalid JSON in trust token header', () => {
    test('should return 403 when trust token is not valid JSON', () => {
      mockReq.headers['x-trust-token'] = 'invalid json';

      accessValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid trust token format',
        message: 'Trust token must be valid JSON',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Invalid trust token', () => {
    test('should return 403 when trust token validation fails', () => {
      const invalidToken = { some: 'data' };
      mockReq.headers['x-trust-token'] = JSON.stringify(invalidToken);
      mockValidateToken.mockReturnValue({ isValid: false, error: 'Invalid signature' });

      accessValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockValidateToken).toHaveBeenCalledWith(invalidToken);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid trust token',
        message: 'Invalid signature',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Valid trust token', () => {
    test('should call next and attach validation result when token is valid', () => {
      const validToken = {
        contentHash: 'hash123',
        originalHash: 'orig123',
        sanitizationVersion: '1.0',
        rulesApplied: ['rule1'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        signature: 'sig123',
      };
      mockReq.headers['x-trust-token'] = JSON.stringify(validToken);
      const validationResult = { isValid: true };
      mockValidateToken.mockReturnValue(validationResult);

      accessValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockValidateToken).toHaveBeenCalledWith(validToken);
      expect(mockReq.trustTokenValidation).toBe(validationResult);
      expect(mockReq.trustToken).toEqual(validToken);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should return 500 when an unexpected error occurs', () => {
      mockReq.headers['x-trust-token'] = JSON.stringify({});
      mockValidateToken.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      accessValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation service error',
        message: 'An error occurred during trust token validation',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
