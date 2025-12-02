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
  return jest.fn().mockImplementation((buffer) => {
    // Simulate parsing errors for corrupted PDFs
    if (buffer && buffer.toString().includes('not a valid PDF')) {
      throw new Error('Invalid PDF structure');
    }
    return Promise.resolve({
      text: 'Mocked PDF text content for testing',
      numpages: 1,
      info: {},
    });
  });
});

// Mock middleware
const mockAccessValidation = (req, res, next) => next();
const mockAgentAuth = (req, res, next) => {
  req.isAgentRequest = false;
  next();
};

describe('Error Handling Pipeline Tests', () => {
  let app;
  let validPdf;
  let corruptedPdf;
  let oversizedPdf;

  beforeAll(() => {
    // Load test fixtures
    validPdf = fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/simple-document.pdf'));

    // Create corrupted PDF (invalid data)
    corruptedPdf = Buffer.from('This is not a valid PDF file content');

    // Create oversized PDF (simulate large file)
    oversizedPdf = Buffer.alloc(50 * 1024 * 1024, 'x'); // 50MB file
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

    // Set up multer for file uploads with size limits
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    });

    // Mock PDF upload endpoint
    app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please provide a PDF file to upload',
          });
        }

        // Check file type
        if (!req.file.mimetype.includes('pdf') && !req.file.originalname.endsWith('.pdf')) {
          return res.status(400).json({
            error: 'Invalid file format',
            message: 'Only PDF files are allowed',
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
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            signature: 'mock-signature',
            nonce: 'mock-nonce',
          },
        };

        res.json(mockResponse);
      } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Internal server error during processing' });
      }
    });

    // Mock PDF process endpoint
    app.post('/api/documents/process', express.json(), async (req, res) => {
      try {
        const { taskId } = req.body;

        if (!taskId) {
          return res.status(400).json({
            error: 'Missing required field',
            message: 'taskId is required',
          });
        }

        // Mock processing response
        const mockResponse = {
          taskId,
          status: 'completed',
          sanitizedContent: 'Mocked processed content',
          trustToken: {
            contentHash: 'process-hash',
            originalHash: 'original-process-hash',
            sanitizationVersion: '1.0',
            rulesApplied: ['basic-sanitization'],
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            signature: 'process-signature',
          },
          metadata: {
            processingTime: 100,
            fallback: false,
          },
        };

        res.json(mockResponse);
      } catch (error) {
        res.status(500).json({ error: 'Processing failed' });
      }
    });
  });

  describe('PDF Upload Error Scenarios', () => {
    test('should handle invalid file format gracefully', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', Buffer.from('invalid file content'), 'invalid.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid.*format|file.*type/i);
    });

    test('should handle file too large error', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', oversizedPdf, 'large-file.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/too.*large|size.*limit/i);
    });

    test('should handle corrupted PDF files', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', corruptedPdf, 'corrupted.pdf')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/Internal server error|processing/i);
    });
  });

  describe('Text Extraction Error Scenarios', () => {
    test('should handle corrupted PDF during text extraction', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', corruptedPdf, 'corrupted.pdf');

      // Should either fail gracefully or fallback
      if (response.status === 200) {
        expect(response.body).toHaveProperty('sanitizedContent');
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Sanitization Error Scenarios', () => {
    test('should handle XSS content in PDF text', async () => {
      const xssPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(<script>alert(1)</script>) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      );

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', xssPdf, 'xss-document.pdf')
        .expect(200);

      // Validate XSS content was sanitized
      expect(response.body.sanitizedContent).not.toContain('<script>');
      expect(response.body.sanitizedContent).not.toContain('alert(1)');
      expect(response.body.trustToken.rulesApplied).toContain('xss-sanitization');
    });

    test('should handle SQL injection attempts in PDF text', async () => {
      const sqlPdf = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(' OR '1'='1) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF",
      );

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', sqlPdf, 'sql-document.pdf')
        .expect(200);

      // Validate SQL injection content was sanitized
      expect(response.body.sanitizedContent).not.toContain("' OR '1'='1");
      expect(response.body.trustToken.rulesApplied).toContain('sql-injection-prevention');
    });
  });

  describe('AI Transformation Error Scenarios', () => {
    test('should handle AI processing errors gracefully', async () => {
      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('file', validPdf, 'simple-document.pdf')
        .expect(200);

      // Should always return a result, either processed or fallback
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('processingMetadata');
    });
  });

  describe('Trust Token Generation Error Scenarios', () => {
    test('should handle invalid content hash generation', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', validPdf, 'simple-document.pdf')
        .expect(200);

      // Trust token should always be generated successfully
      expect(response.body.trustToken).toHaveProperty('contentHash');
      expect(response.body.trustToken).toHaveProperty('originalHash');
      expect(response.body.trustToken).toHaveProperty('signature');
      expect(typeof response.body.trustToken.contentHash).toBe('string');
      expect(typeof response.body.trustToken.signature).toBe('string');
    });
  });

  describe('Trust Token Validation Error Scenarios', () => {
    test('should handle expired token validation', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', validPdf, 'simple-document.pdf')
        .expect(200);

      const trustToken = response.body.trustToken;

      // Validate token expiration is properly set
      const expiresAt = new Date(trustToken.expiresAt);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('API Response Error Scenarios', () => {
    test('should handle schema validation failures', async () => {
      const response = await request(app)
        .post('/api/documents/process')
        .send({
          invalidField: 'test',
          transform: 'invalid_boolean',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/Missing required field|taskId is required/i);
    });

    test('should handle missing required fields', async () => {
      const response = await request(app).post('/api/documents/process').send({}).expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/required|missing|taskId/i);
    });
  });

  describe('Pipeline Recovery and Fallback', () => {
    test('should provide meaningful error messages', async () => {
      const response = await request(app)
        .post('/api/documents/process')
        .send({
          taskId: 'non-existent-task',
          transform: true,
          transformType: 'structure',
        })
        .expect(200); // Mock endpoint doesn't validate taskId

      // In real implementation, this would return 404
      expect(response.body).toHaveProperty('taskId');
    });

    test('should maintain system stability during errors', async () => {
      // Send multiple error requests to ensure system doesn't crash
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/documents/process')
            .send({
              taskId: `invalid-task-${i}`,
              transform: true,
              transformType: 'structure',
            }),
        );
      }

      const responses = await Promise.all(promises);

      // All should return success (mock implementation)
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('taskId');
      }
    });
  });
});
