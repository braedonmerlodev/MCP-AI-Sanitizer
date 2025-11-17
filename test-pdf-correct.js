const PDFParse = require('pdf-parse');

async function testPDFParse() {
  try {
    // Create a simple PDF buffer for testing (this is just a minimal PDF)
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000200 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
      'binary',
    );

    console.log('Testing PDF parsing...');
    console.log('Buffer length:', pdfBuffer.length);
    console.log('Buffer starts with:', pdfBuffer.slice(0, 10).toString('hex'));

    // Try calling as function instead of constructor
    const pdfData = await PDFParse.PDFParse({ data: pdfBuffer });
    console.log('Function call worked:', pdfData);
    console.log('PDF data:', pdfData);
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPDFParse();
