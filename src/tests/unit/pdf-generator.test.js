const PDFGenerator = require('../../components/PDFGenerator');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

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
      expect(validation.hasTrustToken).toBe(true);
      expect(validation.hasValidationStatus).toBe(true);
      expect(validation.quality).toBe('high');
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

    test('should handle malformed trust token', async () => {
      const malformedToken = { invalid: 'token' };
      await expect(pdfGenerator.generatePDF('test content', malformedToken, {})).rejects.toThrow();
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
      const mockPdfBuffer = Buffer.from('%PDF-1.4\n...TrustToken...ValidationStatus...');

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
      const pdfWithoutToken = Buffer.from('%PDF-1.4\n...no trust token...');

      const result = pdfGenerator.validatePDF(pdfWithoutToken);
      expect(result.isValid).toBe(true);
      expect(result.hasTrustToken).toBe(false);
      expect(result.quality).toBe('medium');
    });
  });
});
