const processJob = require('../../workers/jobWorker');
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
      return { success: true, data: JSON.parse(json), repairs: [] };
    }
  };
});

describe('JobWorker SanitizationTests Separation', () => {
  let mockJob;
  let mockJobStatus;
  let mockAuditLogger;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockJob = {
      id: 'job-123',
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
    JobStatus.load.mockResolvedValue(mockJobStatus);

    // Mock AuditLogger instance
    mockAuditLogger = {
      logEscalationDecision: jest.fn().mockResolvedValue('audit-id'),
    };
    AuditLogger.mockImplementation(() => mockAuditLogger);

    // Mock AITextTransformer to return JSON with sanitizationTests
    const mockAIOutput = JSON.stringify({
      documentDetails: { title: 'Test PDF' },
      sanitizationTests: {
        zeroWidthCharacters: 'Present',
        potentialXSS: { patterns: ['alert(1)'] },
      },
      ripplingAnalysis: { summary: 'Analysis' },
    });

    AITextTransformer.prototype.transform = jest.fn().mockResolvedValue({
      text: mockAIOutput,
      metadata: {},
    });

    // Mock ProxySanitizer to pass through data
    ProxySanitizer.prototype.sanitize = jest.fn().mockImplementation(async (data) => {
      return { sanitizedData: data, trustToken: { token: 'abc' } };
    });
  });

  test('should separate sanitizationTests from result and log to HITL', async () => {
    const result = await processJob(mockJob);

    // Verify sanitizationTests is NOT in the result
    expect(result.sanitizedData).toHaveProperty('documentDetails');
    expect(result.sanitizedData).toHaveProperty('ripplingAnalysis');
    expect(result.sanitizedData).not.toHaveProperty('sanitizationTests');

    // Verify AuditLogger was called with the separated data
    expect(mockAuditLogger.logEscalationDecision).toHaveBeenCalledTimes(1);
    const logCall = mockAuditLogger.logEscalationDecision.mock.calls[0];
    const logData = logCall[0];

    // Check extracted data
    expect(logData.details.sanitizationTests).toBeDefined();
    expect(logData.details.sanitizationTests.zeroWidthCharacters).toBe('Present');

    // Check message formatting (Malicious case)
    expect(logData.decisionRationale).toContain('Malicious Payload Detected');
    expect(logData.riskLevel).toBe('High');
  });

  test('should format clean state message correctly', async () => {
    // Setup clean output
    const cleanOutput = JSON.stringify({
      documentDetails: { title: 'Clean PDF' },
      sanitizationTests: {
        zeroWidthCharacters: 'Absent',
        potentialXSS: 'None',
      },
    });

    AITextTransformer.prototype.transform.mockResolvedValue({
      text: cleanOutput,
      metadata: {},
    });

    const result = await processJob(mockJob);

    expect(result.sanitizedData).not.toHaveProperty('sanitizationTests');

    const logCall = mockAuditLogger.logEscalationDecision.mock.calls[0];
    const logData = logCall[0];

    expect(logData.decisionRationale).toBe('No malicious scripts or payloads detected.');
    expect(logData.riskLevel).toBe('Low');
  });
});

jest.mock('../../components/AITextTransformer');
jest.mock('../../components/proxy-sanitizer');
jest.mock('../../utils/jsonRepair', () => {
  return class JSONRepair {
    repair(json) {
      return { success: true, data: JSON.parse(json), repairs: [] };
    }
  };
});

describe('JobWorker SanitizationTests Separation', () => {
  let mockJob;
  let mockJobStatus;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockJob = {
      id: 'job-123',
      data: {
        type: 'pdf_processing',
        fileBuffer: 'base64encoded',
        fileName: 'test.pdf',
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
    JobStatus.load.mockResolvedValue(mockJobStatus);

    // Mock AITextTransformer to return JSON with sanitizationTests
    const mockAIOutput = JSON.stringify({
      documentDetails: { title: 'Test PDF' },
      sanitizationTests: {
        zeroWidthCharacters: 'Present',
        potentialXSS: { patterns: ['alert(1)'] },
      },
      ripplingAnalysis: { summary: 'Analysis' },
    });

    AITextTransformer.prototype.transform = jest.fn().mockResolvedValue({
      text: mockAIOutput,
      metadata: {},
    });

    // Mock ProxySanitizer to pass through data
    ProxySanitizer.prototype.sanitize = jest.fn().mockImplementation(async (data) => {
      return { sanitizedData: data, trustToken: { token: 'abc' } };
    });
  });

  test('should separate sanitizationTests from result and log to HITL', async () => {
    const result = await processJob(mockJob);

    // Verify sanitizationTests is NOT in the result
    expect(result.sanitizedData).toHaveProperty('documentDetails');
    expect(result.sanitizedData).toHaveProperty('ripplingAnalysis');
    expect(result.sanitizedData).not.toHaveProperty('sanitizationTests');

    // Verify it was captured/logged (I haven't implemented logging yet, so this part of test is "future")
    // For now, I just want to confirm I can modify the object.
  });
});
