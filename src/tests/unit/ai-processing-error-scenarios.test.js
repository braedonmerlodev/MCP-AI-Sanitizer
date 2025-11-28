// Mock winston FIRST to prevent real logging
jest.mock("winston", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
  })),
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
  format: {
    json: jest.fn(),
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
}));

const mockTransform = jest.fn();
// Mock AITextTransformer FIRST before any other requires

jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: mockTransform,
  }));
});

// Mock AITextTransformer FIRST before any other requires

jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: mockTransform,
  }));
});

// Mock environment variables
process.env.TRUST_TOKEN_SECRET = 'test-secret-key-for-ai-errors';
process.env.ADMIN_AUTH_SECRET = 'test-admin-secret';

// Mock multer for file uploads
const multerSingleHandler = (req, res, next) => next();

jest.mock('multer', () => {
  const multerMock = jest.fn(() => ({
    single: jest.fn(() => multerSingleHandler),
  }));
  multerMock.diskStorage = jest.fn();
  multerMock.memoryStorage = jest.fn();
  return multerMock;
});

// Mock pdf-parse
jest.mock('pdf-parse', () =>
  jest.fn().mockResolvedValue({
    text: 'Mock PDF text for AI error testing',
    numpages: 1,
    info: { Title: 'Test PDF' },
  }),
);

// Mock TrustTokenGenerator
jest.mock('../../components/TrustTokenGenerator', () => {
  return jest.fn().mockImplementation(() => ({
    generateToken: jest.fn((sanitized, original, rules) => ({
      contentHash: 'mock-hash',
      originalHash: 'mock-original-hash',
      sanitizationVersion: '1.0',
      rulesApplied: rules || [],
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      signature: 'mock-signature',
    })),
    validateToken: jest.fn((token) => {
      if (token === 'invalid') return { isValid: false, error: 'Invalid token' };
      if (token === 'expired') return { isValid: false, error: 'Token has expired' };
      return { isValid: true };
    }),
  }));
});

// Mock queueManager for async tests
jest.mock('../../utils/queueManager', () => ({
  addJob: jest.fn().mockResolvedValue('mock-task-id'),
}));

// Mock winston logger to prevent real logging operations
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
  format: {colorize: jest.fn(),
    simple: jest.fn(),
    
    json: jest.fn(),
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
  },
}));

// Mock database operations
jest.mock('better-queue', () =>
  jest.fn(() => ({
    push: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  })),
);

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

