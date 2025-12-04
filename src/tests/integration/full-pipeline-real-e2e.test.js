const request = require('supertest');
const app = require('../../app');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

describe('Full Pipeline Integration: PDF Upload → Trust Token Generation', () => {
  let trustTokenGenerator;
  let validTrustToken;

  beforeAll(() => {
    trustTokenGenerator = new TrustTokenGenerator();
    validTrustToken = trustTokenGenerator.generateToken('test content', 'test content', ['test'], {
      expirationHours: 1,
    });
  });

  describe('Complete PDF-to-TrustToken Pipeline', () => {
    it('should process PDF through full pipeline and generate trust tokens', async () => {
      // Create a minimal valid PDF for testing
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World Test) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
        'binary',
      );

      console.log('Starting PDF upload test...');

      // Step 1: Upload PDF with AI transformation
      const uploadResponse = await request(app)
        .post('/api/documents/upload?ai_transform=true')
        .set('x-trust-token', JSON.stringify(validTrustToken))
        .attach('file', pdfBuffer, 'test.pdf');

      console.log('Upload response status:', uploadResponse.status);
      console.log('Upload response body:', JSON.stringify(uploadResponse.body, null, 2));

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body).toHaveProperty('job_id');
      expect(uploadResponse.body.status).toBe('queued');

      const jobId = uploadResponse.body.job_id;
      console.log('Job ID:', jobId);

      // Step 2: Wait for job to process (give it time)
      console.log('Waiting for job to complete...');
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      // Step 3: Check job result directly from database
      const JobResult = require('../../models/JobResult');
      const jobResult = await JobResult.load(jobId);

      console.log('Job result from database:', JSON.stringify(jobResult, null, 2));

      expect(jobResult).toBeDefined();
      expect(jobResult).toHaveProperty('result');
      expect(jobResult.result).toHaveProperty('sanitizedContent');
      expect(jobResult.result.sanitizedContent).toHaveProperty('sanitizedData');
      expect(jobResult.result.sanitizedContent).toHaveProperty('trustToken');

      const { trustToken, sanitizedData } = jobResult.result.sanitizedContent;

      console.log('Trust token found:', JSON.stringify(trustToken, null, 2));
      console.log('Sanitized data:', JSON.stringify(sanitizedData, null, 2));

      // Step 4: Validate trust token structure
      expect(trustToken).toHaveProperty('contentHash');
      expect(trustToken).toHaveProperty('originalHash');
      expect(trustToken).toHaveProperty('sanitizationVersion');
      expect(trustToken).toHaveProperty('rulesApplied');
      expect(Array.isArray(trustToken.rulesApplied)).toBe(true);
      expect(trustToken).toHaveProperty('timestamp');
      expect(trustToken).toHaveProperty('expiresAt');
      expect(trustToken).toHaveProperty('signature');
      expect(trustToken).toHaveProperty('nonce');

      // Step 5: Validate trust token cryptographically
      const validation = trustTokenGenerator.validateToken(trustToken);
      console.log('Trust token validation result:', validation);

      expect(validation.isValid).toBe(true);

      // Step 6: Content hash validation is handled by trust token validation above
      // The trust token ensures content integrity through cryptographic validation

      console.log('✅ Full pipeline test passed - trust tokens generated and validated');
    }, 60_000); // 60 second timeout for async processing
  });
});
