const request = require('supertest');
const express = require('express');

// Mock pdf-parse for testing
jest.mock('pdf-parse', () =>
  jest.fn().mockResolvedValue({
    text: 'Test Document\n\nThis is a test PDF document.\n\nSection 1\n\n- Item 1\n- Item 2\n\n1. Numbered item\n2. Another item',
    numpages: 5,
    info: {
      Title: 'Test PDF Document',
      Author: 'Test Author',
      Subject: 'Test Subject',
      Creator: 'Test Creator',
      Producer: 'Test Producer',
      CreationDate: 'D:20231101120000',
      ModDate: 'D:20231101120000',
    },
    metadata: {},
    pages: [],
  }),
);

// Helper functions for mock implementations
const createMarkdownConverterMock = () => ({
  convert: jest
    .fn()
    .mockReturnValue(
      '# Test Document\n\nThis is a test PDF document.\n\n## Section 1\n\n- Item 1\n- Item 2\n\n1. Numbered item\n2. Another item',
    ),
});

const createAccessControlEnforcerMock = () => ({
  enforce: jest.fn().mockReturnValue({ allowed: true }),
});

// Mock MarkdownConverter for testing
jest.mock('../../components/MarkdownConverter', () => {
  return jest.fn().mockImplementation(createMarkdownConverterMock);
});

// Mock access validation middleware for testing
jest.mock('../../middleware/AccessValidationMiddleware', () => {
  return jest.fn((req, res, next) => next());
});

// Mock access control enforcer for testing
jest.mock('../../components/AccessControlEnforcer', () => {
  return jest.fn().mockImplementation(createAccessControlEnforcerMock);
});

// Mock multer for testing file size limit violations
const multerSingleFn = (req, res, next) => next();
const mockMulterSingle = jest.fn(() => multerSingleFn);

// Helper functions for test arrow functions
const createMulterErrorHandlerFn = function (error) {
  return function (req, res, next) {
    next(error);
  };
};
const createMulterSuccessHandlerFn = function () {
  return function (req, res, next) {
    next();
  };
};
jest.mock('multer', () => {
  const multerMock = jest.fn(() => ({
    single: mockMulterSingle,
  }));
  multerMock.diskStorage = jest.fn();
  multerMock.memoryStorage = jest.fn();
  multerMock.MulterError = class MulterError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = 'MulterError';
    }
  };
  return multerMock;
});

// Mock TrustTokenGenerator for testing
jest.mock('../../components/TrustTokenGenerator', () => {
  return jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockReturnValue({
      contentHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72', // hash calculated in code
      originalHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
      sanitizationVersion: '1.0',
      rulesApplied: ['rule1'],
      timestamp: '2025-11-08T22:12:06.323Z',
      expiresAt: '2025-11-08T23:12:06.323Z',
      signature: 'mocksignature',
    }),
    validateToken: jest.fn().mockReturnValue({ isValid: true }),
  }));
});

const apiRoutes = require('../../routes/api');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRoutes);

