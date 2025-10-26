const destinationTracking = require('../../../middleware/destination-tracking');

describe('Destination Tracking Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/api/test',
      get: jest.fn(),
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('LLM-bound classification', () => {
    test('should classify as LLM when X-Destination header is llm', () => {
      mockReq.get.mockReturnValue('llm');

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking).toEqual({
        classification: 'llm',
        confidence: 0.8,
        indicators: ['header:X-Destination=llm'],
        fallbackReason: null,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    test('should classify as LLM when path contains /llm/', () => {
      mockReq.path = '/api/llm/completion';
      mockReq.get.mockReturnValue(null);

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking.classification).toBe('llm');
      expect(mockReq.destinationTracking.indicators).toContain('path:/api/llm/completion');
    });

    test('should classify as LLM when path contains /ai/', () => {
      mockReq.path = '/api/ai/generate';
      mockReq.get.mockReturnValue(null);

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking.classification).toBe('llm');
    });

    test('should classify as LLM with high confidence for multiple indicators', () => {
      mockReq.path = '/api/llm/chat';
      mockReq.get.mockReturnValue('llm');

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking.classification).toBe('llm');
      expect(mockReq.destinationTracking.confidence).toBeGreaterThan(0.8);
      expect(mockReq.destinationTracking.indicators).toContain('header:X-Destination=llm');
      expect(mockReq.destinationTracking.indicators).toContain('path:/api/llm/chat');
    });
  });

  describe('Non-LLM classification', () => {
    test('should classify as non-LLM when X-Destination header is file', () => {
      mockReq.get.mockReturnValue('file');

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking).toEqual({
        classification: 'non-llm',
        confidence: 0.6,
        indicators: ['header:X-Destination=file'],
        fallbackReason: null,
      });
    });

    test('should classify as non-LLM when path contains /upload', () => {
      mockReq.path = '/api/documents/upload';
      mockReq.get.mockReturnValue(null);

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking.classification).toBe('non-llm');
      expect(mockReq.destinationTracking.indicators).toContain(
        'file-operation:/api/documents/upload',
      );
    });
  });

  describe('Unclear classification', () => {
    test('should classify as unclear when no indicators are present', () => {
      mockReq.get.mockReturnValue(null);

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking).toEqual({
        classification: 'unclear',
        confidence: 0,
        indicators: [],
        fallbackReason: 'low_confidence_score',
      });
    });

    test('should classify as unclear when confidence is low', () => {
      mockReq.path = '/api/test';
      mockReq.get.mockReturnValue(null);

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking.classification).toBe('unclear');
    });
  });

  describe('Content-Type analysis', () => {
    test('should increase confidence for text content types', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'Content-Type') return 'text/plain';
        return null;
      });

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking.confidence).toBeGreaterThan(0);
      expect(mockReq.destinationTracking.indicators).toContain('content-type:text/plain');
    });

    test('should increase confidence for JSON content types', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'Content-Type') return 'application/json';
        return null;
      });

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking.confidence).toBeGreaterThan(0);
      expect(mockReq.destinationTracking.indicators).toContain('content-type:application/json');
    });
  });

  describe('Error handling', () => {
    test('should default to unclear classification on error', () => {
      mockReq.get.mockImplementation(() => {
        throw new Error('Header parsing error');
      });

      destinationTracking(mockReq, mockRes, mockNext);

      expect(mockReq.destinationTracking).toEqual({
        classification: 'unclear',
        confidence: 0,
        indicators: [],
        fallbackReason: 'classification_error',
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
