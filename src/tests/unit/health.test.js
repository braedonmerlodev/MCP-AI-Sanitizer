const request = require('supertest');
const app = require('../../../app');

describe('Health Check Endpoint', () => {
  test('should return healthy status with timestamp', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.timestamp).toBe('string');
    // Validate ISO timestamp format
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });

  test('should respond within reasonable time', async () => {
    const start = Date.now();
    await request(app).get('/health').expect(200);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Less than 1 second
  });

  test('should not require authentication', async () => {
    // Test without any auth headers
    await request(app).get('/health').expect(200);
  });
});