describe('API Routes', () => {
  beforeAll(() => {
    // Set environment variable for trust token secret in tests
    process.env.TRUST_TOKEN_SECRET = 'test-secret-for-api-tests';
  });

  afterAll(() => {
    // Clean up
    delete process.env.TRUST_TOKEN_SECRET;
  });

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
      expect(response.body.result.sanitizedData).toContain('Processed:');
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

      expect(response.body).toHaveProperty('message', 'PDF uploaded and processed successfully');
      expect(response.body).toHaveProperty('fileName', 'test.pdf');
      expect(response.body).toHaveProperty('size');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('pages', 5);
      expect(response.body.metadata).toHaveProperty('title', 'Test PDF Document');
      expect(response.body.metadata).toHaveProperty('author', 'Test Author');
      expect(response.body.metadata).toHaveProperty('encoding', 'utf8');
      expect(response.body).toHaveProperty('status', 'processed');
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(typeof response.body.sanitizedContent).toBe('string');
      expect(response.body.trustToken).toHaveProperty('contentHash');
      expect(response.body.trustToken).toHaveProperty('signature');
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

    test('should reject executable files', async () => {
      const exeBuffer = Buffer.from('MZ fake exe content');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', exeBuffer, 'malware.exe')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Only PDF files are allowed');
    });

    test('should reject files with missing or malformed file type metadata', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nfake content');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', pdfBuffer, { filename: 'test.pdf', contentType: 'malformed/type' }) // Malformed contentType
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

    test('should accept valid ai_transform=true query parameter', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      );

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .attach('pdf', pdfBuffer, 'test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'PDF uploaded and processed successfully');
    });

    test('should accept ai_transform=false query parameter', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      );

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=false')
        .attach('pdf', pdfBuffer, 'test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'PDF uploaded and processed successfully');
    });

    test('should reject invalid ai_transform query parameter', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      );

      const response = await request(app)
        .post('/api/documents/upload?ai_transform=invalid')
        .attach('pdf', pdfBuffer, 'test.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('ai_transform');
    });

    test('should accept valid sync query parameter', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      );

      const response = await request(app)
        .post('/api/documents/upload?sync=true')
        .attach('pdf', pdfBuffer, 'test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'PDF uploaded and processed successfully');
    });

    test('should reject invalid sync query parameter', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      );

      const response = await request(app)
        .post('/api/documents/upload?sync=maybe')
        .attach('pdf', pdfBuffer, 'test.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('sync');
    });

    test('should handle multer LIMIT_FILE_SIZE error for file exceeding configured limit', async () => {
      // Mock multer to trigger LIMIT_FILE_SIZE error for files exceeding 25MB
      const multer = require('multer');
      const mockMulterError = new multer.MulterError('LIMIT_FILE_SIZE');
      mockMulterError.code = 'LIMIT_FILE_SIZE';

      // Mock the single method to call next with the error
      mockMulterSingle.mockImplementationOnce(createMulterErrorHandlerFn(mockMulterError));

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('%PDF-1.4\nfake content'), 'large.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'File too large. Maximum size is 25MB.');

      // Reset the mock
      mockMulterSingle.mockReset();
      mockMulterSingle.mockImplementation(createMulterSuccessHandlerFn());
    });

    test('should handle mocked file type validation rejection', async () => {
      // Mock multer to simulate file type validation rejection
      const fileTypeError = new Error('Only PDF files are allowed');
      mockMulterSingle.mockImplementationOnce(createMulterErrorHandlerFn(fileTypeError));

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('not a pdf'), 'test.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Only PDF files are allowed');

      // Reset the mock
      mockMulterSingle.mockReset();
      mockMulterSingle.mockImplementation(createMulterSuccessHandlerFn());
    });

    test('should handle multer LIMIT_FILE_SIZE error for edge case near file size limit', async () => {
      // Mock multer to trigger LIMIT_FILE_SIZE error for files at the edge of the limit
      const multer = require('multer');
      const mockMulterError = new multer.MulterError('LIMIT_FILE_SIZE');
      mockMulterError.code = 'LIMIT_FILE_SIZE';

      // Mock the single method to call next with the error for a file just over the limit
      mockMulterSingle.mockImplementationOnce(createMulterErrorHandlerFn(mockMulterError));

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('%PDF-1.4\nedge case content'), 'edge-case.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'File too large. Maximum size is 25MB.');

      // Reset the mock
      mockMulterSingle.mockReset();
      mockMulterSingle.mockImplementation(createMulterSuccessHandlerFn());
    });
  });

  describe('POST /api/documents/generate-pdf', () => {
    let validTrustToken;

    beforeAll(() => {
      // Create a valid trust token for testing
      const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
      const generator = new TrustTokenGenerator({ secret: process.env.TRUST_TOKEN_SECRET });
      validTrustToken = generator.generateToken('test content', 'original content', ['rule1']);
      // Serialize dates for API
      validTrustToken.timestamp = validTrustToken.timestamp.toISOString();
      validTrustToken.expiresAt = validTrustToken.expiresAt.toISOString();
    });

    test('should generate PDF from sanitized content with trust token', async () => {
      const requestData = {
        data: '# Test Document\n\nThis is sanitized content.',
        trustToken: validTrustToken,
        metadata: {
          title: 'Test PDF',
          author: 'Test Author',
        },
      };

      const response = await request(app)
        .post('/api/documents/generate-pdf')
        .send(requestData)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['x-trust-token-status']).toBe('embedded');
      expect(response.headers['x-pdf-validation']).toBe('high');

      // Verify PDF content
      const pdfBuffer = Buffer.from(response.body);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 4).toString()).toBe('%PDF');
    });

    test('should reject requests without trust token', async () => {
      const requestData = {
        data: 'test content without trust token',
      };

      const response = await request(app)
        .post('/api/documents/generate-pdf')
        .send(requestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Trust token is required');
    });

    test('should reject invalid input data', async () => {
      const response = await request(app)
        .post('/api/documents/generate-pdf')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle empty content', async () => {
      const requestData = {
        data: '',
        trustToken: validTrustToken,
      };

      const response = await request(app)
        .post('/api/documents/generate-pdf')
        .send(requestData)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      const pdfBuffer = Buffer.from(response.body);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/trust-tokens/validate', () => {
    let validToken;

    beforeAll(() => {
      // Create a valid token for testing
      const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
      const generator = new TrustTokenGenerator({ secret: process.env.TRUST_TOKEN_SECRET });
      validToken = generator.generateToken('test content', 'original content', ['rule1']);
      // Serialize dates for API
      validToken.timestamp = validToken.timestamp.toISOString();
      validToken.expiresAt = validToken.expiresAt.toISOString();
    });

    test('should validate a correct trust token', async () => {
      const response = await request(app)
        .post('/api/trust-tokens/validate')
        .send(validToken)
        .expect(200);

      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('message', 'Trust token is valid');
    });

    test('should reject an invalid trust token', async () => {
      const invalidToken = { ...validToken, signature: 'invalid-signature' };

      const response = await request(app)
        .post('/api/trust-tokens/validate')
        .send(invalidToken)
        .expect(400);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('error', 'Invalid token signature');
    });

    test('should reject an expired trust token', async () => {
      const expiredToken = {
        ...validToken,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };

      const response = await request(app)
        .post('/api/trust-tokens/validate')
        .send(expiredToken)
        .expect(410);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('error', 'Token has expired');
    });

    test('should return 400 for invalid request body', async () => {
      const response = await request(app)
        .post('/api/trust-tokens/validate')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/sanitize/json', () => {
    test('should sanitize valid JSON content and return trust token', async () => {
      const requestData = {
        content: 'Test content with\u200Bhidden\u200Cchars', // zero-width chars
        classification: 'test',
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.sanitizedContent).toBe('Test content withhiddenchars'); // zero-width removed
      expect(response.body.trustToken).toHaveProperty('contentHash');
      expect(response.body.trustToken).toHaveProperty('signature');
      expect(response.body.metadata).toHaveProperty('originalLength', requestData.content.length);
      expect(response.body.metadata).toHaveProperty('sanitizedLength');
      expect(response.body.metadata).toHaveProperty('timestamp');
    });

    test('should sanitize content without optional classification', async () => {
      const requestData = {
        content: 'Test content',
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('metadata');
    });

    test('should return 400 for missing content field', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ classification: 'test' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should return 400 for invalid request format', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle sanitization errors gracefully', async () => {
      // Mock sanitization failure
      const originalSanitize = require('../../components/proxy-sanitizer').prototype.sanitize;
      require('../../components/proxy-sanitizer').prototype.sanitize = jest
        .fn()
        .mockRejectedValue(new Error('Sanitization failed'));

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content: 'test content' })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Sanitization failed');

      // Restore original
      require('../../components/proxy-sanitizer').prototype.sanitize = originalSanitize;
    });

    test('should reuse sanitized content with valid trust token', async () => {
      // Mock validateToken to return valid
      const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
      const generator = new TrustTokenGenerator();
      generator.validateToken.mockReturnValue({ isValid: true });

      const sanitizedContent = 'test content';
      const validToken = generator.generateToken();

      const requestData = {
        content: sanitizedContent,
        trustToken: validToken,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent', sanitizedContent);
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.trustToken).toHaveProperty('contentHash', validToken.contentHash);
      expect(response.body.trustToken).toHaveProperty('signature', validToken.signature);
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('reused', true);
      expect(response.body.metadata).toHaveProperty('originalLength', sanitizedContent.length);
      expect(response.body.metadata).toHaveProperty('sanitizedLength', sanitizedContent.length);
      expect(response.body.metadata).toHaveProperty('performance');
      expect(response.body.metadata.performance).toHaveProperty('totalTimeMs');
      expect(response.body.metadata.performance).toHaveProperty('tokenValidationTimeMs');
      expect(response.body.metadata.performance).toHaveProperty('timeSavedMs', 50);
    });

    test('should sanitize normally with invalid trust token', async () => {
      // Override mock validateToken to return invalid
      const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
      const generator = new TrustTokenGenerator();
      generator.validateToken.mockReturnValueOnce({ isValid: false });

      const invalidToken = {
        contentHash: 'invalid',
        originalHash: 'invalid',
        sanitizationVersion: '1.0',
        rulesApplied: ['rule1'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'invalid',
      };

      const requestData = {
        content: 'test content with\u200Bhidden\u200C',
        trustToken: invalidToken,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('reused', false);
      expect(response.body.sanitizedContent).toBe('test content withhidden'); // zero-width removed
    });

    test('should sanitize normally when content hash does not match trust token', async () => {
      // Mock validateToken to return valid, but content hash won't match
      const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
      const generator = new TrustTokenGenerator();
      generator.validateToken.mockReturnValue({ isValid: true });

      const token = generator.generateToken(); // Uses mock hash for 'test content'

      const requestData = {
        content: 'different content', // Different content, hash won't match
        trustToken: token,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('reused', false);
    });

    test('should prevent token tampering attacks', async () => {
      // Create a valid token then tamper with it
      const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
      const generator = new TrustTokenGenerator();
      const validToken = generator.generateToken();

      // Tamper with the signature
      const tamperedToken = { ...validToken, signature: 'tampered-signature' };

      const requestData = {
        content: 'test content',
        trustToken: tamperedToken,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      // Should fall back to sanitization
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('reused', false);
    });

    test('should handle expired tokens gracefully', async () => {
      // Create an expired token
      const expiredToken = {
        contentHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
        originalHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
        sanitizationVersion: '1.0',
        rulesApplied: ['rule1'],
        timestamp: '2025-11-08T22:12:06.323Z',
        expiresAt: '2025-11-07T22:12:06.323Z', // Expired
        signature: 'mocksignature',
      };

      const requestData = {
        content: 'test content',
        trustToken: expiredToken,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      // Should fall back to sanitization
      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('reused', false);
    });

    test('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/sanitize/json')
        .set('Content-Type', 'application/json')
        .send('{invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle very large content gracefully', async () => {
      const largeContent = 'a'.repeat(100_000);
      const requestData = {
        content: largeContent,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.metadata).toHaveProperty('originalLength', largeContent.length);
    });

    test('should handle content with special characters', async () => {
      const specialContent = 'Content with éñü ñoños @#$%^&*()[]{}';
      const requestData = {
        content: specialContent,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
    });

    test('should handle empty content string', async () => {
      const requestData = {
        content: '',
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent', '');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.metadata).toHaveProperty('originalLength', 0);
    });

    test('should handle content with only whitespace', async () => {
      const whitespaceContent = '   \n\t  ';
      const requestData = {
        content: whitespaceContent,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
    });

    test('should handle content with unicode characters', async () => {
      const unicodeContent = 'Unicode: 🚀 🌟 💻 🔒';
      const requestData = {
        content: unicodeContent,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
    });

    test('should handle very large content gracefully', async () => {
      const largeContent = 'a'.repeat(100_000); // 100KB content
      const requestData = {
        content: largeContent,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.sanitizedContent.length).toBe(largeContent.length);
    });

    test('should handle content with special characters', async () => {
      const specialContent = 'Content with <script>alert("xss")</script> and &lt;tags&gt;';
      const requestData = {
        content: specialContent,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.sanitizedContent).not.toContain('<script>');
    });

    test('should handle empty content', async () => {
      const requestData = {
        content: '',
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.sanitizedContent).toBe('');
    });

    test('should handle whitespace-only content', async () => {
      const requestData = {
        content: '   \n\t  ',
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.sanitizedContent).toBe('   \n\t  ');
    });

    test('should handle unicode characters', async () => {
      const unicodeContent = 'Content with émojis 😀 and 中文';
      const requestData = {
        content: unicodeContent,
      };

      const response = await request(app).post('/api/sanitize/json').send(requestData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');
      expect(response.body.sanitizedContent).toBe(unicodeContent);
    });
  });
});
