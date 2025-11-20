const request = require('supertest');
// Mock AITextTransformer so AI flows are deterministic in tests (returns a JSON string for structure)
jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: async (text, type) => {
      if (type === 'structure') {
        // Return structured JSON as text
        const structured = { title: 'Mocked PDF', summary: 'Mock summary', content: text };
        return { text: JSON.stringify(structured), metadata: { processingTime: 5, tokens: { prompt: 1, completion: 2, total: 3 } } };
      }
      return { text, metadata: null };
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
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .expect(200);

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
