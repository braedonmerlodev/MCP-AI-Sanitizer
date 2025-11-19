const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Conditional Sanitization Integration', () => {
  test('should sanitize LLM-bound requests via /sanitize/json', async () => {
    const response = await request(app)
      .post('/api/sanitize/json')
      .set('X-Destination', 'llm')
      .send({ content: 'Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.sanitizedContent).toBe('Helloworld');
  });

  test('should bypass sanitization for non-LLM requests via /sanitize/json', async () => {
    const response = await request(app)
      .post('/api/sanitize/json')
      .set('X-Destination', 'tool')
      .send({ content: 'Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.sanitizedContent).toBe('Hello\u200Bworld');
  });

  test('should sanitize LLM requests via /webhook/n8n', async () => {
    const response = await request(app)
      .post('/api/webhook/n8n')
      .set('X-Destination', 'llm')
      .send({ data: 'Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.result.sanitizedData).toBe('Processed: Helloworld');
  });

  test('should bypass sanitization for non-LLM requests via /webhook/n8n', async () => {
    const response = await request(app)
      .post('/api/webhook/n8n')
      .set('X-Destination', 'tool')
      .send({ data: 'Test with zero-width: Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.result.sanitizedData).toBe(
      'Processed: Test with zero-width: Hello\u200Bworld',
    );
  });

  test('should default to sanitization for unclear requests', async () => {
    const response = await request(app)
      .post('/api/sanitize/json')
      .send({ content: 'Hello\u200Bworld' });

    expect(response.status).toBe(200);
    expect(response.body.sanitizedContent).toBe('Helloworld');
  });
});
