const { processJob } = require('../../workers/jobWorker');
const sinon = require('sinon');

describe('AI Response Sanitization Security Tests', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock external dependencies
    sandbox
      .stub(require('../../components/MarkdownConverter').prototype, 'convert')
      .returns('Converted markdown');
    sandbox.stub(require('../../components/AITextTransformer').prototype, 'transform').resolves({
      text: '{"content": "AI processed", "sanitizationTests": {"patterns": ["<script>"]}}',
    });
    sandbox.stub(require('../../components/proxy-sanitizer').prototype, 'sanitize').resolves({
      sanitizedData: '{"content": "sanitized", "sanitizationTests": {"patterns": ["malicious"]}}',
    });

    // Create mock instance
    const ProxySanitizer = require('../../components/proxy-sanitizer');
    globalThis.mockSanitizer = new ProxySanitizer();
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

  describe('Malicious Content Removal from AI Responses', () => {
    it('should remove XSS scripts from AI-generated responses', async () => {
      const mockSanitizer = globalThis.mockSanitizer;
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          response: 'AI response with <script>alert("xss")</script> malicious code',
          sanitizationTests: { xss: '<script>alert("xss")</script>' },
          potentialXSS: { scripts: ['<script>'] },
        },
      });

      const job = {
        id: 'security-test-1',
        data: {
          content: 'AI generated content with threats',
        },
        options: {},
      };

      const result = await processJob(job);

      expect(result.securityReport).toBeDefined();
      expect(result.securityReport.sanitizationTests).toEqual({
        xss: '<script>alert("xss")</script>',
      });
      expect(result.securityReport.potentialXSS).toEqual({ scripts: ['<script>'] });

      // Verify no malicious content in sanitized response
      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.response).not.toContain('<script>');
      expect(sanitizedData.response).not.toContain('alert');
      expect(sanitizedData.sanitizationTests).toBeUndefined();
      expect(sanitizedData.potentialXSS).toBeUndefined();
    });

    it('should prevent JavaScript injection in AI responses', async () => {
      const mockSanitizer = globalThis.mockSanitizer;
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          content: 'Safe AI content',
          sanitizationTests: { js_injection: 'javascript:evilFunction()' },
          symbolsAndSpecialChars: { suspicious: ['javascript:'] },
        },
      });

      const job = {
        id: 'security-test-2',
        data: {
          content: 'AI content with JS injection',
        },
        options: {},
      };

      const result = await processJob(job);

      expect(result.securityReport.symbolsAndSpecialChars).toEqual({ suspicious: ['javascript:'] });
      expect(result.securityReport.sanitizationTests).toEqual({
        js_injection: 'javascript:evilFunction()',
      });

      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.content).toBe('Safe AI content');
      expect(sanitizedData.sanitizationTests).toBeUndefined();
      expect(sanitizedData.symbolsAndSpecialChars).toBeUndefined();
    });

    it('should block data leakage attempts in AI responses', async () => {
      const mockSanitizer = globalThis.mockSanitizer;
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          message: 'AI response with email@test.com and phone:123-456-7890',
          sanitizationTests: { data_leakage: 'email@test.com' },
          unicodeText: { hidden: 'secret_data' },
        },
      });

      const job = {
        id: 'security-test-3',
        data: {
          content: 'AI response with sensitive data',
        },
        options: {},
      };

      const result = await processJob(job);

      expect(result.securityReport.sanitizationTests).toEqual({ data_leakage: 'email@test.com' });
      expect(result.securityReport.unicodeText).toEqual({ hidden: 'secret_data' });

      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.message).not.toContain('email@test.com');
      expect(sanitizedData.message).not.toContain('phone:');
      expect(sanitizedData.sanitizationTests).toBeUndefined();
      expect(sanitizedData.unicodeText).toBeUndefined();
    });
  });

  describe('No Malicious Content Leakage Validation', () => {
    it('should ensure complete removal of all malicious patterns', async () => {
      const mockSanitizer = globalThis.mockSanitizer;
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          text: 'Content with <iframe src="evil.com"></iframe> and <object data="malicious.swf"></object>',
          sanitizationTests: {
            iframe: '<iframe src="evil.com"></iframe>',
            object: '<object data="malicious.swf"></object>',
          },
          potentialXSS: { tags: ['iframe', 'object'] },
        },
      });

      const job = {
        id: 'security-test-4',
        data: {
          content: 'AI response with embedded objects',
        },
        options: {},
      };

      const result = await processJob(job);

      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.text).not.toContain('<iframe');
      expect(sanitizedData.text).not.toContain('<object');
      expect(sanitizedData.text).not.toContain('evil.com');
      expect(sanitizedData.text).not.toContain('malicious.swf');
      expect(sanitizedData.sanitizationTests).toBeUndefined();
      expect(sanitizedData.potentialXSS).toBeUndefined();
    });

    it('should prevent encoded malicious content leakage', async () => {
      const mockSanitizer = globalThis.mockSanitizer;
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          response: 'AI response with &lt;script&gt; encoded &amp;lt;img onerror&gt;',
          sanitizationTests: { encoded: '&lt;script&gt;' },
          controlCharacters: { hidden: '\u0000\u0001' },
        },
      });

      const job = {
        id: 'security-test-5',
        data: {
          content: 'AI response with encoded attacks',
        },
        options: {},
      };

      const result = await processJob(job);

      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.response).not.toContain('&lt;script&gt;');
      expect(sanitizedData.response).not.toContain('&amp;lt;img');
      expect(sanitizedData.response).not.toContain('\u0000');
      expect(sanitizedData.response).not.toContain('\u0001');
      expect(sanitizedData.sanitizationTests).toBeUndefined();
      expect(sanitizedData.controlCharacters).toBeUndefined();
    });
  });

  describe('Complex Nested Structure Edge Cases', () => {
    it('should handle deeply nested malicious structures', async () => {
      const mockSanitizer = globalThis.mockSanitizer;
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          data: {
            level1: {
              level2: {
                level3: {
                  content: 'Deep nested content',
                  sanitizationTests: { deep: { nested: { threat: '<script>' } } },
                  potentialXSS: { nested: { scripts: ['evil.js'] } },
                },
              },
            },
          },
        },
      });

      const job = {
        id: 'security-test-6',
        data: {
          content: 'AI response with deep nesting',
        },
        options: {},
      };

      const result = await processJob(job);

      expect(result.securityReport.sanitizationTests).toEqual({
        deep: { nested: { threat: '<script>' } },
      });
      expect(result.securityReport.potentialXSS).toEqual({ nested: { scripts: ['evil.js'] } });

      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.data.level1.level2.level3.content).toBe('Deep nested content');
      expect(sanitizedData.data.level1.level2.level3.sanitizationTests).toBeUndefined();
      expect(sanitizedData.data.level1.level2.level3.potentialXSS).toBeUndefined();
    });

    it('should sanitize arrays containing malicious objects', async () => {
      const mockSanitizer = globalThis.mockSanitizer;
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          items: [
            { safe: 'content1' },
            {
              dangerous: '<script>malicious</script>',
              sanitizationTests: { array_threat: '<script>' },
            },
            { safe: 'content3' },
          ],
          sanitizationTests: { array_items: ['<script>'] },
        },
      });

      const job = {
        id: 'security-test-7',
        data: {
          content: 'AI response with array threats',
        },
        options: {},
      };

      const result = await processJob(job);

      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.items[0].safe).toBe('content1');
      expect(sanitizedData.items[1].dangerous).not.toContain('<script>');
      expect(sanitizedData.items[1].sanitizationTests).toBeUndefined();
      expect(sanitizedData.items[2].safe).toBe('content3');
      expect(sanitizedData.sanitizationTests).toBeUndefined();
    });

    it('should handle mixed threat types in complex structures', async () => {
      const mockSanitizer = globalThis.mockSanitizer;
      mockSanitizer.sanitize.resolves({
        sanitizedData: {
          metadata: { safe: true },
          responses: [
            {
              text: 'Safe response 1',
              threats: { xss: '<img onerror>' },
            },
            {
              text: 'Safe response 2',
              threats: { injection: 'javascript:evil()' },
            },
          ],
          sanitizationTests: {
            xss: '<img onerror>',
            js: 'javascript:evil()',
          },
          potentialXSS: { mixed: ['img', 'javascript'] },
          symbolsAndSpecialChars: { chars: ['\u202E'] },
        },
      });

      const job = {
        id: 'security-test-8',
        data: {
          content: 'Complex AI response structure',
        },
        options: {},
      };

      const result = await processJob(job);

      expect(result.securityReport.sanitizationTests).toEqual({
        xss: '<img onerror>',
        js: 'javascript:evil()',
      });
      expect(result.securityReport.potentialXSS).toEqual({ mixed: ['img', 'javascript'] });
      expect(result.securityReport.symbolsAndSpecialChars).toEqual({ chars: ['\u202E'] });

      const sanitizedData = JSON.parse(result.sanitizedContent);
      expect(sanitizedData.metadata.safe).toBe(true);
      expect(sanitizedData.responses[0].text).toBe('Safe response 1');
      expect(sanitizedData.responses[0].threats).toBeUndefined();
      expect(sanitizedData.responses[1].text).toBe('Safe response 2');
      expect(sanitizedData.responses[1].threats).toBeUndefined();
      expect(sanitizedData.sanitizationTests).toBeUndefined();
      expect(sanitizedData.potentialXSS).toBeUndefined();
      expect(sanitizedData.symbolsAndSpecialChars).toBeUndefined();
    });
  });
});
