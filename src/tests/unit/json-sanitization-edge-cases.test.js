const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

// Mock environment variables
process.env.TRUST_TOKEN_SECRET = 'test-secret-key-for-edge-cases';
process.env.ADMIN_AUTH_SECRET = 'test-admin-secret';

// Mock multer for file uploads
jest.mock('multer', () => {
  const multerMock = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => next()),
  }));
  multerMock.diskStorage = jest.fn();
  multerMock.memoryStorage = jest.fn();
  return multerMock;
});

// Mock pdf-parse
jest.mock('pdf-parse', () =>
  jest.fn().mockResolvedValue({
    text: 'Mock PDF text',
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
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
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

// Mock AITextTransformer
jest.mock('../../components/AITextTransformer', () => {
  return jest.fn().mockImplementation(() => ({
    transform: jest.fn().mockResolvedValue({
      text: '{"transformed": "content"}',
      metadata: { aiProcessed: true },
    }),
  }));
});

describe('JSON Sanitization Chains and Transformations - Edge Cases', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 2: Multiple Sequential Transformation Steps', () => {
    test('should handle complex transformation chains with multiple operations', async () => {
      const complexData = {
        user_name: 'john_doe',
        user_password: 'secret123',
        user_age: '30',
        user_active: 'true',
        user_score: '95.5',
        nested_data: {
          item_name: 'test_item',
          item_count: '5',
        },
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(complexData),
          transform: true,
          transformOptions: {
            chain: [
              { operation: 'normalizeKeys', params: ['camelCase'] },
              { operation: 'removeFields', params: [['userPassword']] },
              {
                operation: 'coerceTypes',
                params: [
                  {
                    userAge: 'number',
                    userActive: 'boolean',
                    userScore: 'number',
                    itemCount: 'number',
                  },
                ],
              },
            ],
          },
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result).toHaveProperty('userName', 'john_doe');
      expect(result).toHaveProperty('userAge', 30);
      expect(result).toHaveProperty('userActive', true);
      expect(result).toHaveProperty('userScore', 95.5);
      expect(result).not.toHaveProperty('userPassword');
      expect(result.nestedData).toHaveProperty('itemName', 'test_item');
      expect(result.nestedData).toHaveProperty('itemCount', 5);
    });

    test('should handle preset application followed by additional transformations', async () => {
      const apiData = {
        user_name: 'john',
        _id: 'mongo123',
        password: 'secret',
        total_count: '100',
        is_active: '1',
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(apiData),
          transform: true,
          transformOptions: {
            chain: [
              { operation: 'applyPreset', params: ['apiResponse'] },
              { operation: 'normalizeKeys', params: ['snake_case'] },
            ],
          },
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      // After apiResponse preset (camelCase, remove fields) then snake_case
      expect(result).toHaveProperty('user_name', 'john');
      expect(result).toHaveProperty('total_count', 100);
      expect(result).toHaveProperty('is_active', true);
      expect(result).not.toHaveProperty('_id');
      expect(result).not.toHaveProperty('password');
    });

    test('should handle empty chain operations gracefully', async () => {
      const data = { test: 'data' };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(data),
          transform: true,
          transformOptions: {
            chain: [],
          },
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result).toEqual(data);
    });

    test('should skip unknown operations in chain with warning', async () => {
      const data = { test: 'data' };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(data),
          transform: true,
          transformOptions: {
            chain: [
              { operation: 'normalizeKeys', params: ['camelCase'] },
              { operation: 'unknownOperation', params: [] },
              { operation: 'removeFields', params: [['nonexistent']] },
            ],
          },
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result).toHaveProperty('test', 'data');
    });
  });

  describe('Task 3: Pipeline Failure Scenarios', () => {
    test('should handle async job submission failures', async () => {
      const queueManager = require('../../utils/queueManager');
      queueManager.addJob.mockRejectedValueOnce(new Error('Queue full'));

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify({ test: 'large data'.repeat(1000) }),
          async: true,
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to submit async job');
    });
  });

  describe('Task 4: Invalid JSON Input Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: '{invalid json syntax',
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
          },
        });

      expect(response.status).toBe(200);
      // Should sanitize the string as-is when JSON parsing fails
      expect(typeof response.body.sanitizedContent).toBe('string');
    });

    test('should handle null and undefined values in JSON', async () => {
      const data = {
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'test',
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(data),
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
      expect(result.validValue).toBe('test');
    });

    test('should handle empty JSON objects and arrays', async () => {
      const data = {
        emptyObject: {},
        emptyArray: [],
        nestedEmpty: { empty: {} },
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(data),
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
          },
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result.emptyObject).toEqual({});
      expect(result.emptyArray).toEqual([]);
      expect(result.nestedEmpty.empty).toEqual({});
    });
  });

  describe('Task 5: Deeply Nested Object Processing', () => {
    test('should handle deeply nested objects (10+ levels)', async () => {
      // Create deeply nested object
      let nested = { value: 'deep' };
      for (let i = 0; i < 10; i++) {
        nested = { level: i, next: nested };
      }
      const deepData = { root: nested };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(deepData),
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
          },
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result.root).toBeDefined();
      // Verify structure is preserved
      let current = result.root;
      for (let i = 9; i >= 0; i--) {
        expect(current.level).toBe(i);
        current = current.next;
      }
      expect(current.value).toBe('deep');
    });

    test('should handle arrays within deeply nested structures', async () => {
      const nestedData = {
        level1: {
          level2: {
            level3: [
              { item: 'a', value: 1 },
              { item: 'b', value: 2 },
              {
                nested: {
                  deep: {
                    array: ['x', 'y', 'z'],
                  },
                },
              },
            ],
          },
        },
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(nestedData),
          transform: true,
          transformOptions: {
            chain: [
              { operation: 'normalizeKeys', params: ['camelCase'] },
              { operation: 'coerceTypes', params: [{ value: 'number' }] },
            ],
          },
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result.level1.level2.level3).toHaveLength(3);
      expect(result.level1.level2.level3[0].value).toBe(1);
      expect(result.level1.level2.level3[1].value).toBe(2);
      expect(result.level1.level2.level3[2].nested.deep.array).toEqual(['x', 'y', 'z']);
    });
  });

  describe('Task 6: Large Payload Handling', () => {
    test('should handle large JSON payloads (100KB+)', async () => {
      const largeData = {
        largeString: 'x'.repeat(50000), // 50KB string
        largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, data: 'x'.repeat(50) })),
        nested: {
          deep: {
            data: 'x'.repeat(25000), // 25KB
          },
        },
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(largeData),
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result.largeString).toHaveLength(50000);
      expect(result.largeArray).toHaveLength(1000);
      expect(result.nested.deep.data).toHaveLength(25000);
    });

    test('should trigger async processing for very large payloads', async () => {
      const veryLargeData = {
        hugeString: 'x'.repeat(100000), // 100KB
        hugeArray: Array.from({ length: 5000 }, (_, i) => ({ id: i, data: 'x'.repeat(100) })),
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(veryLargeData),
          async: true,
        });

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('taskId');
      expect(response.body.status).toBe('processing');
    });
  });

  describe('Task 7: Special Character Encoding', () => {
    test('should handle Unicode characters and emojis', async () => {
      const unicodeData = {
        text: 'Special chars: ñáéíóú 🚀 🔥 💯',
        unicode: '\u00A9\u00AE\u2122', // ©®™
        emojis: '😀🎉🎊🌟⭐',
        mixed: 'café résumé naïve',
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(unicodeData),
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result.text).toContain('ñáéíóú');
      expect(result.text).toContain('🚀');
      expect(result.unicode).toBe('©®™');
      expect(result.emojis).toContain('😀');
      expect(result.mixed).toBe('café résumé naïve');
    });

    test('should handle escape sequences and control characters', async () => {
      const escapeData = {
        quotes: '"single\'double"',
        escapes: 'line1\nline2\t\ttabbed\r\ncrlf',
        unicodeEscapes: '\u0048\u0065\u006C\u006C\u006F', // Hello
        controlChars: 'bell:\u0007 tab:\u0009 newline:\u000A',
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(escapeData),
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result.quotes).toBe('"single\'double"');
      expect(result.escapes).toContain('\n');
      expect(result.escapes).toContain('\t');
      expect(result.unicodeEscapes).toBe('Hello');
      expect(result.controlChars).toContain('\u0007');
    });
  });

  describe('Task 8: Coverage Analysis Verification', () => {
    test('should verify all transformation operations are covered', async () => {
      // Test all preset types
      const presets = ['aiProcessing', 'apiResponse', 'dataExport', 'databaseStorage'];

      for (const preset of presets) {
        const response = await request(app)
          .post('/api/sanitize/json')
          .send({
            content: JSON.stringify({ test: 'data' }),
            transform: true,
            transformOptions: {
              preset: preset,
            },
          });

        expect(response.status).toBe(200);
      }
    });

    test('should verify complex nested transformations', async () => {
      const complexNested = {
        level1: {
          level2: {
            level3: {
              array: [
                { key1: 'value1', key2: 'value2' },
                { key3: 'value3', key4: 'value4' },
              ],
              object: {
                nested: {
                  deep: {
                    value: 'test',
                  },
                },
              },
            },
          },
        },
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: JSON.stringify(complexNested),
          transform: true,
          transformOptions: {
            chain: [
              { operation: 'normalizeKeys', params: ['camelCase'] },
              { operation: 'removeFields', params: [['key2', 'key4']] },
              { operation: 'coerceTypes', params: [{}] },
            ],
          },
        });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.sanitizedContent);
      expect(result.level1.level2.level3.array[0]).toHaveProperty('key1');
      expect(result.level1.level2.level3.array[0]).not.toHaveProperty('key2');
      expect(result.level1.level2.level3.object.nested.deep.value).toBe('test');
    });
  });
});
