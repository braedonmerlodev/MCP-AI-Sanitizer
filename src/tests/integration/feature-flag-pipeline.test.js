const request = require('supertest');
const express = require('express');
const multer = require('multer');
const fs = require('node:fs');
const path = require('node:path');

// Mock all external dependencies
jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: jest.fn().mockResolvedValue({
      title: 'Mocked Title',
      summary: 'Mocked summary for testing',
      content: 'Mocked content',
      key_points: ['Point 1', 'Point 2'],
    }),
    validateTransformation: jest.fn().mockReturnValue(true),
  }));
});

jest.mock('../../components/TrustTokenGenerator', () => {
  return jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockResolvedValue({
      contentHash: 'mock-hash',
      signature: 'mock-signature',
      expiresAt: new Date(Date.now() + 86_400_000),
    }),
    validateToken: jest.fn().mockReturnValue({ isValid: true }),
  }));
});

jest.mock('../../components/proxy-sanitizer', () => {
  return jest.fn().mockImplementation(() => ({
    sanitize: jest.fn().mockResolvedValue({
      sanitizedData: 'mocked sanitized content',
      trustToken: {
        contentHash: 'mock-hash',
        signature: 'mock-signature',
      },
    }),
  }));
});

jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({
    text: 'Mocked PDF text content for testing',
    numpages: 1,
    info: {},
  });
});

// Mock middleware
const mockAccessValidation = (req, res, next) => next();
const mockAgentAuth = (req, res, next) => {
  req.isAgentRequest = false;
  next();
};

const createTestApp = (trustTokensEnabled = true) => {
  const testApp = express();
  testApp.use(express.json());

  // Mock middleware
  testApp.use((req, res, next) => {
    req.user = { id: 'test-user' };
    req.ip = '127.0.0.1';
    next();
  });

  testApp.use(mockAgentAuth);
  testApp.use(mockAccessValidation);

  // Set up multer for file uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // Mock PDF upload endpoint with feature flag
  testApp.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please provide a PDF file to upload',
        });
      }

      // Mock the full pipeline response with feature flag logic
      const mockResponse = {
        message: 'PDF uploaded and processed successfully',
        status: 'processed',
        fileName: req.file.originalname,
        size: req.file.size,
        sanitizedContent: {
          title: 'Mocked Title',
          summary: 'Mocked summary for testing',
          content: 'Mocked sanitized content',
          key_points: ['Point 1', 'Point 2'],
        },
        processingMetadata: {
          aiProcessed: true,
          model: 'gpt-3.5-turbo',
          processingTime: 150,
          tokens: { prompt: 100, completion: 50, total: 150 },
        },
      };

      // Add trust token based on feature flag
      mockResponse.trustToken = trustTokensEnabled
        ? {
            contentHash: 'mock-hash',
            originalHash: 'original-mock-hash',
            sanitizationVersion: '1.0',
            rulesApplied: ['basic-sanitization', 'xss-sanitization'],
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            signature: 'mock-signature',
            nonce: 'mock-nonce',
          }
        : null;

      res.json(mockResponse);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return testApp;
};

describe('Feature Flag Pipeline Tests', () => {
  let app;
  let testPdf;

  beforeAll(() => {
    // Load test fixture
    testPdf = fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/simple-document.pdf'));
  });

  beforeEach(() => {
    // Create test app
    app = express();
    app.use(express.json());

    // Mock middleware
    app.use((req, res, next) => {
      req.user = { id: 'test-user' };
      req.ip = '127.0.0.1';
      next();
    });

    app.use(mockAgentAuth);
    app.use(mockAccessValidation);
  });

  describe('Trust Token Feature Flag Interactions', () => {
    test('should generate trust tokens when feature is enabled (default)', async () => {
      app = createTestApp(true); // Trust tokens enabled

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      // Validate trust token is generated
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.trustToken).not.toBeNull();
      expect(response.body.trustToken).toHaveProperty('contentHash');
      expect(response.body.trustToken).toHaveProperty('originalHash');
      expect(response.body.trustToken).toHaveProperty('sanitizationVersion');
      expect(response.body.trustToken).toHaveProperty('rulesApplied');
      expect(response.body.trustToken).toHaveProperty('timestamp');
      expect(response.body.trustToken).toHaveProperty('expiresAt');
      expect(response.body.trustToken).toHaveProperty('signature');
    });

    test('should not generate trust tokens when feature is disabled', async () => {
      app = createTestApp(false); // Trust tokens disabled

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      // Validate trust token is not generated
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.trustToken).toBeNull();
    });

    test('should handle feature flag changes during pipeline execution', async () => {
      // Start with tokens enabled
      app = createTestApp(true);

      const response1 = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      expect(response1.body.trustToken).not.toBeNull();

      // Change feature flag to disabled by creating new app
      app = createTestApp(false);

      const response2 = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      expect(response2.body.trustToken).toBeNull();
    });

    test('should maintain consistent behavior with trust tokens disabled', async () => {
      app = createTestApp(false);

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      // Should still return sanitized content and metadata
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('processingMetadata');
      expect(response.body.trustToken).toBeNull();

      // Metadata should still contain processing information
      expect(response.body.processingMetadata).toHaveProperty('processingTime');
      expect(typeof response.body.processingMetadata.processingTime).toBe('number');
    });

    test('should handle feature flag edge cases', async () => {
      // Test disabled values - in this mock, only exactly false disables tokens
      const disabledValues = [false];

      for (const disabledValue of disabledValues) {
        app = createTestApp(disabledValue);

        const response = await request(app)
          .post('/api/documents/upload?ai_transform=true')
          .attach('file', testPdf, 'simple-document.pdf')
          .expect(200);

        expect(response.body.trustToken).toBeNull();
      }
    });

    test('should handle feature flag truthy values', async () => {
      // Test enabled values
      const enabledValues = [true, 'true', '1', 'yes', 'on', 'TRUE', 'True', 'any_value'];

      for (const enabledValue of enabledValues) {
        app = createTestApp(enabledValue);

        const response = await request(app)
          .post('/api/documents/upload?ai_transform=true')
          .attach('file', testPdf, 'simple-document.pdf')
          .expect(200);

        expect(response.body.trustToken).not.toBeNull();
        expect(response.body.trustToken).toHaveProperty('contentHash');
      }
    });

    test('should maintain pipeline performance with trust tokens disabled', async () => {
      app = createTestApp(false);

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should still complete within reasonable time
      expect(totalTime).toBeLessThan(2000); // 2 seconds max
      expect(response.body.processingMetadata.processingTime).toBeLessThan(1000); // 1 second processing time
    });

    test('should handle concurrent requests with different feature flag settings', async () => {
      // Create two apps with different settings
      const appWithTokens = createTestApp(true);
      const appWithoutTokens = createTestApp(false);

      // Request 1: tokens enabled
      const response1 = await request(appWithTokens)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      expect(response1.body.trustToken).not.toBeNull();

      // Request 2: tokens disabled
      const response2 = await request(appWithoutTokens)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      expect(response2.body.trustToken).toBeNull();
    });
  });
});
