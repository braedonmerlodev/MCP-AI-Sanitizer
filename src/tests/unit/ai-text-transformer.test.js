const mockInvoke = jest.fn().mockResolvedValue({ content: 'AI output', response_metadata: {} });

jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn(),
}));
jest.mock('@langchain/core/prompts', () => ({
  PromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: mockInvoke,
      }),
    }),
  },
}));
jest.mock('../../components/sanitization-pipeline');
jest.mock('../../config/aiConfig', () => ({
  gemini: {
    apiKey: 'mock-api-key',
    isValid: true,
  },
}));

const AITextTransformer = require('../../components/AITextTransformer');

describe('AITextTransformer', () => {
  let transformer;
  let mockSanitizer;
  let mockGemini;

  beforeEach(() => {
    // Mock SanitizationPipeline
    mockSanitizer = {
      sanitize: jest.fn().mockResolvedValue('sanitized text'),
    };
    const MockSanitizationPipeline = jest.fn().mockImplementation(() => mockSanitizer);
    require('../../components/sanitization-pipeline').mockImplementation(MockSanitizationPipeline);

    // Mock PromptTemplate
    const MockPromptTemplate = {
      fromTemplate: jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          invoke: jest.fn().mockResolvedValue({ content: 'AI output' }),
        }),
      }),
    };
    require('@langchain/core/prompts').PromptTemplate = MockPromptTemplate;

    // Mock ChatGoogleGenerativeAI
    mockGemini = {};
    const MockChatGoogleGenerativeAI = require('@langchain/google-genai').ChatGoogleGenerativeAI;
    MockChatGoogleGenerativeAI.mockImplementation(() => mockGemini);

    transformer = new AITextTransformer();
  });

  test('should create AITextTransformer instance', () => {
    expect(transformer).toBeDefined();
    expect(transformer.gemini).toBeDefined();
    expect(transformer.sanitizer).toBeDefined();
    expect(transformer.prompts).toBeDefined();
    expect(require('@langchain/google-genai').ChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'mock-api-key',
      }),
    );
  });

  test('should transform text with structure type successfully', async () => {
    const result = await transformer.transform('raw text', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith('raw text', {});
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith('AI output', {});
    expect(result).toEqual({
      text: 'sanitized text',
      metadata: expect.objectContaining({
        processingTime: expect.any(Number),
        cost: expect.any(Number),
        tokens: expect.objectContaining({
          prompt: expect.any(Number),
          completion: expect.any(Number),
          total: expect.any(Number),
        }),
      }),
    });
  });

  test('should transform text with summarize type', async () => {
    const result = await transformer.transform('raw text', 'summarize');

    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBeDefined();
  });

  test('should transform text with extract_entities type', async () => {
    const result = await transformer.transform('raw text', 'extract_entities');

    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBeDefined();
  });

  test('should transform text with json_schema type', async () => {
    const result = await transformer.transform('raw text', 'json_schema');

    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBeDefined();
  });

  test('should throw error for unknown transformation type', async () => {
    await expect(transformer.transform('raw text', 'unknown')).rejects.toThrow(
      'Unknown transformation type: unknown',
    );
  });

  test('should fallback to sanitized input on AI error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('API error'));

    const result = await transformer.transform('raw text', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2); // Input sanitization + fallback sanitization
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toEqual({ fallback: true, reason: 'ai_error' });
  });

  test('should pass options to sanitizer', async () => {
    const options = { sanitizerOptions: { riskLevel: 'high' } };

    await transformer.transform('raw text', 'structure', options);

    expect(mockSanitizer.sanitize).toHaveBeenCalledWith('raw text', { riskLevel: 'high' });
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith('AI output', { riskLevel: 'high' });
  });

  test('should handle empty input text', async () => {
    const result = await transformer.transform('', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBeDefined();
  });

  test('should handle very long input text', async () => {
    const longText = 'a'.repeat(10_000);
    const result = await transformer.transform(longText, 'summarize');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBeDefined();
  });

  test('should handle special characters in input', async () => {
    const specialText = 'Text with <script>alert("xss")</script> and & symbols';
    const result = await transformer.transform(specialText, 'extract_entities');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBeDefined();
  });

  test('should handle JSON parsing errors gracefully', async () => {
    // Mock AI to return invalid JSON for json_schema type
    const mockPromptTemplate = require('@langchain/core/prompts').PromptTemplate;
    mockPromptTemplate.fromTemplate.mockReturnValueOnce({
      pipe: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({ content: 'invalid json {{{' }),
      }),
    });

    const result = await transformer.transform('test input', 'json_schema');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBeDefined();
  });

  test('should calculate costs correctly with token usage', async () => {
    // Mock response with token usage - need to mock the invoke function properly
    mockInvoke.mockResolvedValueOnce({
      content: 'AI output',
      response_metadata: {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      },
    });

    const result = await transformer.transform('test input', 'structure');

    expect(result.metadata.cost).toBeCloseTo(0.000_010_5, 6); // (14/1000)*0.00025 + (14/1000)*0.0005 for sanitized text lengths
    expect(result.metadata.tokens.prompt).toBe(100);
    expect(result.metadata.tokens.completion).toBe(50);
    expect(result.metadata.tokens.total).toBe(150);
  });

  test('should handle AI API timeout gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Request timeout'));

    const result = await transformer.transform('test input', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toEqual({ fallback: true, reason: 'ai_error' });
  });

  test('should handle network connectivity issues', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await transformer.transform('raw text', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toEqual({ fallback: true, reason: 'ai_error' });
  });

  test('should handle Gemini API quota exceeded errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Quota exceeded for quota metric'));

    const result = await transformer.transform('raw text', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toEqual({ fallback: true, reason: 'quota_exceeded' });
  });

  test('should handle Gemini API rate limit errors', async () => {
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.status = 429;
    mockInvoke.mockRejectedValueOnce(rateLimitError);

    const result = await transformer.transform('raw text', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toEqual({ fallback: true, reason: 'quota_exceeded' });
  });

  test('should enforce rate limits and fallback when exceeded', async () => {
    // Mock the rate limiter to return false
    const originalCanMakeRequest = transformer.constructor.prototype.rateLimiter?.canMakeRequest;
    if (transformer.constructor.prototype.rateLimiter) {
      transformer.constructor.prototype.rateLimiter.canMakeRequest = jest
        .fn()
        .mockReturnValue(false);
    }

    // Since rate limiter is global, we need to mock it differently
    // For this test, we'll mock the config to have low limit and simulate
    const result = await transformer.transform('raw text', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2); // Input and output sanitization
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toEqual({ fallback: true, reason: 'rate_limit_exceeded' });

    // Restore
    if (originalCanMakeRequest) {
      transformer.constructor.prototype.rateLimiter.canMakeRequest = originalCanMakeRequest;
    }
  });

  test('should validate transformation type exists', async () => {
    // Test that prompts object has expected keys
    expect(transformer.prompts).toHaveProperty('structure');
    expect(transformer.prompts).toHaveProperty('summarize');
    expect(transformer.prompts).toHaveProperty('extract_entities');
    expect(transformer.prompts).toHaveProperty('json_schema');
  });

  test('should initialize with custom model options', () => {
    // Clear previous calls to focus on this test
    const MockChatGoogleGenerativeAI = require('@langchain/google-genai').ChatGoogleGenerativeAI;
    MockChatGoogleGenerativeAI.mockClear();

    new AITextTransformer({
      model: 'gemini-pro-vision',
      temperature: 0.5,
      maxTokens: 1000,
    });

    expect(MockChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'models/gemini-pro-vision',
        temperature: 0.5,
        maxOutputTokens: 1000,
        apiKey: 'mock-api-key',
      }),
    );
  });

  test('should handle sanitizer initialization errors', () => {
    // Temporarily mock sanitizer constructor to throw
    const originalMock = require('../../components/sanitization-pipeline');
    originalMock.mockImplementationOnce(() => {
      throw new Error('Sanitizer initialization failed');
    });

    expect(() => new AITextTransformer()).toThrow('Sanitizer initialization failed');
  });

  describe('AI Security Awareness and Response Validation', () => {
    beforeEach(() => {
      transformer = new AITextTransformer({
        model: 'gemini-pro',
        temperature: 0.1,
        maxTokens: 2000,
      });
    });

    test('should validate AI response security for safe content', () => {
      const safeResponse = 'This is a safe response with normal content.';
      const validation = transformer.validateAIResponse(safeResponse, 'summarize');

      expect(validation.securityValidated).toBe(true);
      expect(validation.riskLevel).toBe('low');
      expect(validation.securityNotes).toEqual([]);
      expect(validation.validationTimestamp).toBeDefined();
    });

    test('should detect dangerous content in AI response', () => {
      const dangerousResponse = 'Safe content <script>alert("xss")</script> more safe content';
      const validation = transformer.validateAIResponse(dangerousResponse, 'summarize');

      expect(validation.securityValidated).toBe(false);
      expect(validation.riskLevel).toBe('high');
      expect(validation.securityNotes).toContain(
        'Dangerous or prohibited content detected in AI response',
      );
    });

    test('should validate JSON structure security for structure type', () => {
      const secureJsonResponse = JSON.stringify({
        title: 'Safe Title',
        summary: 'Safe summary',
        securityValidated: true,
      });
      const validation = transformer.validateAIResponse(secureJsonResponse, 'structure');

      expect(validation.securityValidated).toBe(true);
      expect(validation.riskLevel).toBe('low');
    });

    test('should flag JSON without security validation', () => {
      const insecureJsonResponse = JSON.stringify({
        title: 'Title',
        summary: 'Summary',
        // Missing securityValidated flag
      });
      const validation = transformer.validateAIResponse(insecureJsonResponse, 'structure');

      expect(validation.securityValidated).toBe(false);
      expect(validation.riskLevel).toBe('medium');
      expect(validation.securityNotes).toContain(
        'Missing security validation flag in JSON response',
      );
    });

    test('should include security metadata in transformation response', async () => {
      const input = 'Test input for transformation';
      const mockAIResponse = 'Safe AI generated response';

      // Mock the chain and AI response
      mockInvoke.mockResolvedValueOnce({
        content: mockAIResponse,
        response_metadata: { usage: { total_tokens: 100 } },
      });

      const result = await transformer.transform(input, 'summarize');

      expect(result.metadata.security).toBeDefined();
      expect(result.metadata.security.securityValidated).toBeDefined();
      expect(result.metadata.security.riskLevel).toBeDefined();
      expect(result.metadata.security.securityNotes).toEqual([]);
      expect(result.metadata.security.validationTimestamp).toBeDefined();
    });

    test('should log security warnings for high-risk AI responses', async () => {
      const input = 'Test input';
      const dangerousAIResponse = 'Response with <iframe src="malicious.com"></iframe> content';

      // Mock the chain and dangerous AI response
      mockInvoke.mockResolvedValueOnce({
        content: dangerousAIResponse,
        response_metadata: { usage: { total_tokens: 100 } },
      });

      // Mock logger to capture warnings
      const loggerSpy = jest.spyOn(transformer.logger, 'warn');

      await transformer.transform(input, 'summarize');

      expect(loggerSpy).toHaveBeenCalledWith(
        'AI response failed security validation',
        expect.objectContaining({
          riskLevel: 'high',
          securityNotes: expect.arrayContaining([
            'Dangerous or prohibited content detected in AI response',
          ]),
        }),
      );
    });
  });
});
