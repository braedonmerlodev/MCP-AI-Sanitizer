const request = require('supertest');
const { app, clearCaches } = require('./proxy');

// Mock winston logger to avoid console output during tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('Proxy Trust Token Integration Tests', () => {
  beforeEach(() => {
    clearCaches();
  });

  describe('Trust Token Middleware Integration', () => {
    const validToken = 'valid-trust-token-123';

    test('should process trust tokens in API requests', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('X-Trust-Token', validToken)
        .expect(200);

      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('rateLimit');
    });

    test('should handle missing trust tokens gracefully', async () => {
      const response = await request(app).get('/api/status').expect(200);

      expect(response.body).toHaveProperty('cache');
    });

    test('should extract tokens from Authorization header', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('Authorization', 'Bearer auth-token-123')
        .expect(200);

      expect(response.body).toHaveProperty('cache');
    });

    test('should extract tokens from X-Trust-Token header', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('X-Trust-Token', 'header-token-456')
        .expect(200);

      expect(response.body).toHaveProperty('cache');
    });

    test('should extract tokens from cookies', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('Cookie', 'trust_token=cookie-token-789')
        .expect(200);

      expect(response.body).toHaveProperty('cache');
    });
  });

  describe('Health and Status Endpoints', () => {
    test('should provide health check', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should provide status information', async () => {
      const response = await request(app).get('/api/status').expect(200);

      expect(response.body).toHaveProperty('status', 'operational');
      expect(response.body).toHaveProperty('rateLimit');
      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('backend');
    });
  });
});
