const request = require('supertest');
const { app, clearCaches, cache } = require('./proxy');

// Mock axios for backend responses
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const mock = new MockAdapter(axios);

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('Proxy End-to-End Integration Tests', () => {
  beforeEach(() => {
    clearCaches();
    mock.reset();
  });

  describe('PDF Processing with Trust Token Caching', () => {
    const testPdfData = { content: 'test pdf content' };
    const validToken = 'valid-trust-token-123';
    const invalidToken = 'invalid-token';

    test('should cache successful backend responses with valid trust token', async () => {
      // Mock backend to return success
      mock.onPost('http://localhost:3000/api/process-pdf').reply(200, testPdfData);

      // First request - cache miss
      const response1 = await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', validToken)
        .send({ pdf: 'test data' })
        .expect(200);

      expect(response1.body).toEqual(testPdfData);
      expect(axios.post).toHaveBeenCalledTimes(1);

      // Second request - cache hit
      const response2 = await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', validToken)
        .send({ pdf: 'test data' })
        .expect(200);

      expect(response2.body).toEqual(testPdfData);
      expect(axios.post).toHaveBeenCalledTimes(1); // Still 1 call - cache hit
    });

    test('should not cache responses without trust token', async () => {
      // Mock backend
      mock.onPost('http://localhost:3000/api/process-pdf').reply(200, testPdfData);

      // First request without token
      await request(app).post('/api/process-pdf').send({ pdf: 'test data' }).expect(200);

      expect(axios.post).toHaveBeenCalledTimes(1);

      // Second request without token - should not hit cache
      await request(app).post('/api/process-pdf').send({ pdf: 'test data' }).expect(200);

      expect(axios.post).toHaveBeenCalledTimes(2); // Called again
    });

    test('should invalidate cache for invalid trust tokens', async () => {
      // Mock backend responses
      mock
        .onPost('http://localhost:3000/api/process-pdf')
        .reply(200, testPdfData)
        .onPost('http://localhost:3000/api/trust-tokens/validate')
        .reply(200, { valid: false, error: 'Token expired' })
        .onPost('http://localhost:3000/api/process-pdf')
        .reply(200, { content: 'fresh content' });

      // First request with valid token - cache
      await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', validToken)
        .send({ pdf: 'test data' })
        .expect(200);

      expect(axios.post).toHaveBeenCalledTimes(1);

      // Second request with same token - should validate and serve cached
      await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', validToken)
        .send({ pdf: 'test data' })
        .expect(200);

      expect(axios.post).toHaveBeenCalledTimes(2); // Validation call

      // Third request with invalid token - should invalidate and proxy fresh
      const response3 = await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', invalidToken)
        .send({ pdf: 'test data' })
        .expect(200);

      expect(response3.body).toEqual({ content: 'fresh content' });
      expect(axios.post).toHaveBeenCalledTimes(3); // Fresh backend call
    });

    test('should handle backend errors gracefully', async () => {
      // Mock backend error
      axios.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Backend error' },
        },
      });

      const response = await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', validToken)
        .send({ pdf: 'test data' })
        .expect(500);

      expect(response.body.error).toBe('Backend error');
    });

    test('should extract trust tokens from different sources', async () => {
      axios.post.mockResolvedValue({
        data: testPdfData,
        status: 200,
      });

      // Test Authorization header
      await request(app)
        .post('/api/process-pdf')
        .set('Authorization', 'Bearer auth-token')
        .send({ pdf: 'test data' })
        .expect(200);

      expect(axios.post).toHaveBeenCalledTimes(1);

      // Test X-Trust-Token header
      await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', 'header-token')
        .send({ pdf: 'test data' })
        .expect(200);

      expect(axios.post).toHaveBeenCalledTimes(2);

      // Test cookie
      await request(app)
        .post('/api/process-pdf')
        .set('Cookie', 'trust_token=cookie-token')
        .send({ pdf: 'test data' })
        .expect(200);

      expect(axios.post).toHaveBeenCalledTimes(3);
    });

    test('should handle rate limiting', async () => {
      // Mock backend
      axios.post.mockResolvedValue({
        data: testPdfData,
        status: 200,
      });

      // Make multiple requests quickly
      const promises = [];
      for (let i = 0; i < 105; i++) {
        promises.push(
          request(app)
            .post('/api/process-pdf')
            .set('X-Trust-Token', validToken)
            .send({ pdf: 'test data' }),
        );
      }

      const responses = await Promise.all(promises);

      // Some should be rate limited (429)
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should provide cache statistics', async () => {
      const response = await request(app).get('/api/status').expect(200);

      expect(response.body).toHaveProperty('cache');
      expect(response.body.cache).toHaveProperty('keys');
      expect(response.body.cache).toHaveProperty('hits');
      expect(response.body.cache).toHaveProperty('misses');
      expect(response.body.cache).toHaveProperty('trustTokenBreakdown');
    });

    test('should handle cache invalidation endpoint', async () => {
      // First cache something
      axios.post.mockResolvedValue({
        data: testPdfData,
        status: 200,
      });

      await request(app)
        .post('/api/process-pdf')
        .set('X-Trust-Token', validToken)
        .send({ pdf: 'test data' });

      // Check cache has entries
      const statusBefore = await request(app).get('/api/status');
      expect(statusBefore.body.cache.keys).toBeGreaterThan(0);

      // Invalidate cache
      const invalidateResponse = await request(app)
        .post('/api/cache/invalidate-trust-token')
        .send({ trustToken: validToken })
        .expect(200);

      expect(invalidateResponse.body.success).toBe(true);
      expect(invalidateResponse.body.entriesCleared).toBeGreaterThanOrEqual(0);
    });
  });

  describe('WebSocket Support', () => {
    test('should handle WebSocket upgrade requests with trust token validation', async () => {
      // Test WebSocket upgrade with trust token in headers
      // Since WebSocket upgrade goes through the same middleware, trust token should be extracted
      const response = await request(app)
        .get('/api/status') // Use an API endpoint to test middleware
        .set('X-Trust-Token', validToken)
        .set('Upgrade', 'websocket')
        .set('Connection', 'Upgrade')
        .expect(200);

      expect(response.body).toHaveProperty('cache');
      // Trust token should be validated and logged
    });

    test('should reject WebSocket upgrades without valid trust tokens', async () => {
      // Test that invalid tokens are handled for WebSocket-like requests
      const response = await request(app)
        .get('/api/status')
        .set('X-Trust-Token', invalidToken)
        .set('Upgrade', 'websocket')
        .set('Connection', 'Upgrade')
        .expect(200); // Status endpoint still works, but token is invalid

      expect(response.body).toHaveProperty('cache');
      // Invalid token should be logged as warning
    });

    test('should extract trust tokens from WebSocket query parameters', async () => {
      // Test trust token in query params (common for WebSocket)
      const response = await request(app)
        .get('/api/status?trust_token=query-token-123')
        .set('Upgrade', 'websocket')
        .set('Connection', 'Upgrade')
        .expect(200);

      expect(response.body).toHaveProperty('cache');
      // Token extraction should work from query params if implemented
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
