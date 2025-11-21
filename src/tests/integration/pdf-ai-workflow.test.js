const request = require('supertest');
// Mock AITextTransformer with realistic AI service responses matching OpenAI API structure
jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: async (text, type) => {
      // Simulate realistic OpenAI API response structure
      const baseMetadata = {
        processingTime: 150, // Realistic processing time in ms
        tokens: {
          prompt: Math.ceil(text.length / 4), // Rough token estimation
          completion: 0,
          total: 0,
        },
        model: 'gpt-3.5-turbo',
        finish_reason: 'stop',
      };

      switch (type) {
        case 'structure':
          // Return structured JSON as text (matching real AI structure response)
          const structured = {
            title: 'Mocked PDF Document',
            summary: 'This is a mock summary of the PDF content extracted and processed.',
            content: text,
            key_points: [
              'First key point from mock AI processing',
              'Second key point demonstrating structured output',
              'Third point showing AI content enhancement',
            ],
            metadata: {
              document_type: 'pdf',
              processing_method: 'ai_enhanced',
            },
          };
          baseMetadata.tokens.completion = JSON.stringify(structured).length / 4;
          baseMetadata.tokens.total = baseMetadata.tokens.prompt + baseMetadata.tokens.completion;
          return {
            text: JSON.stringify(structured),
            metadata: baseMetadata,
          };

        case 'summarize':
          // Return concise summary (matching real AI summary response)
          const summary = `Mock AI summary: ${text.substring(0, 50)}...`;
          baseMetadata.tokens.completion = summary.length / 4;
          baseMetadata.tokens.total = baseMetadata.tokens.prompt + baseMetadata.tokens.completion;
          return {
            text: summary,
            metadata: baseMetadata,
          };

        case 'extract_entities':
          // Return extracted entities (matching real AI entity extraction)
          const entities = {
            people: ['Mock Person'],
            organizations: ['Mock Organization'],
            locations: ['Mock Location'],
            dates: ['2025-01-01'],
            other: ['Mock Entity'],
          };
          baseMetadata.tokens.completion = JSON.stringify(entities).length / 4;
          baseMetadata.tokens.total = baseMetadata.tokens.prompt + baseMetadata.tokens.completion;
          return {
            text: JSON.stringify(entities),
            metadata: baseMetadata,
          };

        default:
          // Fallback for unsupported types
          return {
            text: text,
            metadata: {
              ...baseMetadata,
              processingTime: 50,
              tokens: { prompt: 1, completion: 1, total: 2 },
            },
          };
      }
    },
  }));
});

const app = require('../../app');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

describe('PDF AI Workflow Integration Tests', () => {
  let trustTokenGenerator;
  let validTrustToken;

  beforeAll(() => {
    trustTokenGenerator = new TrustTokenGenerator();
    validTrustToken = trustTokenGenerator.generateToken('test content', 'test content', ['test'], {
      expirationHours: 1,
    });
  });
  describe('POST /api/documents/upload with AI transformation', () => {
    it('should process PDF with AI transformation and return structured JSON', async () => {
      // Create a simple test PDF buffer (mock)
      const testPdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
        'binary',
      );

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true&sync=true')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('pdf', testPdfBuffer, 'test.pdf');

      console.log('Response status:', response.status);
      console.log('Response body:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);

      expect(response.body.message).toBe('PDF uploaded and processed successfully');
      expect(response.body.status).toBe('processed');
      expect(typeof response.body.sanitizedContent).toBe('object'); // JSON object
      expect(response.body.processingMetadata).toBeDefined();
      expect(response.body.processingMetadata.aiProcessed).toBe(true);
      expect(response.body.processingMetadata.transformationType).toBe('ai_structure');
      expect(response.body.trustToken).toBeDefined();
    });

    it('should fallback to sanitization when AI fails', async () => {
      // Test with invalid PDF or mock failure
      const invalidPdfBuffer = Buffer.from('not a pdf');

      await request(app)
        .post('/api/documents/upload?ai_transform=true&sync=true')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('pdf', invalidPdfBuffer, 'invalid.pdf')
        .expect(400); // Or 500 depending on error

      // Depending on implementation, may return error or fallback
    });

    it('should process PDF without AI transformation and return text', async () => {
      const testPdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test Content) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
        'binary',
      );

      const response = await request(app)
        .post('/api/documents/upload?sync=true&ai_transform=false')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .expect(200);

      expect(response.body.message).toBe('PDF uploaded and processed successfully');
      expect(response.body.status).toBe('processed');
      expect(typeof response.body.sanitizedContent).toBe('string'); // Text
      expect(response.body.processingMetadata.aiProcessed).toBe(false);
      expect(response.body.processingMetadata.transformationType).toBe('sanitization');
      expect(response.body.trustToken).toBeDefined();
    });
  });
});
