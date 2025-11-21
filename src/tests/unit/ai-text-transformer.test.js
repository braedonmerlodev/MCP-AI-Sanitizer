const mockInvoke = jest.fn().mockResolvedValue({ content: 'AI output', response_metadata: {} });

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn(),
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
  openai: {
    apiKey: 'mock-api-key',
    isValid: true,
  },
}));

const AITextTransformer = require('../../components/AITextTransformer');

describe('AITextTransformer', () => {
  let transformer;
  let mockSanitizer;
  let mockOpenAI;

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

    // Mock ChatOpenAI
    mockOpenAI = {};
    const MockChatOpenAI = require('@langchain/openai').ChatOpenAI;
    MockChatOpenAI.mockImplementation(() => mockOpenAI);

    transformer = new AITextTransformer();
  });

  test('should create AITextTransformer instance', () => {
    expect(transformer).toBeDefined();
    expect(transformer.openai).toBeDefined();
    expect(transformer.sanitizer).toBeDefined();
    expect(transformer.prompts).toBeDefined();
    expect(require('@langchain/openai').ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        openAIApiKey: 'mock-api-key',
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
});
