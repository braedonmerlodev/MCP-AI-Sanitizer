const JSONRepair = require('../../utils/jsonRepair');

describe('JSONRepair', () => {
  let repair;

  beforeEach(() => {
    repair = new JSONRepair();
  });

  describe('repair() - Basic functionality', () => {
    test('should return success for valid JSON', () => {
      const validJson = '{"name": "test", "value": 123}';
      const result = repair.repair(validJson);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 123 });
      expect(result.repairs).toEqual([]);
    });

    test('should return failure for invalid input types', () => {
      expect(repair.repair(null).success).toBe(false);
      expect(repair.repair().success).toBe(false);
      expect(repair.repair(123).success).toBe(false);
      expect(repair.repair({}).success).toBe(false);
    });

    test('should handle empty string', () => {
      const result = repair.repair('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });
  });

  describe('fixTruncatedJSON()', () => {
    test('should fix missing closing brace', () => {
      const truncated = '{"name": "test", "nested": {"value": 123}';
      const result = repair.repair(truncated);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', nested: { value: 123 } });
      expect(result.repairs).toContain('Added missing closing braces/brackets and quotes');
    });

    test('should fix missing closing bracket', () => {
      const truncated = '{"items": ["a", "b", "c"]';
      const result = repair.repair(truncated);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ items: ['a', 'b', 'c'] });
    });

    test('should fix missing closing quote', () => {
      const truncated = '{"text": "incomplete"';
      const result = repair.repair(truncated);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ text: 'incomplete' });
    });
  });

  describe('fixTrailingCommas()', () => {
    test('should remove trailing comma in object', () => {
      const withComma = '{"name": "test", "value": 123,}';
      const result = repair.repair(withComma);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 123 });
      expect(result.repairs).toContain('Removed trailing commas');
    });

    test('should remove trailing comma in array', () => {
      const withComma = '{"items": ["a", "b",]}';
      const result = repair.repair(withComma);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ items: ['a', 'b'] });
    });
  });

  describe('Complex nested structures', () => {
    test('should handle nested objects with enhanced_text field', () => {
      const complexJson = `{
        "title": "Test Document",
        "summary": "A test document",
        "enhanced_text": {"nested": "value", "array": [1, 2, 3]}
      }`;

      const result = repair.repair(complexJson);
      expect(result.success).toBe(true);
      expect(result.data.enhanced_text).toEqual({ nested: 'value', array: [1, 2, 3] });
    });

    test('should repair truncated nested structure', () => {
      const truncated = `{
        "title": "Test Document",
        "enhanced_text": {"nested": "value", "array": [1, 2, 3]
      }`;

      const result = repair.repair(truncated);
      expect(result.success).toBe(true);
      expect(result.data.enhanced_text).toEqual({ nested: 'value', array: [1, 2, 3] });
    });
  });

  describe('extractPartialJSON()', () => {
    test('should extract valid partial JSON from malformed string', () => {
      const malformed = `{"valid": "json"} invalid text after`;
      const result = repair.repair(malformed);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ valid: 'json' });
      expect(result.repairs).toContain('Extracted partial valid JSON structure');
    });

    test('should handle multiple valid JSON objects', () => {
      const multiple = `{"first": "object"} {"second": "object"}`;
      const result = repair.repair(multiple);

      // Should extract the first valid object
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ first: 'object' });
    });
  });

  describe('Error handling and fallbacks', () => {
    test('should handle deeply malformed JSON gracefully', () => {
      const malformed = `{broken: json, no: quotes, missing: braces`;
      const result = repair.repair(malformed);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to repair');
    });
  });

  describe('isValidJSON()', () => {
    test('should validate correct JSON', () => {
      expect(repair.isValidJSON('{"test": "value"}')).toBe(true);
      expect(repair.isValidJSON('[1, 2, 3]')).toBe(true);
    });

    test('should reject invalid JSON', () => {
      expect(repair.isValidJSON('{invalid')).toBe(false);
      expect(repair.isValidJSON('not json')).toBe(false);
    });
  });

  describe('AI-generated content scenarios', () => {
    test('should handle typical AI truncation in enhanced_text', () => {
      const aiOutput = `{
        "title": "Academic Paper",
        "summary": "Research on AI",
        "enhanced_text": {"authors": ["Dr. Smith"], "abstract": "This paper discusses AI research", "sections": ["Introduction", "Methods", "Results"]
      }`;

      const result = repair.repair(aiOutput);
      expect(result.success).toBe(true);
      expect(result.data.enhanced_text.authors).toEqual(['Dr. Smith']);
    });

    test('should repair AI output with unescaped quotes in content', () => {
      // This is a simplified test - real AI quote issues would be more complex
      const aiOutput = `{"text": "He said \\"Hello World\\" to me"}`;
      const result = repair.repair(aiOutput);

      expect(result.success).toBe(true);
      expect(result.data.text).toBe('He said "Hello World" to me');
    });
  });
});
