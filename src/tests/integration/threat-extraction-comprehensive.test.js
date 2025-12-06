const { processJob } = require('../../workers/jobWorker');
const sinon = require('sinon');

describe('Threat Extraction Integration Tests', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock external dependencies
    sandbox.stub(require('pdf-parse'), 'default').resolves({
      text: 'Sample PDF text for testing',
      numpages: 1,
      info: { Title: 'Test PDF' },
    });

    sandbox
      .stub(require('../../components/MarkdownConverter').prototype, 'convert')
      .returns('Converted markdown');
    sandbox.stub(require('../../components/AITextTransformer').prototype, 'transform').resolves({
      text: '{"content": "AI processed", "sanitizationTests": {"patterns": ["<script>"]}}',
    });
    sandbox.stub(require('../../components/proxy-sanitizer'), 'default').returns({
      sanitize: sandbox.stub().resolves({
        sanitizedData: '{"content": "sanitized", "sanitizationTests": {"patterns": ["malicious"]}}',
      }),
    });
    sandbox.stub(require('../../utils/jsonRepair'), 'default').returns({
      repair: sandbox.stub().returns({
        success: true,
        data: { content: 'sanitized', sanitizationTests: { patterns: ['malicious'] } },
      }),
    });
    sandbox
      .stub(
        require('../../components/data-integrity/AuditLogger').prototype,
        'logEscalationDecision',
      )
      .resolves();
    sandbox.stub(require('../../models/JobStatus'), 'load').resolves({
      updateStatus: sandbox.stub().resolves(),
      updateProgress: sandbox.stub().resolves(),
    });
    sandbox.stub(require('../../models/JobResult').prototype, 'save').resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Default Path Threat Extraction', () => {
    it('should extract threats from structured AI response in default path', async () => {
      const mockSanitizer = require('../../components/proxy-sanitizer').default();
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          content: 'safe content',
          sanitizationTests: { patterns: ['<script>alert(1)</script>'] },
          potentialXSS: { scripts: ['evil.js'] },
        },
      });

      const job = {
        id: 'test-job-1',
        data: {
          content: 'test data',
          sanitizationTests: { patterns: ['malicious'] },
        },
        options: {},
      };

      const result = await processJob(job);

      expect(result.sanitizedContent).toBeDefined();
      expect(result.securityReport).toBeDefined();
      expect(result.securityReport.sanitizationTests).toEqual({ patterns: ['malicious'] });
      expect(result.securityReport.potentialXSS).toEqual({ scripts: ['evil.js'] });
      // Verify threats are removed from sanitized content
      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.sanitizationTests).toBeUndefined();
      expect(sanitizedData.potentialXSS).toBeUndefined();
      expect(sanitizedData.content).toBe('safe content');
    });

    it('should preserve legitimate content while removing threats', async () => {
      const mockSanitizer = require('../../components/proxy-sanitizer').default();
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          title: 'Legitimate Title',
          description: 'Safe description',
          sanitizationTests: { patterns: ['<script>'] },
          metadata: { author: 'Test Author' },
        },
      });

      const job = {
        id: 'test-job-2',
        data: {
          title: 'Test',
          description: 'Test desc',
        },
        options: {},
      };

      const result = await processJob(job);

      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.title).toBe('Legitimate Title');
      expect(sanitizedData.description).toBe('Safe description');
      expect(sanitizedData.metadata).toEqual({ author: 'Test Author' });
      expect(sanitizedData.sanitizationTests).toBeUndefined();
    });
  });

  describe('PDF Processing Path Threat Extraction', () => {
    it('should extract threats during PDF processing with AI structure', async () => {
      const mockAI = require('../../components/AITextTransformer').prototype;
      mockAI.transform.resolves({
        text: '{"content": "processed content", "sanitizationTests": {"xss": "<script>"}, "potentialXSS": {"vectors": ["img onerror"]}}',
      });

      const mockRepair = require('../../utils/jsonRepair').default();
      mockRepair.repair.returns({
        success: true,
        data: {
          content: 'processed content',
          sanitizationTests: { xss: '<script>' },
          potentialXSS: { vectors: ['img onerror'] },
        },
      });

      const job = {
        id: 'test-job-3',
        data: {
          type: 'pdf_processing',
          fileBuffer: Buffer.from('fake pdf').toString('base64'),
          fileName: 'test.pdf',
        },
        options: { aiTransformType: 'structure' },
      };

      const result = await processJob(job);

      expect(result.status).toBe('processed');
      expect(result.fileName).toBe('test.pdf');
      expect(result.securityReport).toBeDefined();
      expect(result.securityReport.sanitizationTests).toEqual({ xss: '<script>' });
      expect(result.securityReport.potentialXSS).toEqual({ vectors: ['img onerror'] });
      // Verify threats removed from sanitized data
      expect(result.sanitizedData.sanitizationTests).toBeUndefined();
      expect(result.sanitizedData.potentialXSS).toBeUndefined();
      expect(result.sanitizedData.content).toBe('processed content');
    });

    it('should handle nested malicious structures in PDF processing', async () => {
      const mockAI = require('../../components/AITextTransformer').prototype;
      mockAI.transform.resolves({
        text: '{"data": {"nested": {"sanitizationTests": {"deep": {"malicious": "code"}}, "potentialXSS": {"scripts": ["evil"]}}}}',
      });

      const mockRepair = require('../../utils/jsonRepair').default();
      mockRepair.repair.returns({
        success: true,
        data: {
          data: {
            nested: {
              sanitizationTests: { deep: { malicious: 'code' } },
              potentialXSS: { scripts: ['evil'] },
            },
          },
        },
      });

      const job = {
        id: 'test-job-4',
        data: {
          type: 'pdf_processing',
          fileBuffer: Buffer.from('fake pdf').toString('base64'),
          fileName: 'test.pdf',
        },
        options: { aiTransformType: 'structure' },
      };

      const result = await processJob(job);

      expect(result.securityReport).toBeDefined();
      expect(result.securityReport.sanitizationTests).toEqual({ deep: { malicious: 'code' } });
      expect(result.securityReport.potentialXSS).toEqual({ scripts: ['evil'] });
      // Verify nested threats removed
      expect(result.sanitizedData.data.nested.sanitizationTests).toBeUndefined();
      expect(result.sanitizedData.data.nested.potentialXSS).toBeUndefined();
    });
  });

  describe('Security Report Validation', () => {
    it('should create comprehensive security report with threat details', async () => {
      const mockSanitizer = require('../../components/proxy-sanitizer').default();
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          content: 'safe',
          sanitizationTests: { patterns: ['<script>', 'javascript:'] },
          potentialXSS: { sources: ['user_input'] },
          symbolsAndSpecialChars: { chars: ['\u0000'] },
        },
      });

      const job = {
        id: 'test-job-5',
        data: { content: 'test' },
        options: {},
      };

      const result = await processJob(job);

      expect(result.securityReport).toBeDefined();
      expect(result.securityReport.sanitizationTests).toEqual({
        patterns: ['<script>', 'javascript:'],
      });
      expect(result.securityReport.potentialXSS).toEqual({ sources: ['user_input'] });
      expect(result.securityReport.symbolsAndSpecialChars).toEqual({ chars: ['\u0000'] });
    });

    it('should handle empty threat extraction gracefully', async () => {
      const mockSanitizer = require('../../components/proxy-sanitizer').default();
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          content: 'completely safe content',
          metadata: { safe: true },
        },
      });

      const job = {
        id: 'test-job-6',
        data: { content: 'safe' },
        options: {},
      };

      const result = await processJob(job);

      expect(result.securityReport).toBeUndefined(); // No threats found
      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.content).toBe('completely safe content');
      expect(sanitizedData.metadata).toEqual({ safe: true });
    });
  });
});
