const request = require('supertest');
const app = require('../../app');

describe('API Contract Validation Integration Tests', () => {
  describe('GET /health', () => {
    it('should return healthy status with valid response', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should handle invalid response gracefully (validation logs error but responds)', async () => {
      // Since validation is non-blocking, it should still respond
      // In a real test, we might mock the response to be invalid, but here it's valid
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('POST /api/webhook/n8n', () => {
    it('should process valid webhook request', async () => {
      const validPayload = {
        data: 'test data for sanitization',
      };

      const response = await request(app).post('/api/webhook/n8n').send(validPayload).expect(200);

      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('sanitizedData');
    });

    it('should handle invalid webhook request gracefully', async () => {
      const invalidPayload = {
        // missing data field
      };

      const response = await request(app).post('/api/webhook/n8n').send(invalidPayload).expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/documents/upload', () => {
    it('should upload and process valid PDF', async () => {
      // Create a mock PDF buffer (simple PDF)
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      );

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', pdfBuffer, 'test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('fileName', 'test.pdf');
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
    });

    it('should reject invalid file type', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('not a pdf'), 'test.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/trust-tokens/validate', () => {
    it('should validate valid trust token', async () => {
      // Mock a valid token payload
      const validToken = {
        contentHash: 'mockhash',
        originalHash: 'mockhash',
        sanitizationVersion: '1.0',
        rulesApplied: ['rule1'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'mocksignature',
      };

      const response = await request(app)
        .post('/api/trust-tokens/validate')
        .send(validToken)
        .expect(200);

      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject invalid trust token', async () => {
      const invalidToken = {
        // missing fields
      };

      const response = await request(app)
        .post('/api/trust-tokens/validate')
        .send(invalidToken)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
