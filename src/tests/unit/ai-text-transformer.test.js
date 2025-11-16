const AITextTransformer = require('../../components/AITextTransformer');

jest.mock('@langchain/openai');
jest.mock('langchain/prompts');
jest.mock('../../components/sanitization-pipeline');

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
    require('langchain/prompts').PromptTemplate = MockPromptTemplate;

    // Mock ChatOpenAI
    mockOpenAI = {};
    const MockChatOpenAI = jest.fn().mockImplementation(() => mockOpenAI);
    require('@langchain/openai').ChatOpenAI = MockChatOpenAI;

    transformer = new AITextTransformer();
  });

  test('should create AITextTransformer instance', () => {
    expect(transformer).toBeDefined();
    expect(transformer.openai).toBeDefined();
    expect(transformer.sanitizer).toBeDefined();
    expect(transformer.prompts).toBeDefined();
  });

  test('should transform text with structure type successfully', async () => {
    const result = await transformer.transform('raw text', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith('raw text', {});
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith('AI output', {});
    expect(result).toBe('sanitized text');
  });

  test('should transform text with summarize type', async () => {
    const result = await transformer.transform('raw text', 'summarize');

    expect(result).toBe('sanitized text');
  });

  test('should transform text with extract_entities type', async () => {
    const result = await transformer.transform('raw text', 'extract_entities');

    expect(result).toBe('sanitized text');
  });

  test('should transform text with json_schema type', async () => {
    const result = await transformer.transform('raw text', 'json_schema');

    expect(result).toBe('sanitized text');
  });

  test('should throw error for unknown transformation type', async () => {
    await expect(transformer.transform('raw text', 'unknown')).rejects.toThrow(
      'Unknown transformation type: unknown',
    );
  });

  test('should fallback to sanitized input on AI error', async () => {
    mockOpenAI.invoke = jest.fn().mockRejectedValue(new Error('API error'));

    const result = await transformer.transform('raw text', 'structure');

    expect(mockSanitizer.sanitize).toHaveBeenCalledTimes(2);
    expect(result).toBe('sanitized text');
  });

  test('should pass options to sanitizer', async () => {
    const options = { sanitizerOptions: { riskLevel: 'high' } };

    await transformer.transform('raw text', 'structure', options);

    expect(mockSanitizer.sanitize).toHaveBeenCalledWith('raw text', { riskLevel: 'high' });
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith('AI output', { riskLevel: 'high' });
  });
});
