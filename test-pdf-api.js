const PDFParse = require('pdf-parse');

console.log('PDFParse type:', typeof PDFParse);
console.log('PDFParse:', PDFParse);
console.log('PDFParse constructor?', typeof PDFParse === 'function' && PDFParse.prototype);

// Try different ways
try {
  console.log('Trying direct call...');
  const result = PDFParse(Buffer.from('test'));
  console.log('Direct call worked:', result);
} catch (e) {
  console.log('Direct call failed:', e.message);
}

try {
  console.log('Trying new constructor...');
  const parser = new PDFParse({ data: Buffer.from('test') });
  console.log('Constructor worked:', parser);
} catch (e) {
  console.log('Constructor failed:', e.message);
}

try {
  console.log('Trying PDFParse.PDFParse...');
  const parser = new PDFParse.PDFParse({ data: Buffer.from('test') });
  console.log('PDFParse.PDFParse worked:', parser);
} catch (e) {
  console.log('PDFParse.PDFParse failed:', e.message);
}
