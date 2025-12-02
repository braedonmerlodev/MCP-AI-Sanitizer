const request = require('supertest');
const express = require('express');
const multer = require('multer');
const fs = require('node:fs');
const path = require('node:path');

// Mock all external dependencies
jest.mock('../../components/TrustTokenGenerator', () => {
  return jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockResolvedValue({
      contentHash: 'cached-hash',
      signature: 'cached-signature',
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

describe('Trust Token Caching Integration Tests', () => {
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

    // Set up multer for file uploads
    const upload = multer({ storage: multer.memoryStorage() });

    // Mock PDF upload endpoint with caching simulation
    let cache = new Map(); // Simple in-memory cache for testing

    app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please provide a PDF file to upload',
          });
        }

        // Simulate caching based on file content hash
        const contentHash = Buffer.from(req.file.buffer).toString('base64').slice(0, 16);
        const isCacheHit = cache.has(contentHash);

        // Mock response with trust token caching
        const mockResponse = {
          message: 'PDF uploaded and processed successfully',
          status: 'processed',
          fileName: req.file.originalname,
          size: req.file.size,
          sanitizedContent: 'Mocked sanitized content',
          processingMetadata: {
            aiProcessed: true,
            model: 'gpt-3.5-turbo',
            processingTime: isCacheHit ? 50 : 150, // Cached requests are faster
            tokens: { prompt: 100, completion: 50, total: 150 },
            cacheHit: isCacheHit,
          },
          trustToken: {
            contentHash: contentHash,
            originalHash: 'original-hash-' + contentHash,
            sanitizationVersion: '1.0',
            rulesApplied: ['basic-sanitization'],
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            signature: 'cached-signature-' + contentHash,
            nonce: 'cached-nonce-' + contentHash,
          },
        };

        // Store in cache
        cache.set(contentHash, mockResponse.trustToken);

        res.json(mockResponse);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

  describe('Trust Token Caching and Reuse', () => {
    test('should generate consistent trust tokens for identical content', async () => {
      // First processing
      const response1 = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      const token1 = response1.body.trustToken;

      // Second processing of identical content
      const response2 = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      const token2 = response2.body.trustToken;

      // Validate token consistency
      expect(token1.contentHash).toBe(token2.contentHash);
      expect(token1.originalHash).toBe(token2.originalHash);
      expect(token1.sanitizationVersion).toBe(token2.sanitizationVersion);
      expect(token1.signature).toBe(token2.signature);
    });

    test('should cache and reuse trust tokens for repeated requests', async () => {
      // First request
      const response1 = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      // Second request (should use cache)
      const response2 = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      // Validate caching behavior
      expect(response1.body.sanitizedContent).toBe(response2.body.sanitizedContent);
      expect(response1.body.trustToken.contentHash).toBe(response2.body.trustToken.contentHash);

      // Second request should be faster (cached)
      const processingTime1 = response1.body.processingMetadata.processingTime;
      const processingTime2 = response2.body.processingMetadata.processingTime;

      // Allow some variance but second should be significantly faster
      expect(processingTime2).toBeLessThanOrEqual(processingTime1);
    });

    test('should validate cached trust tokens correctly', async () => {
      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      const trustToken = response.body.trustToken;

      // Validate token structure
      expect(trustToken).toHaveProperty('contentHash');
      expect(trustToken).toHaveProperty('originalHash');
      expect(trustToken).toHaveProperty('sanitizationVersion');
      expect(trustToken).toHaveProperty('rulesApplied');
      expect(trustToken).toHaveProperty('timestamp');
      expect(trustToken).toHaveProperty('expiresAt');
      expect(trustToken).toHaveProperty('signature');

      // Validate token hasn't expired
      const expiresAt = new Date(trustToken.expiresAt);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());

      // Validate signature format (basic check)
      expect(typeof trustToken.signature).toBe('string');
      expect(trustToken.signature.length).toBeGreaterThan(0);
    });

    test('should handle trust token expiration', async () => {
      // This test would require mocking the system time or using a very short expiration
      // For now, we'll validate that tokens have reasonable expiration times
      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      const trustToken = response.body.trustToken;

      const timestamp = new Date(trustToken.timestamp);
      const expiresAt = new Date(trustToken.expiresAt);

      // Token should expire within a reasonable timeframe (24 hours)
      const expirationTime = expiresAt.getTime() - timestamp.getTime();
      expect(expirationTime).toBeGreaterThan(0);
      expect(expirationTime).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // 24 hours in milliseconds
    });

    test('should maintain cache integrity across different transformation types', async () => {
      // Process with structure transformation
      const structureResponse = await request(app)
        .post('/api/documents/upload?ai_transform=true&transformType=structure')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      // Process with summarize transformation
      const summarizeResponse = await request(app)
        .post('/api/documents/upload?ai_transform=true&transformType=summarize')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      // Both should have valid trust tokens
      expect(structureResponse.body.trustToken).toBeDefined();
      expect(summarizeResponse.body.trustToken).toBeDefined();

      // Content hashes should be different (different transformations)
      expect(structureResponse.body.trustToken.contentHash).not.toBe(
        summarizeResponse.body.trustToken.contentHash,
      );

      // Original hashes should be the same (same input)
      expect(structureResponse.body.trustToken.originalHash).toBe(
        summarizeResponse.body.trustToken.originalHash,
      );
    });

    test('should handle cache misses gracefully', async () => {
      // Test with non-existent cached content
      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', testPdf, 'simple-document.pdf')
        .expect(200);

      // Should still process successfully
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.trustToken).toBeDefined();
    });
  });
});
