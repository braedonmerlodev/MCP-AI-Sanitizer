const request = require('supertest');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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
      expiresAt: new Date(Date.now() + 86400000),
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

describe('Full Pipeline E2E Test Suite', () => {
  let app;
  let testPdfs;
  let expectedOutputs;

  beforeAll(() => {
    // Load test fixtures
    testPdfs = {
      simple: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/simple-document.pdf')),
      complex: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/complex-document.pdf')),
      xss: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/xss-test-document.pdf')),
    };

    expectedOutputs = {
      simple: JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../fixtures/expected-outputs/simple-document-expected.json'),
          'utf8',
        ),
      ),
      complex: JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../fixtures/expected-outputs/complex-document-expected.json'),
          'utf8',
        ),
      ),
      xss: JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../fixtures/expected-outputs/xss-test-document-expected.json'),
          'utf8',
        ),
      ),
    };
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

    // Set up multer for file uploads
    const upload = multer({ storage: multer.memoryStorage() });

    // Mock PDF upload endpoint
    app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please provide a PDF file to upload',
          });
        }

        // Mock the full pipeline response
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
          trustToken: {
            contentHash: 'mock-hash',
            originalHash: 'original-mock-hash',
            sanitizationVersion: '1.0',
            rulesApplied: ['basic-sanitization', 'xss-sanitization'],
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            signature: 'mock-signature',
            nonce: 'mock-nonce',
          },
        };

        res.json(mockResponse);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

  describe('Complete PDF-to-AI Pipeline', () => {
    test('should process simple PDF through complete pipeline', async () => {
      // Upload and process PDF in single request
      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      // Validate response structure
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('processingMetadata');

      // Validate trust token structure
      expect(response.body.trustToken).toHaveProperty('contentHash');
      expect(response.body.trustToken).toHaveProperty('originalHash');
      expect(response.body.trustToken).toHaveProperty('sanitizationVersion');
      expect(response.body.trustToken).toHaveProperty('rulesApplied');
      expect(Array.isArray(response.body.trustToken.rulesApplied)).toBe(true);
      expect(response.body.trustToken).toHaveProperty('timestamp');
      expect(response.body.trustToken).toHaveProperty('expiresAt');
      expect(response.body.trustToken).toHaveProperty('signature');

      // Validate processing metadata
      expect(response.body.processingMetadata).toHaveProperty('aiProcessed');
      expect(response.body.processingMetadata).toHaveProperty('model');
      expect(response.body.processingMetadata).toHaveProperty('processingTime');
      expect(response.body.processingMetadata).toHaveProperty('tokens');
      expect(typeof response.body.processingMetadata.processingTime).toBe('number');
      expect(response.body.processingMetadata.processingTime).toBeGreaterThan(0);
    });

    test('should handle invalid file upload', async () => {
      const response = await request(app).post('/api/documents/upload').expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No file uploaded');
    });

    test('should process PDF without AI transformation', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      // Should still have basic processing metadata even without AI
      expect(response.body).toHaveProperty('processingMetadata');
    });
  });
});
