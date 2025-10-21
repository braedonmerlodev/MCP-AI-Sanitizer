const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('API Routes', () => {
  describe('POST /api/sanitize', () => {
    test('should sanitize valid input data', async () => {
      const response = await request(app)
        .post('/api/sanitize')
        .send({ data: 'test\u200Bhidden\u200C' }) // zero-width chars
        .expect(200);

      expect(response.body).toHaveProperty('sanitizedData');
      expect(response.body.sanitizedData).toBe('testhidden'); // zero-width removed
    });

    test('should return 400 for invalid input', async () => {
      const response = await request(app).post('/api/sanitize').send({}).expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/webhook/n8n', () => {
    test('should handle n8n webhook with valid payload', async () => {
      const payload = { data: 'input data' };
      const response = await request(app).post('/api/webhook/n8n').send(payload).expect(200);

      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toContain('Processed:');
    });

    test('should return 400 for invalid n8n payload', async () => {
      const response = await request(app).post('/api/webhook/n8n').send({}).expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
