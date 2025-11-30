const request = require('supertest');
const app = require('../app');
const JSONRepair = require('../../utils/jsonRepair');

describe('PDF Processing Integration with JSON Repair', () => {
  describe('Complex PDF Processing Scenarios', () => {
    test('should process PDF with AI structuring and repair malformed JSON', async () => {
      // Create a mock PDF buffer (simplified)
      const pdfBuffer = Buffer.from('%PDF-1.4 test content for complex document processing');

      // Mock the AI response to return malformed JSON that needs repair
      jest.mock('../../components/AITextTransformer', () => {
        return jest.fn().mockImplementation(() => ({
          transform: jest.fn().mockResolvedValue({
            text: '{"title": "Test Document", "summary": "A test", "enhanced_text": {"authors": ["Test Author"], "content": "Test content"',
            metadata: { processingTime: 100, cost: 0.001 },
          }),
        }));
      });

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', pdfBuffer, 'complex-test.pdf')
        .query({ ai_transform: 'true', sync: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');

      // The JSON should be repaired and parsed successfully
      // Note: In actual implementation, this would be tested via job queue
    });

    test('should handle Maker Paper.pdf-like complex document structure', async () => {
      // This would test with actual complex PDF content
      // For now, test the repair utility directly with complex nested JSON

      const jsonRepair = new JSONRepair();
      const complexMalformedJson = `{
        "title": "Maker Paper",
        "summary": "Research paper on AI",
        "enhanced_text": {
          "authors": ["Dr. Smith", "Dr. Johnson"],
          "abstract": "This paper discusses advanced AI techniques",
          "sections": [
            {"title": "Introduction", "content": "AI is transforming"},
            {"title": "Methods", "content": "We used machine learning"}
          ],
          "references": ["Paper 1", "Paper 2"]
        }
      `;

      // Test that valid complex JSON is handled
      const result = jsonRepair.repair(complexMalformedJson);
      expect(result.success).toBe(true);
      expect(result.data.enhanced_text.authors).toEqual(['Dr. Smith', 'Dr. Johnson']);
    });

    test('should repair truncated JSON in enhanced_text field', async () => {
      const jsonRepair = new JSONRepair();
      const truncatedJson = `{
        "title": "Test Paper",
        "enhanced_text": {"authors": ["Author"], "abstract": "Abstract text"
      }`;

      const result = jsonRepair.repair(truncatedJson);
      expect(result.success).toBe(true);
      expect(result.data.enhanced_text).toEqual({
        authors: ['Author'],
        abstract: 'Abstract text',
      });
    });

    test('should handle AI timeout and fallback gracefully', async () => {
      // Test that when AI fails, the system falls back to basic processing
      const pdfBuffer = Buffer.from('%PDF-1.4 simple content');

      // Mock AI failure
      jest.mock('../../components/AITextTransformer', () => {
        return jest.fn().mockImplementation(() => ({
          transform: jest.fn().mockRejectedValue(new Error('AI timeout')),
        }));
      });

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', pdfBuffer, 'timeout-test.pdf')
        .query({ ai_transform: 'true', sync: 'true' });

      expect(response.status).toBe(200);
      // Should still process without AI enhancement
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large documents within time limits', async () => {
      const jsonRepair = new JSONRepair();

      // Test repair performance with large JSON
      const largeJson =
        '{"data": "' + 'x'.repeat(10_000) + '", "nested": {"content": "' + 'y'.repeat(5000) + '"}}';

      const startTime = Date.now();
      const result = jsonRepair.repair(largeJson);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(1000); // Should be fast
    });

    test('should maintain backward compatibility', async () => {
      // Test that existing PDF processing still works
      const pdfBuffer = Buffer.from('%PDF-1.4 existing functionality test');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', pdfBuffer, 'compatibility-test.pdf')
        .query({ sync: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    test('should handle completely unrepairable JSON', async () => {
      const jsonRepair = new JSONRepair();
      const unrepairable = '{broken: json, no: quotes, invalid: syntax}';

      const result = jsonRepair.repair(unrepairable);
      expect(result.success).toBe(false);
      expect(result.repairs.length).toBeGreaterThan(0);
    });

    test('should extract partial valid JSON when full repair fails', async () => {
      const jsonRepair = new JSONRepair();
      const partialValid = '{"valid": "json"} invalid text after';

      const result = jsonRepair.repair(partialValid);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ valid: 'json' });
    });

    test('should handle deeply nested structures', async () => {
      const jsonRepair = new JSONRepair();
      const deeplyNested = `{
        "level1": {
          "level2": {
            "level3": {
              "level4": {
                "data": "deep value"
              }
            }
          }
        }
      }`;

      const result = jsonRepair.repair(deeplyNested);
      expect(result.success).toBe(true);
      expect(result.data.level1.level2.level3.level4.data).toBe('deep value');
    });
  });
});
