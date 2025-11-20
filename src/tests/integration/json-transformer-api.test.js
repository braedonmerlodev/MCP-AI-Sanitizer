const request = require('supertest');
const app = require('../../app');

describe('JSONTransformer API Integration Tests', () => {
  describe('POST /api/sanitize/json - Transformation Features', () => {
    const baseTestData = {
      content: JSON.stringify({
        user_name: 'john_doe',
        user_age: '30',
        password: 'secret123',
        is_active: 'true',
        created_at: '2023-12-25T10:00:00Z',
        nested_data: {
          email: 'john@example.com',
          temp_token: 'abc123',
          score: '95.5',
        },
      }),
      classification: 'user_input',
    };

    test('should apply normalizeKeys transformation (camelCase)', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...baseTestData,
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      const result = JSON.parse(response.body.sanitizedContent);

      // Should convert snake_case to camelCase
      expect(result).toHaveProperty('userName');
      expect(result).toHaveProperty('userAge');
      expect(result).toHaveProperty('isActive');
      expect(result).toHaveProperty('createdAt');
      expect(result.nestedData).toHaveProperty('email');
      expect(result.nestedData).toHaveProperty('score');

      // Password field should still be present (not removed by transformation)
      expect(result).toHaveProperty('password');
    });

    test('should apply removeFields transformation with regex patterns', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...baseTestData,
          transform: true,
          transformOptions: {
            removeFields: ['/temp_|password|token/i'],
          },
        })
        .expect(200);

      const result = JSON.parse(response.body.sanitizedContent);

      // Should remove fields matching regex patterns
      expect(result).not.toHaveProperty('password');
      expect(result.nested_data).not.toHaveProperty('temp_token');
      // Should keep other fields
      expect(result).toHaveProperty('user_name');
      expect(result).toHaveProperty('user_age');
    });

    test('should apply coerceTypes transformation', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...baseTestData,
          transform: true,
          transformOptions: {
            coerceTypes: {
              user_age: 'number',
              is_active: 'boolean',
              created_at: 'date',
              score: 'number',
            },
          },
        })
        .expect(200);

      const result = JSON.parse(response.body.sanitizedContent);

      // Should coerce types correctly
      expect(typeof result.user_age).toBe('number');
      expect(result.user_age).toBe(30);
      expect(typeof result.is_active).toBe('boolean');
      expect(result.is_active).toBe(true);
      expect(typeof result.nested_data.score).toBe('number');
      expect(result.nested_data.score).toBe(95.5);
      expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should apply preset configurations', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...baseTestData,
          transform: true,
          transformOptions: {
            preset: 'apiResponse',
          },
        })
        .expect(200);

      const result = JSON.parse(response.body.sanitizedContent);

      // API response preset should:
      // - Convert to camelCase
      // - Remove sensitive fields
      // - Coerce appropriate types
      expect(result).toHaveProperty('userName');
      expect(result).toHaveProperty('userAge');
      expect(result).toHaveProperty('isActive');
      expect(result).toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('password');
      expect(typeof result.userAge).toBe('number');
      expect(typeof result.isActive).toBe('boolean');
    });

    test('should support transformation chaining', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...baseTestData,
          transform: true,
          transformOptions: {
            chain: [
              { operation: 'removeFields', params: [['password']] },
              { operation: 'normalizeKeys', params: ['camelCase'] },
              { operation: 'coerceTypes', params: [{ userAge: 'number', isActive: 'boolean' }] },
            ],
          },
        })
        .expect(200);

      const result = JSON.parse(response.body.sanitizedContent);

      // Should apply transformations in sequence
      expect(result).toHaveProperty('userName');
      expect(result).toHaveProperty('userAge');
      expect(typeof result.userAge).toBe('number');
      expect(typeof result.isActive).toBe('boolean');
      expect(result).not.toHaveProperty('password');
    });

    test('should handle custom delimiter normalization', async () => {
      const customData = {
        content: JSON.stringify({
          user_name: 'john',
          user_age: 30,
        }),
        classification: 'user_input',
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...customData,
          transform: true,
          transformOptions: {
            normalizeKeys: { delimiter: '*' },
          },
        })
        .expect(200);

      const result = JSON.parse(response.body.sanitizedContent);
      expect(result).toHaveProperty('user*name');
      expect(result).toHaveProperty('user*age');
    });

    test('should validate transformOptions schema', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...baseTestData,
          transform: true,
          transformOptions: {
            normalizeKeys: 'invalidCase',
          },
        })
        .expect(400);

      expect(response.body.error).toContain('normalizeKeys');
    });

    test('should handle transformation errors gracefully', async () => {
      const invalidData = {
        content: 'invalid json',
        classification: 'user_input',
        transform: true,
        transformOptions: {
          normalizeKeys: 'camelCase',
        },
      };

      const response = await request(app).post('/api/sanitize/json').send(invalidData).expect(200);

      // Should still sanitize even if transformation fails
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
    });

    test('should maintain data integrity during transformations', async () => {
      const complexData = {
        content: JSON.stringify({
          users: [
            { id: '1', name: 'Alice', active: 'true', score: '100' },
            { id: '2', name: 'Bob', active: 'false', score: '85' },
          ],
          metadata: {
            total_users: '2',
            last_updated: '2023-12-25T10:00:00Z',
          },
        }),
        classification: 'user_input',
      };

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...complexData,
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
            coerceTypes: {
              active: 'boolean',
              score: 'number',
              totalUsers: 'number',
              lastUpdated: 'date',
            },
          },
        })
        .expect(200);

      const result = JSON.parse(response.body.sanitizedContent);

      // Should maintain array structure and nested objects
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users).toHaveLength(2);
      expect(typeof result.users[0].active).toBe('boolean');
      expect(typeof result.users[0].score).toBe('number');
      expect(typeof result.metadata.totalUsers).toBe('number');
      expect(result.metadata.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should support preset override with custom options', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...baseTestData,
          transform: true,
          transformOptions: {
            preset: 'apiResponse',
            removeFields: ['user_name', 'is_active'], // Additional custom removal
          },
        })
        .expect(200);

      const result = JSON.parse(response.body.sanitizedContent);

      // Should apply preset AND custom options
      expect(result).toHaveProperty('userAge'); // camelCase from preset
      expect(result).not.toHaveProperty('user_name'); // removed by custom option
      expect(result).not.toHaveProperty('is_active'); // removed by custom option
      expect(result).not.toHaveProperty('password'); // removed by preset
    });
  });

  describe('Performance and Load Testing', () => {
    const performanceData = {
      content: JSON.stringify({
        user_name: 'test_user',
        user_age: '25',
        is_active: 'true',
        created_at: '2023-12-25T10:00:00Z',
      }),
      classification: 'user_input',
    };

    test('should maintain performance under normal load', async () => {
      const startTime = process.hrtime.bigint();

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...performanceData,
          transform: true,
          transformOptions: {
            preset: 'apiResponse',
          },
        })
        .expect(200);

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(durationMs).toBeLessThan(100); // Should complete within 100ms
      expect(response.body).toHaveProperty('sanitizedContent');
    });

    test('should handle caching correctly', async () => {
      const cacheTestData = {
        content: JSON.stringify({ test_field: 'test_value' }),
        classification: 'user_input',
      };

      // First request
      const response1 = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...cacheTestData,
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
            useCache: true,
          },
        })
        .expect(200);

      // Second request with same data (should use cache if implemented)
      const response2 = await request(app)
        .post('/api/sanitize/json')
        .send({
          ...cacheTestData,
          transform: true,
          transformOptions: {
            normalizeKeys: 'camelCase',
            useCache: true,
          },
        })
        .expect(200);

      // Results should be consistent
      expect(response1.body.sanitizedContent).toBe(response2.body.sanitizedContent);
    });
  });
});
