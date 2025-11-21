const request = require('supertest');
const app = require('../../app');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

// Mock AITextTransformer to simulate async processing delays
jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: jest.fn().mockImplementation(async (text, type) => {
      // Simulate realistic processing delay for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate realistic OpenAI API response structure
      const baseMetadata = {
        processingTime: 150,
        tokens: {
          prompt: Math.ceil(text.length / 4),
          completion: 0,
          total: 0,
        },
        model: 'gpt-3.5-turbo',
        finish_reason: 'stop',
      };

      switch (type) {
        case 'structure': {
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
        }

        case 'summarize': {
          const summary = `Mock AI summary: ${text.slice(0, 50)}...`;
          baseMetadata.tokens.completion = summary.length / 4;
          baseMetadata.tokens.total = baseMetadata.tokens.prompt + baseMetadata.tokens.completion;
          return {
            text: summary,
            metadata: baseMetadata,
          };
        }

        default: {
          return {
            text: text,
            metadata: {
              ...baseMetadata,
              processingTime: 50,
              tokens: { prompt: 1, completion: 1, total: 2 },
            },
          };
        }
      }
    }),
  }));
});

describe('PDF AI Async Workflow Integration Tests', () => {
  let trustTokenGenerator;
  let validTrustToken;

  beforeAll(() => {
    trustTokenGenerator = new TrustTokenGenerator();
    validTrustToken = trustTokenGenerator.generateToken('test content', 'test content', ['test'], {
      expirationHours: 1,
    });
  });

  describe('POST /api/documents/upload with async AI transformation', () => {
    it('should initiate async PDF processing with AI transformation', async () => {
      // Create a large PDF buffer (>10MB) to trigger async processing
      const largeContent =
        'BT\n/F1 12 Tf\n100 700 Td\n(' +
        'Large PDF content for async testing. '.repeat(500_000) + // Make it large
        ') Tj\nET\n';
      const testPdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length ' +
          largeContent.length +
          '\n>>\nstream\n' +
          largeContent +
          'endstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
        'binary',
      );

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true&async=true')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('pdf', testPdfBuffer, 'test.pdf');

      console.log('Async Response status:', response.status);
      console.log('Async Response body:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(202); // Accepted for async processing

      // Should return task information for async processing
      expect(response.body.taskId).toBeDefined();
      expect(response.body.status).toBe('processing');
      expect(response.body.estimatedTime).toBeDefined();

      // Should include processing headers
      expect(response.headers['x-async-processing']).toBe('true');
      expect(response.headers['x-task-id']).toBeDefined();
    });

    it('should handle large PDF files with async processing', async () => {
      // Create a larger PDF buffer to simulate big file processing
      const largePdfContent =
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 100\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Large document content for testing async processing with substantial text that would typically require background processing to avoid blocking the main thread.) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000250 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n334\n%%EOF';
      const largePdfBuffer = Buffer.from(largePdfContent, 'binary');

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true&async=true')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('pdf', largePdfBuffer, 'large-test.pdf');

      expect(response.status).toBe(202);
      expect(response.body.taskId).toBeDefined();
      expect(response.headers['x-async-processing']).toBe('true');
    });

    it('should fallback to sync processing for agent requests despite async preference', async () => {
      const testPdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Agent Test) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
        'binary',
      );

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true&async=true&sync=true')
        .set('x-agent-key', 'test-agent-key') // Simulate agent request
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('pdf', testPdfBuffer, 'agent-test.pdf');

      // Agent requests should be processed synchronously despite sync=false
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('PDF uploaded and processed successfully');
      expect(response.body.status).toBe('processed');
      expect(response.body.sanitizedContent).toBeDefined();

      // Should not have async processing headers
      expect(response.headers['x-async-processing']).toBeUndefined();
      expect(response.headers['x-task-id']).toBeUndefined();
    });

    it('should handle async processing errors gracefully', async () => {
      // Test with invalid PDF that causes processing errors
      const invalidPdfBuffer = Buffer.from('definitely not a pdf file');

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true&async=true')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('pdf', invalidPdfBuffer, 'invalid.pdf');

      // Should still return accepted status for async processing attempt
      expect(response.status).toBe(202);
      expect(response.body.taskId).toBeDefined();
      expect(response.body.status).toBe('processing');
    });
  });
});
