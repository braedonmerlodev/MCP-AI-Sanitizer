const request = require('supertest');
const express = require('express');
const destinationTracking = require('../../middleware/destination-tracking');

// Create a test app with the middleware
const app = express();
app.use(express.json());

// Mock route that returns the classification metadata
app.post('/test-classification', destinationTracking, (req, res) => {
  res.json({
    classification: req.destinationTracking.classification,
    confidence: req.destinationTracking.confidence,
    indicators: req.destinationTracking.indicators,
  });
});

describe('Destination Tracking Integration', () => {
  describe('API endpoint classification', () => {
    test('should classify LLM-bound request with header', async () => {
      const response = await request(app)
        .post('/test-classification')
        .set('X-Destination', 'llm')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        classification: 'llm',
        confidence: 1,
        indicators: ['header:X-Destination=llm', 'content-type:application/json'],
      });
    });

    test('should classify non-LLM request with file path', async () => {
      const response = await request(app).post('/test-classification').send({ data: 'test' });

      // Since path is /test-classification, no file indicators, should be unclear
      expect(response.status).toBe(200);
      expect(response.body.classification).toBe('unclear');
    });

    test('should handle JSON content type', async () => {
      const response = await request(app)
        .post('/test-classification')
        .set('Content-Type', 'application/json')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.indicators).toContain('content-type:application/json');
      expect(response.body.confidence).toBeGreaterThan(0);
    });

    test('should handle text content type', async () => {
      const response = await request(app)
        .post('/test-classification')
        .set('Content-Type', 'text/plain')
        .send('test data');

      expect(response.status).toBe(200);
      expect(response.body.indicators).toContain('content-type:text/plain');
      expect(response.body.confidence).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/test-classification')
        .set('Content-Type', 'invalid')
        .send('invalid data');

      expect(response.status).toBe(200);
      // Should still classify, even with potential errors
      expect(response.body).toHaveProperty('classification');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('indicators');
    });
  });
});
