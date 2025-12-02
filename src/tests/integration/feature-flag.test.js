const request = require('supertest');
const app = require('../../app');

// Mock environment for tests
const originalEnv = process.env;

describe('Feature Flag Integration Tests', () => {
  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    // Clear any cached modules that depend on env
    delete require.cache[require.resolve('../../config/index')];
    delete require.cache[require.resolve('../../routes/api')];
    delete require.cache[require.resolve('../../components/sanitization-pipeline')];
  });

  describe('Trust Tokens Feature Flag', () => {
    test('should generate trust tokens when feature is enabled (default)', async () => {
      delete process.env.TRUST_TOKENS_ENABLED;

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: 'Test content for sanitization',
          transform: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(typeof response.body.trustToken).toBe('object');
    });

    test('should not generate trust tokens when feature is disabled', async () => {
      process.env.TRUST_TOKENS_ENABLED = 'false';

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: 'Test content for sanitization',
          transform: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body.trustToken).toBeNull();
      expect(typeof response.body.sanitizedContent).toBe('string');
    });
  });
});
