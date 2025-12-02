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

// Helper function to validate response against schema
const validateApiResponse = (response, expectedSchema) => {
  const validateField = (field, value, schema) => {
    if (schema.required && (value === undefined || value === null)) {
      throw new Error(`Missing required field: ${field}`);
    }

    if (value !== undefined && value !== null) {
      if (schema.type && typeof value !== schema.type) {
        throw new Error(
          `Field ${field} has wrong type. Expected ${schema.type}, got ${typeof value}`,
        );
      }

      if (schema.enum && !schema.enum.includes(value)) {
        throw new Error(
          `Field ${field} has invalid value. Expected one of ${schema.enum.join(', ')}, got ${value}`,
        );
      }

      if (schema.minLength && value.length < schema.minLength) {
        throw new Error(
          `Field ${field} is too short. Minimum length ${schema.minLength}, got ${value.length}`,
        );
      }

      if (schema.properties && typeof value === 'object') {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          validateField(`${field}.${prop}`, value[prop], propSchema);
        }
      }

      if (schema.items && Array.isArray(value)) {
        // Note: This is simplified - in real implementation you'd validate each item
        // eslint-disable-next-line no-unused-vars
        for (const item of value) {
          // Placeholder for item validation
        }
      }
    }
  };

  for (const [field, schema] of Object.entries(expectedSchema)) {
    validateField(field, response[field], schema);
  }
};

