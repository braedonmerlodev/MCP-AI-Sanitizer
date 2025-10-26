const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../routes/api');

// Mock pdf-parse
jest.mock('pdf-parse', () => jest.fn());

// Mock the components
jest.mock('../../components/TextToMarkdownConverter', () => {
  return jest.fn().mockImplementation(() => ({
    extractText: jest.fn().mockResolvedValue({
      text: 'Mock extracted text',
      metadata: {
        title: 'Mock Title',
        pages: 1,
        author: 'Mock Author',
        creationDate: '2023-01-01',
      },
    }),
    convertTextToMarkdown: jest
      .fn()
      .mockReturnValue('---\ntitle: Mock Title\n---\n# Mock Title\n\nMock extracted text'),
  }));
});

jest.mock('../../components/sanitization-pipeline', () => {
  return jest.fn().mockImplementation(() => ({
    sanitize: jest.fn((text) => `sanitized-${text}`),
  }));
});

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('POST /api/documents/upload - Markdown Conversion', () => {
  it('should upload PDF and convert to Markdown when convert=markdown', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4\nmock pdf content');

    const response = await request(app)
      .post('/api/documents/upload?convert=markdown')
      .attach('pdf', pdfBuffer, 'test.pdf');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('markdown');
    expect(response.body.markdown).toContain('---');
    expect(response.body.markdown).toContain('title:');
    expect(response.body.message).toContain('converted to Markdown');
  });

  it('should upload PDF without conversion when no convert parameter', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4\nmock pdf content');

    const response = await request(app)
      .post('/api/documents/upload')
      .attach('pdf', pdfBuffer, 'test.pdf');

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('markdown');
    expect(response.body.message).toContain('uploaded successfully');
  });

  it('should return error for invalid PDF file', async () => {
    const invalidBuffer = Buffer.from('not a pdf');

    const response = await request(app)
      .post('/api/documents/upload?convert=markdown')
      .attach('pdf', invalidBuffer, 'invalid.pdf');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid file type');
  });

  it('should handle large files', async () => {
    // This would need a large PDF, but for now, test the limit
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB

    const response = await request(app)
      .post('/api/documents/upload')
      .attach('pdf', largeBuffer, 'large.pdf');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('File too large');
  });

  it('should return error for invalid PDF file', async () => {
    const invalidBuffer = Buffer.from('not a pdf');

    const response = await request(app)
      .post('/api/documents/upload?convert=markdown')
      .attach('pdf', invalidBuffer, 'invalid.pdf');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid file type');
  });

  it('should handle large files', async () => {
    // This would need a large PDF, but for now, test the limit
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB

    const response = await request(app)
      .post('/api/documents/upload')
      .attach('pdf', largeBuffer, 'large.pdf');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('File too large');
  });
});
