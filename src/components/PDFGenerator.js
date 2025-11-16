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

    return new Promise((resolve, reject) => {
      try {
        if (!trustToken) {
          throw new Error('Trust token is required for PDF generation');
        }

        logger.info('Starting PDF generation', {
          contentLength: sanitizedContent.length,
          trustTokenPresent: !!trustToken,
        });

        // Create PDF document with PDFKit
        const pdfDoc = new PDFDocument({
          size: 'A4',
          margin: this.options.margin,
        });

        const chunks = [];

        pdfDoc.on('data', (chunk) => {
          chunks.push(chunk);
        });

        pdfDoc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          const endTime = Date.now();
          const finalMemoryUsage = process.memoryUsage();

          logger.info('PDF generation completed successfully', {
            generationTime: endTime - startTime,
            pdfSize: pdfBuffer.length,
            memoryDelta: finalMemoryUsage.heapUsed - memoryUsage.heapUsed,
          });

          resolve(pdfBuffer);
        });

        pdfDoc.on('error', (error) => {
          logger.error('PDF generation failed', {
            error: error.message,
            contentLength: sanitizedContent.length,
            generationTime: Date.now() - startTime,
          });
          reject(new Error(`PDF generation failed: ${error.message}`));
        });

        // Set metadata
        pdfDoc.info.Title = metadata.title || 'Sanitized Document';
        pdfDoc.info.Author = metadata.author || 'MCP Security System';
        pdfDoc.info.Subject = metadata.subject || 'Verified Sanitized Content';
        pdfDoc.info.Creator = 'MCP-Security PDF Generator';
        pdfDoc.info.Producer = 'PDFKit';
        pdfDoc.info.CreationDate = new Date();
        pdfDoc.info.ModDate = new Date();
        pdfDoc.info.Keywords = [
          metadata.keywords || 'sanitized,verified,trust-token',
          JSON.stringify(trustToken),
        ];

        // Add title
        pdfDoc.fontSize(18).font('Helvetica-Bold');
        pdfDoc.text(metadata.title || 'Sanitized Document', { align: 'center' });
        pdfDoc.moveDown();

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
                pdfDoc.font('Courier').fontSize(10);
                pdfDoc.text(code);
                pdfDoc.font('Helvetica').fontSize(this.options.fontSize);
                pdfDoc.moveDown();
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
              pdfDoc.moveDown();
              pdfDoc.font('Helvetica-Bold').fontSize(16);
              pdfDoc.text(line.slice(2));
              pdfDoc.font('Helvetica').fontSize(this.options.fontSize);
              pdfDoc.moveDown();
            } else if (line.startsWith('## ')) {
              // H2 heading
              pdfDoc.moveDown(0.5);
              pdfDoc.font('Helvetica-Bold').fontSize(14);
              pdfDoc.text(line.slice(3));
              pdfDoc.font('Helvetica').fontSize(this.options.fontSize);
              pdfDoc.moveDown();
            } else if (line.startsWith('### ')) {
              // H3 heading
              pdfDoc.font('Helvetica-Bold').fontSize(12);
              pdfDoc.text(line.slice(4));
              pdfDoc.font('Helvetica').fontSize(this.options.fontSize);
              pdfDoc.moveDown();
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              // List items
              pdfDoc.text('• ' + line.slice(2));
              pdfDoc.moveDown(0.5);
            } else if (/^\d+\.\s/.test(line)) {
              // Numbered lists
              pdfDoc.text(line);
              pdfDoc.moveDown(0.5);
            } else if (line.trim() === '') {
              // Empty lines
              pdfDoc.moveDown();
            } else {
              // Regular paragraphs
              pdfDoc.text(line);
              pdfDoc.moveDown(0.5);
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
        pdfDoc.moveDown(2);
        pdfDoc.font('Helvetica-Oblique').fontSize(10);
        pdfDoc.text('--- Document Verification ---');
        pdfDoc.moveDown();
        pdfDoc.font('Helvetica').fontSize(10);
        pdfDoc.text(`Trust Token: ${trustToken?.signature?.slice(0, 16)}...`);
        pdfDoc.moveDown();
        pdfDoc.text(`Generated: ${new Date().toISOString()}`);
        pdfDoc.moveDown();
        pdfDoc.text('This document has been sanitized and verified for secure AI processing.');

        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
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
