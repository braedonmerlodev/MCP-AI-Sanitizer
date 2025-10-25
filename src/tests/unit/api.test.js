const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

  describe('POST /api/documents/upload', () => {
    test('should upload valid PDF file', async () => {
      // Create a mock PDF buffer (starts with %PDF-)
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      );

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', pdfBuffer, 'test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'PDF uploaded successfully');
      expect(response.body).toHaveProperty('fileName', 'test.pdf');
      expect(response.body).toHaveProperty('size');
      expect(response.body).toHaveProperty('status', 'uploaded');
    });

    test('should reject non-PDF files by extension', async () => {
      const textBuffer = Buffer.from('This is not a PDF file');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', textBuffer, 'test.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Only PDF files are allowed');
    });

    test('should reject files with wrong MIME type', async () => {
      const textBuffer = Buffer.from('This is not a PDF file');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', textBuffer, { filename: 'test.pdf', contentType: 'text/plain' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Only PDF files are allowed');
    });

    test('should reject files without PDF magic bytes', async () => {
      const fakePdfBuffer = Buffer.from('FAKE-PDF-Content');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', fakePdfBuffer, 'fake.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Only PDF files are allowed');
    });

    test('should reject files exceeding size limit', async () => {
      // Create a buffer larger than 25MB
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024, 'x'); // 26MB

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', largeBuffer, 'large.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('File too large');
    });

    test('should return 400 when no file is uploaded', async () => {
      const response = await request(app).post('/api/documents/upload').expect(400);

      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });
  });
});
