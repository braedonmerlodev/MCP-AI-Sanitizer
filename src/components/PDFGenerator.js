const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * PDFGenerator handles the creation of clean, validated PDFs from sanitized content
 * with embedded trust tokens and metadata.
 */
class PDFGenerator {
  constructor(options = {}) {
    this.options = {
      fontSize: options.fontSize || 12,
      lineHeight: options.lineHeight || 1.4,
      margin: options.margin || 50,
      maxWidth: options.maxWidth || 500,
      ...options,
    };
  }

  /**
   * Generates a PDF from sanitized Markdown content with embedded trust token
   * @param {string} sanitizedContent - The sanitized Markdown content
   * @param {Object} trustToken - The trust token object
   * @param {Object} metadata - Additional metadata for the PDF
   * @returns {Buffer} PDF buffer
   */
  async generatePDF(sanitizedContent, trustToken, metadata = {}) {
    const startTime = Date.now();
    let memoryUsage = process.memoryUsage();

    try {
      if (!trustToken) {
        throw new Error('Trust token is required for PDF generation');
      }

      logger.info('Starting PDF generation', {
        contentLength: sanitizedContent.length,
        trustTokenPresent: !!trustToken,
      });

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage();
      const { height } = page.getSize();

      const font = await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);
      const obliqueFont = await pdfDoc.embedStandardFont(StandardFonts.HelveticaOblique);
      const courierFont = await pdfDoc.embedStandardFont(StandardFonts.Courier);

      // Set metadata
      pdfDoc.setTitle(metadata.title || 'Sanitized Document');
      pdfDoc.setAuthor(metadata.author || 'MCP Security System');
      pdfDoc.setSubject(metadata.subject || 'Verified Sanitized Content');
      pdfDoc.setCreator('MCP-Security PDF Generator');
      pdfDoc.setProducer('pdf-lib');
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());
      pdfDoc.setKeywords([
        metadata.keywords || 'sanitized,verified,trust-token',
        JSON.stringify(trustToken),
      ]);

      // Add title
      page.drawText(metadata.title || 'Sanitized Document', {
        x: 50,
        y: height - 50,
        font: boldFont,
        size: 18,
        color: rgb(0, 0, 0),
      });
      let y = height - 80;

      // Process content line by line
      const lines = sanitizedContent.split('\n');
      let inCodeBlock = false;
      let codeBlockContent = [];

      for (const line of lines) {
        try {
          if (line.startsWith('```')) {
            // Handle code blocks
            if (inCodeBlock) {
              // End code block
              const code = codeBlockContent.join('\n');
              page.drawText(code, {
                x: 50,
                y,
                font: courierFont,
                size: 10,
                color: rgb(0, 0, 0),
              });
              y -= 12;
              inCodeBlock = false;
              codeBlockContent = [];
            } else {
              // Start code block
              inCodeBlock = true;
            }
          } else if (inCodeBlock) {
            codeBlockContent.push(line);
          } else if (line.startsWith('# ')) {
            // H1 heading
            y -= 10;
            page.drawText(line.slice(2), {
              x: 50,
              y,
              font: boldFont,
              size: 16,
              color: rgb(0, 0, 0),
            });
            y -= 18;
          } else if (line.startsWith('## ')) {
            // H2 heading
            y -= 5;
            page.drawText(line.slice(3), {
              x: 50,
              y,
              font: boldFont,
              size: 14,
              color: rgb(0, 0, 0),
            });
            y -= 16;
          } else if (line.startsWith('### ')) {
            // H3 heading
            page.drawText(line.slice(4), {
              x: 50,
              y,
              font: boldFont,
              size: 12,
              color: rgb(0, 0, 0),
            });
            y -= 14;
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            // List items
            page.drawText('• ' + line.slice(2), {
              x: 60,
              y,
              font,
              size: this.options.fontSize,
              color: rgb(0, 0, 0),
            });
            y -= this.options.lineHeight;
          } else if (/^\d+\.\s/.test(line)) {
            // Numbered lists
            page.drawText(line, {
              x: 60,
              y,
              font,
              size: this.options.fontSize,
              color: rgb(0, 0, 0),
            });
            y -= this.options.lineHeight;
          } else if (line.trim() === '') {
            // Empty lines
            y -= this.options.lineHeight;
          } else {
            // Regular paragraphs
            page.drawText(line, {
              x: 50,
              y,
              font,
              size: this.options.fontSize,
              color: rgb(0, 0, 0),
            });
            y -= this.options.lineHeight;
          }

          // Check if we need a new page
          if (y < 50) {
            page = pdfDoc.addPage();
            y = height - 50;
          }
        } catch (lineError) {
          logger.warn('Error processing line in PDF generation', {
            error: lineError.message,
            line: line.slice(0, 100),
          });
          // Continue with next line
        }
      }

      // Add trust token verification footer
      y -= 20;
      page.drawText('--- Document Verification ---', {
        x: 50,
        y,
        font: obliqueFont,
        size: 10,
        color: rgb(0, 0, 0),
      });
      y -= 12;
      page.drawText(`Trust Token: ${trustToken?.signature?.slice(0, 16)}...`, {
        x: 50,
        y,
        font,
        size: 10,
        color: rgb(0, 0, 0),
      });
      y -= 12;
      page.drawText(`Generated: ${new Date().toISOString()}`, {
        x: 50,
        y,
        font,
        size: 10,
        color: rgb(0, 0, 0),
      });
      y -= 12;
      page.drawText('This document has been sanitized and verified for secure AI processing.', {
        x: 50,
        y,
        font,
        size: 10,
        color: rgb(0, 0, 0),
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);
      const endTime = Date.now();
      const finalMemoryUsage = process.memoryUsage();

      logger.info('PDF generation completed successfully', {
        generationTime: endTime - startTime,
        pdfSize: pdfBuffer.length,
        memoryDelta: finalMemoryUsage.heapUsed - memoryUsage.heapUsed,
        pages: pdfDoc.getPageCount(),
      });

      return pdfBuffer;
    } catch (error) {
      logger.error('PDF generation failed', {
        error: error.message,
        contentLength: sanitizedContent.length,
        generationTime: Date.now() - startTime,
      });
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Validates PDF output quality and structure
   * @param {Buffer} pdfBuffer - The generated PDF buffer
   * @returns {Object} Validation results
   */
  validatePDF(pdfBuffer) {
    try {
      // Basic validation - check PDF header
      if (!pdfBuffer || pdfBuffer.length < 4) {
        return { isValid: false, error: 'PDF buffer is too small' };
      }

      const header = pdfBuffer.slice(0, 4).toString();
      if (header !== '%PDF') {
        return { isValid: false, error: 'Invalid PDF header' };
      }

      // Check for trust token in content (basic check)
      const pdfContent = pdfBuffer.toString();
      const hasTrustToken = pdfContent.includes('Trust Token');
      const hasValidationStatus =
        pdfContent.includes('Document Verification') || pdfContent.includes('verified');

      return {
        isValid: true,
        size: pdfBuffer.length,
        hasTrustToken,
        hasValidationStatus,
        quality: hasTrustToken && hasValidationStatus ? 'high' : 'medium',
      };
    } catch (error) {
      logger.error('PDF validation failed', { error: error.message });
      return { isValid: false, error: error.message };
    }
  }
}

module.exports = PDFGenerator;
