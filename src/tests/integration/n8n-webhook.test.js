const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

// Mock the ProxySanitizer's forwardToLLM method
jest.mock('../../components/proxy-sanitizer', () => {
  return jest.fn().mockImplementation(() => ({
    sanitize: jest.fn((data) => `sanitized-${data}`),
    handleN8nWebhook: jest.fn((payload) => ({
      result: `processed-sanitized-${payload.data}`,
    })),
  }));
});

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('n8n Webhook Integration', () => {
  test('should process n8n webhook end-to-end', async () => {
    const payload = { data: 'test data' };
    const response = await request(app).post('/api/webhook/n8n').send(payload).expect(200);

    expect(response.body).toHaveProperty('result');
    expect(response.body.result).toHaveProperty('sanitizedData');
    expect(response.body.result.sanitizedData).toBe('processed-sanitized-test data');
  });

  test('should apply input and output sanitization', async () => {
    // Assuming sanitization removes certain chars
    const payload = { data: '<script>alert("xss")</script>' };
    const response = await request(app).post('/api/webhook/n8n').send(payload).expect(200);

    expect(response.body.result.sanitizedData).toContain('sanitized');
  });
});