describe('AI Processing Error Scenarios and Fallback Behavior', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    // Reset mock for each test
    mockTransform.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Ensure any pending async operations are resolved
    return new Promise((resolve) => setImmediate(resolve));
  });

  describe('POST /api/sanitize/json - AI Transformation Failures', () => {
    test('should handle AI API network failure gracefully', async () => {
      mockTransform.mockRejectedValueOnce(new Error('ECONNREFUSED: Connection refused'));

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'data' }),
          ai_transform: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.sanitizedContent).toBeDefined();
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toBe('ECONNREFUSED: Connection refused');
      expect(mockTransform).toHaveBeenCalledWith(
        JSON.stringify({ test: 'data' }),
        'structure',
        expect.objectContaining({
          sanitizerOptions: expect.objectContaining({
            classification: 'llm',
          }),
        }),
      );
    });

    test('should handle AI API timeout gracefully', async () => {
      mockTransform.mockRejectedValueOnce(new Error('Request timeout after 30000ms'));

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'data' }),
          ai_transform: true,
          ai_transform_type: 'summarize',
        });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toContain('timeout');
      expect(mockTransform).toHaveBeenCalledWith(
        JSON.stringify({ test: 'data' }),
        'summarize',
        expect.any(Object),
      );
    });

    test('should handle invalid AI transformation type', async () => {
      mockTransform.mockRejectedValueOnce(new Error('Unknown transformation type: invalid_type'));

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'data' }),
          ai_transform: true,
          ai_transform_type: 'invalid_type',
        });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toContain('Unknown transformation type');
    });

    test('should handle AI model unavailability', async () => {
      mockTransform.mockRejectedValueOnce(new Error('The model `gpt-4` does not exist'));

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'data' }),
          ai_transform: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toContain('does not exist');
    });

    test('should handle AI rate limit exceeded', async () => {
      mockTransform.mockRejectedValueOnce(
        new Error('Rate limit exceeded. Try again in 60 seconds.'),
      );

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'data' }),
          ai_transform: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toContain('Rate limit exceeded');
    });

    test('should handle invalid AI API key', async () => {
      mockTransform.mockRejectedValueOnce(new Error('Authentication failed: Invalid API key'));

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'data' }),
          ai_transform: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toContain('Invalid API key');
    });

    test('should handle AI processing with invalid input format', async () => {
      // AI might fail on malformed input even after sanitization
      mockTransform.mockRejectedValueOnce(new Error('Invalid input format for AI processing'));

      const response = await request(app).post('/api/sanitize/json').send({
        content: 'not json {{{', // Invalid JSON that might cause AI issues
        ai_transform: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toContain('Invalid input format');
    });

    test('should successfully process when AI succeeds', async () => {
      mockTransform.mockResolvedValueOnce({
        text: '{"ai_processed": "content"}',
        metadata: { processingTime: 100, cost: 0.01 },
      });

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'data' }),
          ai_transform: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(true);
      expect(response.body.metadata.aiProcessing.aiTransformType).toBe('structure');
      expect(response.body.sanitizedContent).toContain('ai_processed');
    });
  });

  describe('POST /api/documents/upload - AI Processing Failures', () => {
    test('should fallback to sanitization when AI transformation fails', async () => {
      mockTransform.mockRejectedValueOnce(new Error('AI processing failed'));

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        );

      expect(response.status).toBe(200);
      expect(response.body.processingMetadata.transformationType).toBe('fallback_sanitization');
      expect(response.body.processingMetadata.aiProcessed).toBe(false);
      expect(response.body.processingMetadata.aiError).toBe('AI processing failed');
      expect(response.body.sanitizedContent).toBeDefined();
      expect(response.body.trustToken).toBeDefined();
    });

    test('should handle AI timeout in PDF upload', async () => {
      mockTransform.mockRejectedValueOnce(new Error('AI request timed out'));

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        );

      expect(response.status).toBe(200);
      expect(response.body.processingMetadata.aiProcessed).toBe(false);
      expect(response.body.processingMetadata.aiError).toBe('AI request timed out');
    });

    test('should successfully process PDF with AI when AI succeeds', async () => {
      mockTransform.mockResolvedValueOnce({
        text: '{"structured": "pdf content"}',
        metadata: { processingTime: 200, cost: 0.02 },
      });

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach(
          'pdf',
          Buffer.from(
            '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
          ),
          'test.pdf',
        );

      expect(response.status).toBe(200);
      expect(response.body.processingMetadata.transformationType).toBe('ai_structure');
      expect(response.body.processingMetadata.aiProcessed).toBe(true);
      expect(response.body.sanitizedContent).toBe('{"structured": "pdf content"}');
    });
  });

  describe('Processing Timeout Handling', () => {
    test('should handle slow AI responses (simulate timeout)', async () => {
      // Mock a delayed rejection to simulate timeout
      mockTransform.mockImplementationOnce(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
      );

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'data' }),
          ai_transform: true,
        });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000); // Should not take too long due to fallback
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
    });
  });

  describe('Invalid Input Format Handling', () => {
    test('should handle non-JSON input for AI processing', async () => {
      mockTransform.mockRejectedValueOnce(new Error('AI cannot process non-structured text'));

      const response = await request(app).post('/api/sanitize/json').send({
        content: 'This is plain text, not JSON',
        ai_transform: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toContain('non-structured text');
    });

    test('should handle malformed JSON that causes AI parsing issues', async () => {
      mockTransform.mockRejectedValueOnce(new Error('JSON parsing failed in AI pipeline'));

      const response = await request(app).post('/api/sanitize/json').send({
        content: '{"incomplete": "json"', // Missing closing brace
        ai_transform: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.metadata.aiProcessing.aiProcessed).toBe(false);
      expect(response.body.metadata.aiProcessing.aiError).toContain('JSON parsing failed');
    });
  });
});
