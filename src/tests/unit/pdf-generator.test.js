const PDFGenerator = require('../../components/PDFGenerator');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
const pdfParse = require('pdf-parse');

describe('PDFGenerator', () => {
  let pdfGenerator;
  let trustTokenGenerator;
  let validTrustToken;

  beforeAll(() => {
    // Set environment variable for trust token secret in tests
    process.env.TRUST_TOKEN_SECRET = 'test-secret-for-pdf-tests';
  });

  afterAll(() => {
    // Clean up
    delete process.env.TRUST_TOKEN_SECRET;
  });

  beforeEach(() => {
    pdfGenerator = new PDFGenerator();
    trustTokenGenerator = new TrustTokenGenerator({ secret: process.env.TRUST_TOKEN_SECRET });
    validTrustToken = trustTokenGenerator.generateToken('test content', 'original content', [
      'rule1',
    ]);
    // Serialize dates for API compatibility
    validTrustToken.timestamp = validTrustToken.timestamp.toISOString();
    validTrustToken.expiresAt = validTrustToken.expiresAt.toISOString();
  });

  describe('generatePDF', () => {
    test('should generate a valid PDF from sanitized content with trust token', async () => {
      const sanitizedContent = `# Test Document

This is a test document with various formatting.

## Section 1

- Item 1
- Item 2

1. Numbered item
2. Another item

Some regular paragraph text.

\`\`\`
code block
with multiple lines
\`\`\`
`;

      const metadata = {
        title: 'Test PDF Document',
        author: 'Test Author',
        subject: 'Test Subject',
      };

      const pdfBuffer = await pdfGenerator.generatePDF(sanitizedContent, validTrustToken, metadata);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // Validate PDF structure
      const validation = pdfGenerator.validatePDF(pdfBuffer);
      expect(validation.isValid).toBe(true);

      // Note: pdf-lib generated PDFs are compatible with pdf-parse for text extraction
    });

    test('should handle empty content gracefully', async () => {
      const pdfBuffer = await pdfGenerator.generatePDF('', validTrustToken, {});

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      const validation = pdfGenerator.validatePDF(pdfBuffer);
      expect(validation.isValid).toBe(true);
    });

    test('should reject requests without trust token', async () => {
      await expect(pdfGenerator.generatePDF('test content', null, {})).rejects.toThrow();
    });

    test('should handle malformed trust token gracefully', async () => {
      const malformedToken = { invalid: 'token' };
      const pdfBuffer = await pdfGenerator.generatePDF('test content', malformedToken, {});
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      // Should still generate PDF even with malformed token
    });

    test('should process various Markdown elements correctly', async () => {
      const complexContent = `# Main Title

## Subtitle

### Sub-subtitle

Regular paragraph with **bold** and *italic* text.

- List item 1
- List item 2
  - Nested item

1. Numbered item 1
2. Numbered item 2

\`\`\`javascript
function test() {
  return true;
}
\`\`\`

> Blockquote text

---

Horizontal rule above.
`;

      const pdfBuffer = await pdfGenerator.generatePDF(complexContent, validTrustToken, {});
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      const validation = pdfGenerator.validatePDF(pdfBuffer);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('validatePDF', () => {
    test('should validate correct PDF buffer', () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4\nTrust Token\nDocument Verification');

      const result = pdfGenerator.validatePDF(mockPdfBuffer);
      expect(result.isValid).toBe(true);
      expect(result.hasTrustToken).toBe(true);
      expect(result.hasValidationStatus).toBe(true);
      expect(result.quality).toBe('high');
    });

    test('should reject invalid PDF buffer', () => {
      const invalidBuffer = Buffer.from('not a pdf');

      const result = pdfGenerator.validatePDF(invalidBuffer);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid PDF header');
    });

    test('should reject empty buffer', () => {
      const result = pdfGenerator.validatePDF(Buffer.alloc(0));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too small');
    });

    test('should handle buffer without trust token metadata', () => {
      const pdfWithoutToken = Buffer.from('%PDF-1.4\nno trust token here\nDocument Verification');

      const result = pdfGenerator.validatePDF(pdfWithoutToken);
      expect(result.isValid).toBe(true);
      expect(result.hasTrustToken).toBe(false);
      expect(result.quality).toBe('medium');
    });
  });

  describe('PDF Workflow Integration', () => {
    test('should support full PDF generate -> extract workflow (integration test)', async () => {
      const testContent = `# Integration Test Document

This is test content for verifying the PDF generation and text extraction workflow.

## Features Tested

- PDF generation with pdf-lib
- Text extraction with pdf-parse
- Compatibility between libraries

End of test content.
`;

      // Generate PDF
      const pdfBuffer = await pdfGenerator.generatePDF(testContent, validTrustToken, {
        title: 'Integration Test PDF',
        author: 'Test Suite',
      });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // Extract text using pdf-parse
      const pdfData = await pdfParse(pdfBuffer);
      const extractedText = pdfData.text;

      // Verify text extraction works
      expect(extractedText).toContain('Integration Test Document');
      expect(extractedText).toContain('test content for verifying');
      expect(extractedText).toContain('PDF generation with pdf-lib');
      expect(extractedText).toContain('Text extraction with pdf-parse');
      expect(extractedText).toContain('Compatibility between libraries');
      expect(extractedText).toContain('End of test content');
    });

    test('should handle user-uploaded PDF processing (regression test)', async () => {
      // For regression test, simulate a PDF that is "user-uploaded" but generated with pdf-lib
      // This ensures that PDFs created with the new library can be processed
      const userContent = `User Uploaded PDF Content

This content simulates text from a PDF uploaded by a user.
It should be extractable using pdf-parse after the library change.

Key points:
- Regression testing for PDF processing
- Ensures compatibility with pdf-lib generated PDFs
- Verifies text extraction functionality
`;

      const userPdfBuffer = await pdfGenerator.generatePDF(userContent, validTrustToken, {
        title: 'User Uploaded PDF',
      });

      // Extract text
      const pdfData = await pdfParse(userPdfBuffer);
      const extractedText = pdfData.text;

      // Verify extraction
      expect(extractedText).toContain('User Uploaded PDF Content');
      expect(extractedText).toContain('simulates text from a PDF');
      expect(extractedText).toContain('Regression testing for PDF processing');
      expect(extractedText).toContain('Ensures compatibility with pdf-lib');
      expect(extractedText).toContain('Verifies text extraction functionality');
    });
  });
});
