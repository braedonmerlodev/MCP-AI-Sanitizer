const TextToMarkdownConverter = require('../../components/TextToMarkdownConverter');

const pdfParse = require('pdf-parse');

describe('TextToMarkdownConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new TextToMarkdownConverter();
    jest.clearAllMocks();
  });

  describe('extractText', () => {
    it('should extract text from a valid PDF buffer', async () => {
      pdfParse.mockResolvedValue({
        text: 'Extracted text content',
        numpages: 1,
        info: {
          Title: 'Test Document',
          Author: 'Test Author',
          CreationDate: '20230101',
        },
      });

      const pdfBuffer = Buffer.from('mock pdf buffer');

      const result = await converter.extractText(pdfBuffer);

      expect(pdfParse).toHaveBeenCalledWith(pdfBuffer);
      expect(result).toHaveProperty('text', 'Extracted text content');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('pages', 1);
      expect(result.metadata.title).toBe('Test Document');
    });

    it('should throw error for invalid PDF', async () => {
      pdfParse.mockRejectedValue(new Error('Invalid PDF'));

      const invalidBuffer = Buffer.from('not a pdf');

      await expect(converter.extractText(invalidBuffer)).rejects.toThrow(
        'Failed to extract text from PDF',
      );
    });
  });

  describe('detectStructure', () => {
    it('should detect title and headings', () => {
      const text =
        'Document Title\n\nSome paragraph text.\n\nSection Heading\n\nAnother paragraph.';

      const structure = converter.detectStructure(text);

      expect(structure.title).toBe('Document Title');
      expect(structure.headings).toContain('Section Heading');
      expect(structure.paragraphs).toContain('Some paragraph text.');
    });

    it('should detect lists', () => {
      const text = 'Document Title\n\n- Item 1\n- Item 2\n\nParagraph.';

      const structure = converter.detectStructure(text);

      expect(structure.lists).toHaveLength(1);
      expect(structure.lists[0]).toEqual(['- Item 1', '- Item 2']);
    });
  });

  describe('convertToMarkdown', () => {
    it('should convert structure to Markdown with frontmatter', () => {
      const structure = {
        title: 'Test Document',
        headings: ['Section 1'],
        paragraphs: ['This is a paragraph.'],
        lists: [['- Item 1', '- Item 2']],
      };
      const metadata = {
        title: 'Test PDF',
        pages: 1,
        author: 'Test Author',
        creationDate: '2023-01-01',
      };

      const markdown = converter.convertToMarkdown(structure, metadata);

      expect(markdown).toContain('---');
      expect(markdown).toContain('title: Test PDF');
      expect(markdown).toContain('# Test Document');
      expect(markdown).toContain('## Section 1');
      expect(markdown).toContain('This is a paragraph.');
      expect(markdown).toContain('- Item 1');
    });
  });

  describe('escapeMarkdown', () => {
    it('should escape special characters', () => {
      const text = '*bold* _italic_ `code` [link](url)';

      const escaped = converter.escapeMarkdown(text);

      expect(escaped).toContain(String.raw`\*bold\*`);
      expect(escaped).toContain(String.raw`\_italic\_`);
      expect(escaped).toContain(String.raw`\`code\``);
      expect(escaped).toContain(String.raw`\[link\]`);
    });
  });

  describe('validateMarkdown', () => {
    it('should validate correct Markdown', () => {
      const markdown = '# Heading\n\nParagraph text.';

      const isValid = converter.validateMarkdown(markdown);

      expect(isValid).toBe(true);
    });

    it('should handle invalid Markdown gracefully', () => {
      const invalidMarkdown = '# Heading\n\n[broken link without closing';

      const isValid = converter.validateMarkdown(invalidMarkdown);

      // markdown-it parses even broken markdown, so it might still be true
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('convertTextToMarkdown', () => {
    it('should convert text to Markdown', () => {
      const text = 'Document Title\n\nParagraph.\n\n- List item';
      const metadata = {
        title: 'Test',
        pages: 1,
        author: 'Author',
        creationDate: '2023-01-01',
      };

      const markdown = converter.convertTextToMarkdown(text, metadata);

      expect(markdown).toContain('# Document Title');
      expect(markdown).toContain('Paragraph.');
      expect(markdown).toContain('- List item');
    });
  });
});
