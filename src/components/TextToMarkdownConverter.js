const pdfParse = require('pdf-parse');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

class TextToMarkdownConverter {
  constructor() {
    this.markdownIt = new MarkdownIt();
  }

  /**
   * Extracts text from a PDF buffer
   * @param {Buffer} pdfBuffer - The PDF file buffer
   * @returns {Promise<Object>} - Object containing text and metadata
   */
  async extractText(pdfBuffer) {
    try {
      const data = await pdfParse(pdfBuffer);

      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
          title: data.info?.Title || 'Unknown',
          author: data.info?.Author || 'Unknown',
          creationDate: data.info?.CreationDate || new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('PDF text extraction failed:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Detects text structure (headings, paragraphs, lists)
   * @param {string} text - Raw extracted text
   * @returns {Object} - Structured text components
   */
  detectStructure(text) {
    const lines = text.split('\n').filter((line) => line.trim());

    const structure = {
      title: '',
      headings: [],
      paragraphs: [],
      lists: [],
    };

    let currentList = [];
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect potential headings (lines that are shorter and capitalized)
      if (trimmed.length < 100 && /^[A-Z]/.test(trimmed) && !trimmed.includes('.')) {
        if (structure.title) {
          structure.headings.push(trimmed);
        } else {
          structure.title = trimmed;
        }
        // End any current list
        if (inList) {
          structure.lists.push(currentList);
          currentList = [];
          inList = false;
        }
      }
      // Detect list items (starting with - or numbers)
      else if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
        currentList.push(trimmed);
        inList = true;
      }
      // Regular paragraph
      else if (trimmed) {
        if (inList) {
          structure.lists.push(currentList);
          currentList = [];
          inList = false;
        }
        structure.paragraphs.push(trimmed);
      }
    }

    // Add any remaining list
    if (currentList.length > 0) {
      structure.lists.push(currentList);
    }

    return structure;
  }

  /**
   * Converts structured text to Markdown
   * @param {Object} structure - Structured text components
   * @param {Object} metadata - Document metadata
   * @returns {string} - Markdown formatted text
   */
  convertToMarkdown(structure, metadata) {
    let markdown = '';

    // Add YAML frontmatter
    const frontmatter = {
      title: metadata.title,
      pages: metadata.pages,
      author: metadata.author,
      creation_date: metadata.creationDate,
      processed_at: new Date().toISOString(),
    };

    const frontmatterString = matter.stringify('', frontmatter);
    markdown += frontmatterString + '\n\n';

    // Add title as H1
    if (structure.title) {
      markdown += `# ${this.escapeMarkdown(structure.title)}\n\n`;
    }

    // Add headings and content
    for (const heading of structure.headings) {
      markdown += `## ${this.escapeMarkdown(heading)}\n\n`;
    }

    // Add paragraphs
    for (const paragraph of structure.paragraphs) {
      markdown += `${this.escapeMarkdown(paragraph)}\n\n`;
    }

    // Add lists
    for (const list of structure.lists) {
      for (const item of list) {
        markdown += `${item}\n`;
      }
      markdown += '\n';
    }

    // Add page breaks if multiple pages (simplified)
    if (metadata.pages > 1) {
      markdown += '---\n\n';
    }

    return markdown.trim();
  }

  /**
   * Escapes special Markdown characters
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeMarkdown(text) {
    // Escape basic Markdown characters that could cause issues
    return text
      .replaceAll('\\', '\\\\')
      .replaceAll('*', String.raw`\*`)
      .replaceAll('_', String.raw`\_`)
      .replaceAll('`', '\\`')
      .replaceAll('[', String.raw`\[`)
      .replaceAll(']', String.raw`\]`)
      .replaceAll('(', String.raw`\(`)
      .replaceAll(')', String.raw`\)`)
      .replaceAll('#', String.raw`\#`)
      .replaceAll('+', String.raw`\+`)
      .replaceAll('-', String.raw`\-`)
      .replaceAll('!', String.raw`\!`)
      .replaceAll('|', String.raw`\|`);
  }

  /**
   * Validates Markdown syntax
   * @param {string} markdown - Markdown text to validate
   * @returns {boolean} - True if valid
   */
  validateMarkdown(markdown) {
    try {
      this.markdownIt.parse(markdown);
      return true;
    } catch (error) {
      logger.error('Markdown validation failed:', error);
      return false;
    }
  }

  /**
   * Converts extracted text and metadata to Markdown
   * @param {string} text - Extracted text
   * @param {Object} metadata - Document metadata
   * @returns {string} - Markdown text
   */
  convertTextToMarkdown(text, metadata) {
    const structure = this.detectStructure(text);
    const markdown = this.convertToMarkdown(structure, metadata);

    if (!this.validateMarkdown(markdown)) {
      throw new Error('Generated Markdown is invalid');
    }

    return markdown;
  }

  /**
   * Converts a PDF buffer to Markdown
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {Promise<string>} - Markdown text
   */
  async convert(pdfBuffer) {
    const { text, metadata } = await this.extractText(pdfBuffer);
    return this.convertTextToMarkdown(text, metadata);
  }
}

module.exports = TextToMarkdownConverter;
