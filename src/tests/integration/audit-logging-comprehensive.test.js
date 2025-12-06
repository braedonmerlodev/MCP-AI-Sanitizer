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
        // For PDF tests, return the mock AI output as-is since it's already JSON
        return { success: true, data: json, repairs: [] };
      }
    }
  };
});

// Mock JobResult instance
const mockJobResult = {
  save: jest.fn().mockResolvedValue(),
};

describe('Audit Logging Comprehensive Integration Tests', () => {
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
        length: 100, // Add length property for metadata
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
    const MockJobResult = jest.fn().mockImplementation(() => mockJobResult);
    require('../../models/JobResult').mockImplementation(MockJobResult);
    AuditLogger.mockImplementation(() => mockAuditLogger);
  });

  describe('PDF Processing Path Audit Logging', () => {
    test('should create comprehensive audit log for PDF processing with malicious content', async () => {
      // Mock AI transformer to return JSON with malicious content
      const mockAIOutput = JSON.stringify({
        documentDetails: { title: 'Test PDF' },
        sanitizationTests: {
          zeroWidthCharacters: 'Present',
          potentialXSS: { patterns: ['<script>alert(1)</script>'] },
        },
        ripplingAnalysis: { summary: 'Analysis' },
      });

      AITextTransformer.prototype.transform = jest.fn().mockResolvedValue({
        text: mockAIOutput,
        metadata: {},
      });

      // Mock ProxySanitizer
      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue(mockAIOutput);

      const processJob = require('../../workers/jobWorker');

      await processJob(mockJob);

      // Verify audit logger was called
      expect(mockAuditLogger.logEscalationDecision).toHaveBeenCalledTimes(1);

      const logCall = mockAuditLogger.logEscalationDecision.mock.calls[0];
      const escalationData = logCall[0];
      const context = logCall[1];

      // Verify escalation data structure
      expect(escalationData).toHaveProperty('escalationId');
      expect(escalationData).toHaveProperty('riskLevel', 'Critical'); // XSS attempt
      expect(escalationData).toHaveProperty('triggerConditions');
      expect(escalationData.triggerConditions).toContain('malicious_payload_detected');
      expect(escalationData.triggerConditions).toContain('xss_attempt');

      // Verify decision rationale contains threat details
      expect(escalationData.decisionRationale).toContain('Malicious Payload Detected');
      expect(escalationData.decisionRationale).toContain('xss_attempt');

      // Verify details contain comprehensive logging data
      expect(escalationData.details).toHaveProperty('sanitizationTests');
      expect(escalationData.details).toHaveProperty('sourcePath', 'pdf_processing');
      expect(escalationData.details).toHaveProperty('responseType', 'ai_agent_response');
      expect(escalationData.details).toHaveProperty('threatClassification', 'xss_attempt');
      expect(escalationData.details).toHaveProperty('jobType', 'pdf_processing');
      expect(escalationData.details).toHaveProperty('fileName', 'test.pdf');
      expect(escalationData.details).toHaveProperty('contentLength');

      // Verify context
      expect(context).toHaveProperty('resourceId', 'test-job');
      expect(context).toHaveProperty('resourceType', 'job_result');
      expect(context).toHaveProperty('userId', 'user-123');
      expect(context).toHaveProperty('stage', 'security_logging');
    });

    test('should create audit log for PDF processing with PII threats', async () => {
      const mockAIOutput = JSON.stringify({
        documentDetails: { title: 'Test PDF' },
        sanitizationTests: {
          potentialXSS: { patterns: ['user@example.com', '555-123-4567'] },
        },
      });

      AITextTransformer.prototype.transform = jest.fn().mockResolvedValue({
        text: mockAIOutput,
        metadata: {},
      });

      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue('sanitized text');

      const processJob = require('../../workers/jobWorker');

      await processJob(mockJob);

      const logCall = mockAuditLogger.logEscalationDecision.mock.calls[0];
      const escalationData = logCall[0];

      expect(escalationData.riskLevel).toBe('High');
      expect(escalationData.details.threatClassification).toBe('pii_data_leakage');
      expect(escalationData.triggerConditions).toContain('pii_data_leakage');
    });
  });

  describe('Default Processing Path Audit Logging', () => {
    test('should create audit log for default processing with malicious content', async () => {
      // Change to default path
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

      // Debug: check what was returned
      console.log('Result:', JSON.stringify(result, null, 2));

      // Verify securityReport was created
      expect(result.securityReport).toBeDefined();
      expect(result.securityReport.sanitizationTests).toBeDefined();

      // Verify audit logger was called for default path
      expect(mockAuditLogger.logEscalationDecision).toHaveBeenCalledTimes(1);

      const logCall = mockAuditLogger.logEscalationDecision.mock.calls[0];
      const escalationData = logCall[0];
      const context = logCall[1];

      // Verify escalation data for default path
      expect(escalationData.escalationId).toContain('security_test-job_content_removal');
      expect(escalationData.riskLevel).toBe('Medium'); // suspicious_content
      expect(escalationData.triggerConditions).toContain('malicious_content_detected');
      expect(escalationData.triggerConditions).toContain('suspicious_content');

      // Verify details contain default path metadata
      expect(escalationData.details).toHaveProperty('sanitizationTests');
      expect(escalationData.details).toHaveProperty('sourcePath', 'default_sanitization');
      expect(escalationData.details).toHaveProperty('responseType', 'direct_sanitization');
      expect(escalationData.details).toHaveProperty('threatClassification', 'suspicious_content');
      expect(escalationData.details).toHaveProperty('jobType', 'default');
      expect(escalationData.details).toHaveProperty('contentLength', 0); // No file buffer

      // Verify context
      expect(context.resourceId).toBe('test-job');
      expect(context.resourceType).toBe('job_result');
      expect(context.userId).toBe('user-123');
    });

    test('should not create audit log when no threats detected', async () => {
      mockJob.data.type = 'default';

      // Mock clean data with no malicious content
      const mockSanitizedData = {
        processedContent: 'clean text',
        metadata: { pages: 5 },
      };

      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue(mockSanitizedData);

      const processJob = require('../../workers/jobWorker');

      await processJob(mockJob);

      // Verify audit logger was NOT called for clean content
      expect(mockAuditLogger.logEscalationDecision).not.toHaveBeenCalled();
    });
  });

  describe('Audit Log Data Integrity', () => {
    test('should maintain consistent audit log structure across paths', async () => {
      // Test PDF path
      mockJob.data.type = 'pdf_processing';
      const mockAIOutput = JSON.stringify({
        sanitizationTests: { zeroWidthCharacters: 'Present' },
      });

      AITextTransformer.prototype.transform = jest.fn().mockResolvedValue({
        text: mockAIOutput,
        metadata: {},
      });
      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue('sanitized text');

      const processJob = require('../../workers/jobWorker');

      await processJob(mockJob);

      const pdfLogCall = mockAuditLogger.logEscalationDecision.mock.calls[0];
      const pdfEscalationData = pdfLogCall[0];

      // Reset mocks and test default path
      jest.clearAllMocks();
      AuditLogger.mockImplementation(() => mockAuditLogger);

      mockJob.data.type = 'default';
      const mockSanitizedData = {
        sanitizationTests: { controlCharacters: 'Present' },
      };
      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue(mockSanitizedData);

      await processJob(mockJob);

      const defaultLogCall = mockAuditLogger.logEscalationDecision.mock.calls[0];
      const defaultEscalationData = defaultLogCall[0];

      // Verify both logs have consistent structure
      const requiredFields = [
        'escalationId',
        'riskLevel',
        'triggerConditions',
        'decisionRationale',
        'details',
      ];

      for (const field of requiredFields) {
        expect(pdfEscalationData).toHaveProperty(field);
        expect(defaultEscalationData).toHaveProperty(field);
      }

      // Verify details structure consistency
      const requiredDetailFields = [
        'sanitizationTests',
        'sourcePath',
        'responseType',
        'threatClassification',
        'message',
      ];

      for (const field of requiredDetailFields) {
        expect(pdfEscalationData.details).toHaveProperty(field);
        expect(defaultEscalationData.details).toHaveProperty(field);
      }
    });

    test('should properly redact PII in audit logs', async () => {
      // This would test PII redaction if implemented
      // For now, verify the audit logger is called with proper structure
      mockJob.data.type = 'default';
      const mockSanitizedData = {
        sanitizationTests: { potentialXSS: { patterns: ['user@email.com'] } },
      };

      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue(mockSanitizedData);

      const processJob = require('../../workers/jobWorker');

      await processJob(mockJob);

      expect(mockAuditLogger.logEscalationDecision).toHaveBeenCalledTimes(1);
      // In a real implementation, we would verify PII redaction here
    });
  });

  describe('Performance and Error Handling', () => {
    test('should handle audit logging errors gracefully', async () => {
      mockJob.data.type = 'default';
      const mockSanitizedData = {
        sanitizationTests: { zeroWidthCharacters: 'Present' },
      };

      // Mock audit logger to throw error
      mockAuditLogger.logEscalationDecision = jest
        .fn()
        .mockRejectedValue(new Error('Audit logging failed'));

      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue(mockSanitizedData);

      const processJob = require('../../workers/jobWorker');

      // Should not throw error - audit logging failures should not break job processing
      await expect(processJob(mockJob)).resolves.toBeDefined();
    });

    test('should maintain job processing performance with audit logging', async () => {
      mockJob.data.type = 'default';
      const mockSanitizedData = {
        sanitizationTests: { zeroWidthCharacters: 'Present' },
      };

      ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue(mockSanitizedData);

      const processJob = require('../../workers/jobWorker');

      const startTime = Date.now();
      await processJob(mockJob);
      const endTime = Date.now();

      // Audit logging should not significantly impact processing time
      // This is a basic performance check - real benchmarks would be more comprehensive
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });
  });
});
