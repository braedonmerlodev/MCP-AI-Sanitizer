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
    expect(result.metadata).toBe(null);
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

    expect(result.metadata.cost).toBeCloseTo(0.000_0105, 6); // (14/1000)*0.00025 + (14/1000)*0.0005 for sanitized text lengths
    expect(result.metadata.tokens.prompt).toBe(100);
    expect(result.metadata.tokens.completion).toBe(50);
    expect(result.metadata.tokens.total).toBe(150);
  });

  test('should handle AI API timeout gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Request timeout'));

    const result = await transformer.transform('test input', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBe(null);
  });

  test('should handle network connectivity issues', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await transformer.transform('test input', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('sanitized text');
    expect(result.metadata).toBe(null);
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
        modelName: 'gemini-pro-vision',
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
});
