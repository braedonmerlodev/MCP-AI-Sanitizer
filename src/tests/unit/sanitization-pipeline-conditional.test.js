const SanitizationPipeline = require('../../components/sanitization-pipeline');

describe('SanitizationPipeline Conditional Logic', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new SanitizationPipeline();
  });

  test('should apply full sanitization for LLM-bound content', () => {
    const input = 'Hello\u200Bworld'; // Zero-width space
    const result = pipeline.sanitize(input, { classification: 'llm' });
    expect(result).toBe('Helloworld'); // Zero-width removed
  });

  test('should bypass sanitization for non-LLM content', () => {
    const input = 'Test data with homoglyphs: а';
    const result = pipeline.sanitize(input, { classification: 'non-llm' });
    // Expect no transformation
    expect(result).toBe(input);
  });

  test('should default to full sanitization for unclear classification', () => {
    const input = 'Hello\u200Bworld';
    const result = pipeline.sanitize(input, { classification: 'unclear' });
    expect(result).toBe('Helloworld');
  });

  test('should default to full sanitization when no options provided', () => {
    const input = 'Hello\u200Bworld';
    const result = pipeline.sanitize(input);
    expect(result).toBe('Helloworld');
  });

  test('should handle zero-width characters in LLM content', () => {
    const input = 'Hello\u200Bworld'; // Zero-width space
    const result = pipeline.sanitize(input, { classification: 'llm' });
    expect(result).toBe('Helloworld'); // Zero-width removed
  });

  test('should preserve zero-width characters in non-LLM content', () => {
    const input = 'Hello\u200Bworld';
    const result = pipeline.sanitize(input, { classification: 'non-llm' });
    expect(result).toBe('Hello\u200Bworld'); // Preserved
  });
});
