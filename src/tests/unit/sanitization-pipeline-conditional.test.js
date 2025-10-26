const SanitizationPipeline = require('../../components/sanitization-pipeline');

describe('SanitizationPipeline Conditional Logic', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new SanitizationPipeline({
      enableValidation: false, // Disable for unit tests
    });
  });

  test('should apply full sanitization for LLM-bound content', async () => {
    const input = 'Hello\u200Bworld'; // Zero-width space
    const result = await pipeline.sanitize(input, { classification: 'llm' });
    expect(typeof result).toBe('string');
    expect(result).toBe('Helloworld'); // Zero-width removed
  });

  test('should bypass sanitization for non-LLM content', async () => {
    const input = 'Test data with homoglyphs: а';
    const result = await pipeline.sanitize(input, { classification: 'non-llm' });
    // Expect no transformation
    expect(result).toBe(input);
  });

  test('should default to full sanitization for unclear classification', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input, { classification: 'unclear' });
    expect(result).toBe('Helloworld');
  });

  test('should default to full sanitization when no options provided', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input);
    expect(result).toBe('Helloworld');
  });

  test('should handle zero-width characters in LLM content', async () => {
    const input = 'Hello\u200Bworld'; // Zero-width space
    const result = await pipeline.sanitize(input, { classification: 'llm' });
    expect(result).toBe('Helloworld'); // Zero-width removed
  });

  test('should preserve zero-width characters in non-LLM content', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input, { classification: 'non-llm' });
    expect(result).toBe('Hello\u200Bworld'); // Preserved
  });
});
