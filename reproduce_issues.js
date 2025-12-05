const ProxySanitizer = require('./src/components/proxy-sanitizer');

async function testSanitization() {
  const sanitizer = new ProxySanitizer();

  const testCases = [
    { name: 'SSN Attached', input: 'ssn123-45-6789', expectedPattern: /ssnSSN_REDACTED/ }, // or SSN_REDACTED
    { name: 'Phone Attached', input: 'phone123-456-7890', expectedPattern: /phonePHONE_REDACTED/ },
    { name: 'Invisible Char (Zero Width)', input: 'a\u200Bb', expected: 'ab' },
    { name: 'Invisible Char (NBSP)', input: 'a\u00A0b', expected: 'a b' }, // Should probably normalize to space or strip?
    { name: 'Math Symbol (ForAll)', input: '∀', expected: '' },
    { name: 'Math Symbol (Sum)', input: '∑', expected: '' },
    { name: 'Control Char', input: 'a\u0000b', expected: 'ab' },
    { name: 'XSS Script', input: '<script>alert(1)</script>', expected: '' },
    { name: 'XSS Event', input: '<img src=x onerror=alert(1)>', expectedPattern: /img srcx/ }, // Match pattern as we might have leftovers
    { name: 'Email', input: 'test@example.com', expected: 'EMAIL_REDACTED' },
    { name: 'Zero-width', input: 'Zero-width characters', expected: 'Zero-width characters' },
    { name: 'Line Break', input: 'Line 1\nLine 2', expected: 'Line 1\nLine 2' },
  ];

  console.log('Running Node.js Sanitization Tests...');

  for (const test of testCases) {
    const result = await sanitizer.sanitize(test.input, { classification: 'unclear' });
    let passed = false;

    if (test.expectedPattern) {
      passed = test.expectedPattern.test(result);
    } else {
      passed = result === test.expected;
    }

    if (passed) {
      console.log(`✅ ${test.name}: Passed`);
    } else {
      console.log(`❌ ${test.name}: Failed`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Expected: "${test.expected}" (or pattern)`);
      console.log(`   Got: "${result}"`);
    }
  }
}

testSanitization().catch(console.error);
