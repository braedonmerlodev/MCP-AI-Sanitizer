const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Conditional Sanitization Integration', () => {
  test('should sanitize LLM-bound requests via /sanitize', async () => {
    const response = await request(app)
      .post('/api/sanitize')
      .set('X-Destination', 'llm')
      .send({ data: 'Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.sanitizedData).toBe('Helloworld');
  });

  test('should bypass sanitization for non-LLM requests via /sanitize', async () => {
    const response = await request(app)
      .post('/api/sanitize')
      .set('X-Destination', 'tool')
      .send({ data: 'Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.sanitizedData).toBe('Hello\u200Bworld');
  });

  test('should sanitize LLM requests via /webhook/n8n', async () => {
    const response = await request(app)
      .post('/api/webhook/n8n')
      .set('X-Destination', 'llm')
      .send({ data: 'Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.result).toBe('Processed: Helloworld');
  });

  test('should bypass sanitization for non-LLM requests via /webhook/n8n', async () => {
    const response = await request(app)
      .post('/api/webhook/n8n')
      .set('X-Destination', 'tool')
      .send({ data: 'Test with zero-width: Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.result).toBe('Processed: Test with zero-width: Hello\u200Bworld');
  });

  test('should default to sanitization for unclear requests', async () => {
    const response = await request(app).post('/api/sanitize').send({ data: 'Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.sanitizedData).toBe('Helloworld');
  });
});
