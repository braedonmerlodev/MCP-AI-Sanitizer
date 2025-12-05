const JobStatus = require('../../models/JobStatus');
const AITextTransformer = require('../../components/AITextTransformer');
const ProxySanitizer = require('../../components/proxy-sanitizer');
const AuditLogger = require('../../components/data-integrity/AuditLogger');

// Mock dependencies
jest.mock('../../models/JobStatus');
jest.mock('../../models/JobResult');
jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({
    text: 'PDF Content',
    numpages: 1,
    info: {},
  });
});
jest.mock('../../components/AITextTransformer');
jest.mock('../../components/proxy-sanitizer');
jest.mock('../../components/data-integrity/AuditLogger');
jest.mock('../../utils/jsonRepair', () => {
  return class JSONRepair {
    repair(json) {
      try {
        return { success: true, data: JSON.parse(json), repairs: [] };
      } catch (e) {
        // If it's not valid JSON, return it as-is (for text responses)
        return { success: true, data: json, repairs: [] };
      }
    }
  };
});

describe('JSON Key Removal - Threat Extraction', () => {
  let mockJob;
  let mockJobStatus;
  let mockAuditLogger;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockJob = {
      id: 'test-job',
      data: {
        type: 'pdf_processing',
        fileBuffer: 'base64encoded',
        fileName: 'test.pdf',
        userId: 'user-123',
      },
      options: {
        aiTransformType: 'structure',
      },
    };

    mockJobStatus = {
      updateStatus: jest.fn(),
      updateProgress: jest.fn(),
      save: jest.fn(),
      status: 'processing',
    };

    mockAuditLogger = {
      logEscalationDecision: jest.fn().mockResolvedValue('audit-id'),
    };

    // Setup mocks
    JobStatus.load.mockResolvedValue(mockJobStatus);
    AuditLogger.mockImplementation(() => mockAuditLogger);
  });

  describe('End-to-end threat extraction in PDF processing', () => {
    test('should remove malicious content from PDF processing response', async () => {
      // Mock AI transformer to return JSON with malicious content
      const mockAIOutput = JSON.stringify({
        documentDetails: { title: 'Test PDF' },
        sanitizationTests: {
          zeroWidthCharacters: 'Present',
          potentialXSS: { patterns: ['malicious@example.com'] },
        },
        ripplingAnalysis: { summary: 'Analysis' },
      });

      AITextTransformer.prototype.transform = jest.fn().mockResolvedValue({
        text: mockAIOutput,
        metadata: {},
      });

      // Mock ProxySanitizer
      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue('sanitized text');

      const processJob = require('../../workers/jobWorker');

      const result = await processJob(mockJob);

      // Verify malicious content was removed from sanitizedData
      expect(result.sanitizedData.documentDetails.title).toBe('Test PDF');
      expect(result.sanitizedData.ripplingAnalysis.summary).toBe('Analysis');
      expect(result.sanitizedData.sanitizationTests).toBeUndefined();

      // Verify threats were captured in securityReport
      expect(result.securityReport).toBeDefined();
      expect(result.securityReport.sanitizationTests.zeroWidthCharacters).toBe('Present');
      expect(result.securityReport.potentialXSS.patterns).toEqual(['malicious@example.com']);
    });
  });

  describe('End-to-end threat extraction in default processing', () => {
    test('should remove malicious content from default processing response', async () => {
      // Change job type to use default path
      mockJob.data.type = 'default';

      // Mock ProxySanitizer to return object with malicious content
      const mockSanitizedData = {
        processedContent: 'clean text',
        sanitizationTests: {
          controlCharacters: 'Present',
          unicodeText: 'Present',
        },
        metadata: { pages: 5 },
      };

      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue(mockSanitizedData);

      const processJob = require('../../workers/jobWorker');

      const result = await processJob(mockJob);

      // Verify malicious content was removed from sanitizedContent
      expect(result.sanitizedContent.processedContent).toBe('clean text');
      expect(result.sanitizedContent.metadata.pages).toBe(5);
      expect(result.sanitizedContent.sanitizationTests).toBeUndefined();

      // Verify threats were captured in securityReport
      expect(result.securityReport).toBeDefined();
      expect(result.securityReport.sanitizationTests.controlCharacters).toBe('Present');
      expect(result.securityReport.sanitizationTests.unicodeText).toBe('Present');
    });

    test('should preserve legitimate content without malicious keys', async () => {
      mockJob.data.type = 'default';

      // Mock data with no malicious content
      const mockSanitizedData = {
        title: 'Document Title',
        content: 'Safe content here',
        author: 'John Doe',
        metadata: {
          pages: 5,
          language: 'en',
        },
      };

      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue(mockSanitizedData);

      const processJob = require('../../workers/jobWorker');

      const result = await processJob(mockJob);

      // Verify all legitimate content remains unchanged
      expect(result.sanitizedContent.title).toBe('Document Title');
      expect(result.sanitizedContent.content).toBe('Safe content here');
      expect(result.sanitizedContent.author).toBe('John Doe');
      expect(result.sanitizedContent.metadata.pages).toBe(5);
      expect(result.sanitizedContent.metadata.language).toBe('en');

      // Verify no security report was created (no threats found)
      expect(result.securityReport).toBeUndefined();
    });
  });
});
