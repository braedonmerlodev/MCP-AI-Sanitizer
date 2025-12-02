const request = require('supertest');
const app = require('../../app');
const fs = require('fs');
const path = require('path');

// Mock environment for tests
const originalEnv = process.env;

describe('API Contract Validation Tests', () => {
  let testPdfs;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';

    // Load test fixtures
    testPdfs = {
      simple: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/simple-document.pdf')),
      complex: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/complex-document.pdf')),
      xss: fs.readFileSync(path.join(__dirname, '../fixtures/test-pdfs/xss-test-document.pdf')),
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    // Clear any cached modules that depend on env
    delete require.cache[require.resolve('../../config/index')];
    delete require.cache[require.resolve('../../routes/api')];
    delete require.cache[require.resolve('../../components/sanitization-pipeline')];
  });

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
          value.forEach((item, index) => {
            validateField(`${field}[${index}]`, item, schema.items);
          });
        }
      }
    };

    for (const [field, schema] of Object.entries(expectedSchema)) {
      validateField(field, response[field], schema);
    }
  };

  describe('PDF Upload API Contract', () => {
    const uploadResponseSchema = {
      taskId: { type: 'string', required: true, minLength: 1 },
    };

    test('should validate PDF upload response schema', async () => {
      const response = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      expect(() => validateApiResponse(response.body, uploadResponseSchema)).not.toThrow();
    });

    test('should validate error response schema for invalid upload', async () => {
      const errorResponseSchema = {
        error: { type: 'string', required: true, minLength: 1 },
      };

      const response = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', Buffer.from('invalid content'), 'invalid.txt')
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
      delete process.env.TRUST_TOKENS_ENABLED;

      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: taskId,
          transform: true,
          transformType: 'structure',
        })
        .expect(200);

      expect(() => validateApiResponse(processResponse.body, processResponseSchema)).not.toThrow();
    });

    test('should validate PDF process response schema with trust tokens disabled', async () => {
      process.env.TRUST_TOKENS_ENABLED = 'false';

      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
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
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const transformations = ['structure', 'summarize', 'extract_entities'];

      for (const transformType of transformations) {
        const processResponse = await request(app)
          .post('/api/pdf/process')
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
        .post('/api/pdf/process')
        .send({
          transform: true,
          transformType: 'structure',
        })
        .expect(400);

      expect(() => validateApiResponse(response1.body, errorResponseSchema)).not.toThrow();

      // Test invalid taskId
      const response2 = await request(app)
        .post('/api/pdf/process')
        .send({
          taskId: 'invalid-task-id',
          transform: true,
          transformType: 'structure',
        })
        .expect(404);

      expect(() => validateApiResponse(response2.body, errorResponseSchema)).not.toThrow();
    });
  });

  describe('Security Event Metadata Contract', () => {
    test('should validate security event metadata in XSS responses', async () => {
      const uploadResponse = await request(app)
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.xss, 'xss-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
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
        .post('/api/pdf/upload')
        .attach('pdf', testPdfs.simple, 'simple-document.pdf')
        .expect(200);

      const taskId = uploadResponse.body.taskId;

      const processResponse = await request(app)
        .post('/api/pdf/process')
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
          .post('/api/pdf/upload')
          .attach('pdf', testCase.pdf, `${testCase.name}-document.pdf`)
          .expect(200);

        const taskId = uploadResponse.body.taskId;

        const processResponse = await request(app)
          .post('/api/pdf/process')
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
