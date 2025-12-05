// AI Input Sanitization Integration Tests
jest.mock('../../components/sanitization-pipeline');

const AITextTransformer = require('../../components/AITextTransformer');
const SanitizationPipeline = require('../../components/sanitization-pipeline');

describe('AI Input Sanitization Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should call sanitizer on AI input before transformation', async () => {
    const mockSanitize = jest.fn().mockResolvedValue('clean input');
    SanitizationPipeline.mockImplementation(() => ({
      sanitize: mockSanitize,
    }));

    const transformer = new AITextTransformer({
      model: 'gemini-pro',
      temperature: 0.1,
      maxTokens: 2000,
    });

    const input = 'test <script>alert(1)</script>';
    await transformer.transform(input, 'summarize');

    // Verify sanitizer was called with the input before AI processing
    expect(mockSanitize).toHaveBeenCalledWith(input, {});
  });

  test('should sanitize AI output after transformation', async () => {
    const mockSanitize = jest
      .fn()
      .mockResolvedValueOnce('clean input') // First call for input sanitization
      .mockResolvedValueOnce('clean output'); // Second call for output sanitization

    SanitizationPipeline.mockImplementation(() => ({
      sanitize: mockSanitize,
    }));

    const transformer = new AITextTransformer({
      model: 'gemini-pro',
      temperature: 0.1,
      maxTokens: 2000,
    });

    const input = 'test input';
    await transformer.transform(input, 'summarize');

    // Verify sanitizer was called twice: once for input, once for output
    expect(mockSanitize).toHaveBeenCalledTimes(2);
    expect(mockSanitize).toHaveBeenNthCalledWith(1, input, {});
    expect(mockSanitize).toHaveBeenNthCalledWith(2, expect.any(String), {}); // AI output
  });

  test('should reject input with dangerous content that fails sanitization validation', async () => {
    // Mock sanitizer that doesn't actually sanitize dangerous content
    const mockSanitize = jest.fn().mockResolvedValue('<script>alert("xss")</script>'); // Returns unsanitized content

    SanitizationPipeline.mockImplementation(() => ({
      sanitize: mockSanitize,
    }));

    const transformer = new AITextTransformer({
      model: 'gemini-pro',
      temperature: 0.1,
      maxTokens: 2000,
    });

    const dangerousInput = '<script>alert("xss")</script>';

    // Should throw error due to validation failure
    await expect(transformer.transform(dangerousInput, 'summarize')).rejects.toThrow(
      'Input sanitization validation failed - potential security risk',
    );
  });

  test('should handle various malicious input patterns', async () => {
    const maliciousInputs = [
      '<script>alert(1)</script>',
      'javascript:alert(1)',
      '<iframe src="evil.com"></iframe>',
      '<img src="x" onerror="alert(1)">',
      '<form action="evil.com"><input type="submit"></form>',
      'expression(alert(1))',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
    ];

    SanitizationPipeline.mockImplementation(() => ({
      sanitize: jest.fn().mockResolvedValue('cleaned content'),
    }));

    const transformer = new AITextTransformer({
      model: 'gemini-pro',
      temperature: 0.1,
      maxTokens: 2000,
    });

    // All malicious inputs should be processed (sanitized successfully)
    for (const input of maliciousInputs) {
      const result = await transformer.transform(input, 'summarize');
      expect(result).toBeDefined();
      expect(result.text).toBe('cleaned content');
    }
  });
});
