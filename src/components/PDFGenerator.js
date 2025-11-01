const PDFDocument = require('pdfkit');
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
      logger.info('Starting PDF generation', {
        contentLength: sanitizedContent.length,
        trustTokenPresent: !!trustToken,
      });

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: this.options.margin,
        info: {
          Title: metadata.title || 'Sanitized Document',
          Author: metadata.author || 'MCP Security System',
          Subject: metadata.subject || 'Verified Sanitized Content',
          Creator: 'MCP-Security PDF Generator',
          Producer: 'PDFKit',
          CreationDate: new Date(),
          ModDate: new Date(),
          Keywords: metadata.keywords || 'sanitized,verified,trust-token',
          // Embed trust token in custom metadata
          Custom: {
            TrustToken: JSON.stringify(trustToken),
            SanitizationTimestamp: new Date().toISOString(),
            ContentHash: trustToken?.contentHash || '',
            ValidationStatus: 'verified',
          },
        },
      });

      // Collect PDF data in buffer
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        logger.info('PDF document stream ended');
      });

      // Add title
      doc.fontSize(18).font('Helvetica-Bold');
      doc.text(metadata.title || 'Sanitized Document', { align: 'center' });
      doc.moveDown(2);

      // Reset to normal font
      doc.fontSize(this.options.fontSize).font('Helvetica');

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
              doc.font('Courier').fontSize(10);
              doc.text(code, {
                width: this.options.maxWidth,
                lineGap: 2,
              });
              doc.font('Helvetica').fontSize(this.options.fontSize);
              doc.moveDown(0.5);
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
            doc.moveDown(0.5);
            doc.fontSize(16).font('Helvetica-Bold');
            doc.text(line.slice(2), { lineGap: 5 });
            doc.fontSize(this.options.fontSize).font('Helvetica');
            doc.moveDown(0.5);
          } else if (line.startsWith('## ')) {
            // H2 heading
            doc.moveDown(0.5);
            doc.fontSize(14).font('Helvetica-Bold');
            doc.text(line.slice(3), { lineGap: 3 });
            doc.fontSize(this.options.fontSize).font('Helvetica');
            doc.moveDown(0.3);
          } else if (line.startsWith('### ')) {
            // H3 heading
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text(line.slice(4), { lineGap: 2 });
            doc.fontSize(this.options.fontSize).font('Helvetica');
            doc.moveDown(0.3);
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            // List items
            doc.text('• ' + line.slice(2), {
              width: this.options.maxWidth,
              indent: 10,
            });
          } else if (/^\d+\.\s/.test(line)) {
            // Numbered lists
            doc.text(line, {
              width: this.options.maxWidth,
              indent: 10,
            });
          } else if (line.trim() === '') {
            // Empty lines
            doc.moveDown(0.5);
          } else {
            // Regular paragraphs
            doc.text(line, {
              width: this.options.maxWidth,
              lineGap: 2,
              align: 'left',
            });
          }

          // Check if we need a new page
          if (doc.y > 700) {
            doc.addPage();
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
      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica-Oblique');
      doc.text('--- Document Verification ---', { align: 'center' });
      doc.text(`Trust Token: ${trustToken?.signature?.slice(0, 16)}...`, { align: 'center' });
      doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
      doc.text('This document has been sanitized and verified for secure AI processing.', {
        align: 'center',
      });

      // Finalize PDF
      doc.end();

      // Wait for PDF generation to complete
      await new Promise((resolve) => {
        doc.on('end', resolve);
      });

      const pdfBuffer = Buffer.concat(buffers);
      const endTime = Date.now();
      const finalMemoryUsage = process.memoryUsage();

      logger.info('PDF generation completed successfully', {
        generationTime: endTime - startTime,
        pdfSize: pdfBuffer.length,
        memoryDelta: finalMemoryUsage.heapUsed - memoryUsage.heapUsed,
        pages: doc.page,
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

      // Check for trust token metadata (basic check)
      const pdfContent = pdfBuffer.toString();
      const hasTrustToken = pdfContent.includes('TrustToken');
      const hasValidationStatus = pdfContent.includes('ValidationStatus');

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
