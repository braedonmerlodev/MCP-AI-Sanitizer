const JSONRepair = require('./src/utils/jsonRepair');

// Test the actual integration scenario
const repair = new JSONRepair();

// Simulate what happens in jobWorker.js when AI generates malformed JSON
const malformedJsonFromAI = `{
  "title": "Test Document",
  "summary": "A test document",
  "enhanced_text": {"authors": ["Dr. Smith"], "abstract": "This paper discusses AI research", "sections": ["Introduction", "Methods"]
}`;

console.log('Testing AI-generated malformed JSON:');
console.log('Input:', malformedJsonFromAI);

const result = repair.repair(malformedJsonFromAI);
console.log('Repair successful:', result.success);
if (result.success) {
  console.log('Repaired JSON:', JSON.stringify(result.data, null, 2));
  console.log('Repairs applied:', result.repairs);
} else {
  console.log('Repair failed:', result.error);
}

// Test another common AI truncation scenario
const truncatedJson = `{
  "title": "Academic Paper",
  "content": "This is a research paper about artificial intelligence",
  "metadata": {
    "authors": ["Dr. Jane Smith", "Dr. John Doe"],
    "year": 2024,
    "journal": "AI Research Journal"
  }
}`;

console.log('\nTesting truncated JSON:');
console.log('Input:', truncatedJson);

const result2 = repair.repair(truncatedJson);
console.log('Repair successful:', result2.success);
if (result2.success) {
  console.log('Repaired JSON:', JSON.stringify(result2.data, null, 2));
  console.log('Repairs applied:', result2.repairs);
} else {
  console.log('Repair failed:', result2.error);
}