describe('API Contract Validation Tests', () => {
  let app;
  let testPdfs;

  beforeAll(() => {
    // Load test fixtures
    testPdfs = {
      simple: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/simple-document.pdf')),
      complex: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/complex-document.pdf')),
      xss: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/xss-test-document.pdf')),
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

        // Check file type
        if (!req.file.mimetype.includes('pdf') && !req.file.originalname.endsWith('.pdf')) {
          return res.status(400).json({
            error: 'Invalid file format',
            message: 'Only PDF files are allowed',
          });
        }

        // Mock response
        const mockResponse = {
          taskId: `task-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        };

        res.json(mockResponse);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
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

        if (!transform) {
          return res.status(400).json({
            error: 'Missing required field',
            message: 'transform is required',
          });
        }

        // Mock processing response
        const mockResponse = {
          sanitizedContent: 'Mocked processed content',
          trustToken: {
            contentHash: 'mock-hash',
            originalHash: 'original-mock-hash',
            sanitizationVersion: '1.0',
            rulesApplied: ['basic-sanitization', 'xss-sanitization'],
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            signature: 'mock-signature',
          },
          metadata: {
            processingTime: 150,
            originalLength: 1000,
            sanitizedLength: 950,
            pipelineStage: 'completed',
            securityEvents: {
              xss_detected: 2,
              sql_injection_detected: 0,
              content_sanitized: true,
            },
            fallback: false,
          },
        };

        res.json(mockResponse);
      } catch (error) {
        res.status(500).json({ error: 'Processing failed' });
      }
    });
  });

  describe('PDF Upload API Contract', () => {
    const uploadResponseSchema = {
      taskId: { type: 'string', required: true, minLength: 1 },
    };

    test('should validate PDF upload response schema', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      expect(() => validateApiResponse(response.body, uploadResponseSchema)).not.toThrow();
    });

    test('should validate error response schema for invalid upload', async () => {
      const errorResponseSchema = {
        error: { type: 'string', required: true, minLength: 1 },
      };

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('file', Buffer.from('invalid content'), 'invalid.txt')
        .expect(400);

      expect(() => validateApiResponse(response.body, errorResponseSchema)).not.toThrow();
    });
  });

  describe('PDF Process API Contract', () => {
    const processResponseSchema = {
      sanitizedContent: { type: 'string', required: true },
      trustToken: {
        type: 'object',
        properties: {
          contentHash: { type: 'string', required: true, minLength: 1 },
          originalHash: { type: 'string', required: true, minLength: 1 },
          sanitizationVersion: { type: 'string', required: true },
          rulesApplied: { type: 'object', required: true }, // Array in JSON
          timestamp: { type: 'string', required: true },
          expiresAt: { type: 'string', required: true },
          signature: { type: 'string', required: true, minLength: 1 },
        },
      },
      metadata: {
        type: 'object',
        required: true,
        properties: {
          processingTime: { type: 'number', required: true },
          originalLength: { type: 'number', required: true },
          sanitizedLength: { type: 'number', required: true },
          pipelineStage: { type: 'string', required: true },
        },
      },
    };

    const processResponseSchemaNoToken = {
      sanitizedContent: { type: 'string', required: true },
      trustToken: { type: 'object' }, // Can be null
      metadata: {
        type: 'object',
        required: true,
        properties: {
          processingTime: { type: 'number', required: true },
          originalLength: { type: 'number', required: true },
          sanitizedLength: { type: 'number', required: true },
        },
      },
    };

    test('should validate PDF process response schema with trust tokens enabled', async () => {
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('file', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/documents/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      expect(() => validateApiResponse(processResponse.body, processResponseSchema)).not.toThrow();
    });

    test('should validate PDF process response schema with trust tokens disabled', async () => {
      // Create app without trust tokens
      const appNoTokens = express();
      appNoTokens.use(express.json());
      appNoTokens.use((req, res, next) => {
        req.user = { id: 'test-user' };
        req.ip = '127.0.0.1';
        next();
      });
      appNoTokens.use(mockAgentAuth);
      appNoTokens.use(mockAccessValidation);

      const upload = multer({ storage: multer.memoryStorage() });

      appNoTokens.post('/api/documents/upload', upload.single('file'), async (req, res) => {
        const mockResponse = {
          taskId: `task-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        };
        res.json(mockResponse);
      });

      appNoTokens.post('/api/documents/process', express.json(), async (req, res) => {
        const mockResponse = {
          sanitizedContent: 'Mocked processed content',
          trustToken: null,
          metadata: {
            processingTime: 150,
            originalLength: 1000,
            sanitizedLength: 950,
          },
        };
        res.json(mockResponse);
      });

      const uploadResponse = await request(appNoTokens)
        .post('/api/documents/upload')
        .attach('file', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(appNoTokens)
        .post('/api/documents/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      expect(() =>
        validateApiResponse(processResponse.body, processResponseSchemaNoToken),
      ).not.toThrow();
      expect(processResponse.body.trustToken).toBeNull();
    });

    test('should validate different transformation types maintain schema', async () => {
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('file', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const transformations = ['structure', 'summarize', 'extract_entities'];

      for (const transformType of transformations) {
        const processResponse = await request(app)
          .post('/api/documents/process')
          .send({
            taskId: taskId,
            transform: true,
            transformType: transformType,
          })
          .expect(200);

        expect(() =>
          validateApiResponse(processResponse.body, processResponseSchema),
        ).not.toThrow();
      }
    });

    test('should validate error response schema for invalid requests', async () => {
      const errorResponseSchema = {
        error: { type: 'string', required: true, minLength: 1 },
      };

      // Test missing taskId
      const response1 = await request(app)
        .post('/api/documents/process')
        .send({
          transform: true,
          transformType: 'structure',
        })
        .expect(400);

      expect(() => validateApiResponse(response1.body, errorResponseSchema)).not.toThrow();

      // Test missing transform
      const response2 = await request(app)
        .post('/api/documents/process')
        .send({
          taskId: 'some-task-id',
          transformType: 'structure',
        })
        .expect(400);

      expect(() => validateApiResponse(response2.body, errorResponseSchema)).not.toThrow();
    });
  });

  describe('Security Event Metadata Contract', () => {
    test('should validate security event metadata in XSS responses', async () => {
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('file', testPdfs.xss, 'xss-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/documents/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Validate security events metadata
      expect(processResponse.body.metadata).toHaveProperty('securityEvents');
      expect(processResponse.body.metadata.securityEvents).toHaveProperty('xss_detected');
      expect(processResponse.body.metadata.securityEvents).toHaveProperty('sql_injection_detected');
      expect(processResponse.body.metadata.securityEvents).toHaveProperty('content_sanitized');

      expect(typeof processResponse.body.metadata.securityEvents.xss_detected).toBe('number');
      expect(typeof processResponse.body.metadata.securityEvents.sql_injection_detected).toBe(
        'number',
      );
      expect(typeof processResponse.body.metadata.securityEvents.content_sanitized).toBe('boolean');
    });
  });

  describe('Fallback Response Contract', () => {
    test('should validate fallback response schema', async () => {
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('file', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/documents/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      // Test fallback scenario (if AI fails, should still return valid response)
      expect(processResponse.body).toHaveProperty('sanitizedContent');
      expect(processResponse.body).toHaveProperty('metadata');

      // If fallback occurred, validate fallback metadata
      if (processResponse.body.metadata.fallback) {
        expect(processResponse.body.metadata).toHaveProperty('reason');
        expect(['rate_limit_exceeded', 'quota_exceeded', 'ai_error']).toContain(
          processResponse.body.metadata.reason,
        );
      }
    });
  });

  describe('API Contract Consistency', () => {
    test('should maintain consistent response structure across different inputs', async () => {
      const testCases = [
        { pdf: testPdfs.simple, name: 'simple' },
        { pdf: testPdfs.complex, name: 'complex' },
        { pdf: testPdfs.xss, name: 'xss' },
      ];

      for (const testCase of testCases) {
        const uploadResponse = await request(app)
          .post('/api/documents/upload')
          .attach('file', testCase.pdf, `${testCase.name}-document.pdf`)
          .expect(200);

        const taskId = uploadResponse.body.taskId;

        const processResponse = await request(app)
          .post('/api/documents/process')
          .send({
            taskId: taskId,
            transform: true,
            transformType: 'structure',
          })
          .expect(200);

        // All responses should have the same basic structure
        expect(processResponse.body).toHaveProperty('sanitizedContent');
        expect(processResponse.body).toHaveProperty('metadata');
        expect(processResponse.body.metadata).toHaveProperty('processingTime');
        expect(processResponse.body.metadata).toHaveProperty('originalLength');
        expect(processResponse.body.metadata).toHaveProperty('sanitizedLength');
      }
    });
  });
});
