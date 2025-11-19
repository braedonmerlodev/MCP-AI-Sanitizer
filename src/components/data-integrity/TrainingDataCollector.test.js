jest.mock('./TrainingDataValidator', () => {
  return jest.fn().mockImplementation(() => ({
    validateTrainingData: jest.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    }),
  }));
});
const TrainingDataValidator = require('./TrainingDataValidator');

const TrainingDataCollector = require('./TrainingDataCollector');

describe('TrainingDataCollector', () => {
  let collector;
  let mockAuditLogger;

  beforeEach(() => {
    TrainingDataValidator.mockClear();
    TrainingDataValidator.mockImplementation(() => ({
      validateTrainingData: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      }),
    }));

    mockAuditLogger = {
      logOperation: jest.fn().mockResolvedValue('audit_123'),
    };
    collector = new TrainingDataCollector({
      auditLogger: mockAuditLogger,
      enableCollection: true,
      minRiskScore: 0.1,
      maxCollectionRate: 1.0,
    });
  });

  afterEach(() => {
    // Clean up any persisted audit data between tests
    jest.clearAllMocks();

    // Reset TrainingDataValidator mock
    TrainingDataValidator.mockClear();

    // Clear any global test state
    if (global.testState) {
      delete global.testState;
    }
  });

  describe('collectTrainingData', () => {
    it('should collect training data for high-risk assessment', async () => {
      const assessmentData = {
        inputData: {
          content: 'Test content with <script>alert("xss")</script>',
          contentType: 'text',
        },
        processingContext: {
          steps: ['validation', 'normalization', 'sanitization'],
          sanitizationLevel: 'advanced',
          validationPassed: true,
          provenanceValidated: true,
          processingTime: 150,
        },
        riskScore: 0.85,
        confidenceScore: 0.92,
        anomalyScore: 0.15,
        threatPatternId: 'pattern_001',
        riskLevel: 'High',
        featureVector: { feature1: 0.5 },
        actionsTaken: ['sanitize'],
        trainingLabels: { category: 'malicious' },
        destination: 'llm_endpoint',
      };

      const context = {
        userId: 'user_123',
        source: 'n8n',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const result = await collector.collectTrainingData(assessmentData, context);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^train_\d+_/);
      expect(result.inputData.size).toBeGreaterThan(0);
      expect(result.inputData.contentType).toBe('text');
      expect(result.processingSteps).toHaveLength(3);
      expect(result.decisionOutcome.riskScore).toBe(0.85);
      expect(result.trainingLabels.riskCategory).toBe('malicious');
      expect(result.metadata.collectionTimestamp).toBeDefined();

      expect(mockAuditLogger.logOperation).toHaveBeenCalledWith(
        'training_data_collected',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should skip collection for low-risk assessment', async () => {
      const assessmentData = {
        riskScore: 0.05, // Below threshold
        riskLevel: 'Low',
      };

      const result = await collector.collectTrainingData(assessmentData);

      expect(result).toBeNull();
      expect(mockAuditLogger.logOperation).not.toHaveBeenCalled();
    });

    it('should handle collection errors gracefully', async () => {
      // Mock validation to fail
      collector.validator.validateTrainingData.mockResolvedValueOnce({
        isValid: false,
        errors: ['Validation failed'],
        warnings: [],
      });

      const assessmentData = {
        riskScore: 0.9,
        riskLevel: 'High',
        // Missing required fields to cause error
      };

      const result = await collector.collectTrainingData(assessmentData);

      expect(result).toBeNull();
      expect(mockAuditLogger.logOperation).toHaveBeenCalledWith(
        'training_data_collection_validation_failed',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should respect sampling rate', async () => {
      collector.collectionThresholds.maxCollectionRate = 0; // Never collect

      const assessmentData = {
        riskScore: 0.9,
        riskLevel: 'High',
      };

      const result = await collector.collectTrainingData(assessmentData);

      expect(result).toBeNull();
    });
  });

  describe('buildTrainingDataObject', () => {
    it('should build complete training data object', () => {
      const assessmentData = {
        inputData: { content: 'test', contentType: 'text' },
        processingContext: { steps: ['step1'], processingTime: 100 },
        riskScore: 0.8,
        riskLevel: 'High',
        actionsTaken: ['block'],
      };

      const context = { userId: 'user1' };

      const result = collector.buildTrainingDataObject(assessmentData, context);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('inputData');
      expect(result).toHaveProperty('processingSteps');
      expect(result).toHaveProperty('decisionOutcome');
      expect(result).toHaveProperty('featureVector');
      expect(result).toHaveProperty('trainingLabels');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('buildInputData', () => {
    it('should build input data object', () => {
      const inputData = {
        content: 'Hello world',
        contentType: 'text',
      };

      const result = collector.buildInputData(inputData);

      expect(result.content).toBe('Hello world');
      expect(result.contentType).toBe('text');
      expect(result.size).toBe(11);
      expect(result.hash).toBeDefined();
    });

    it('should handle missing input data', () => {
      const result = collector.buildInputData(null);

      expect(result.content).toBe('');
      expect(result.contentType).toBe('unknown');
      expect(result.size).toBe(0);
      expect(result.hash).toBeDefined();
    });
  });

  describe('buildProcessingSteps', () => {
    it('should build processing steps array', () => {
      const processingContext = {
        steps: ['validate', 'sanitize'],
        parameters: { level: 'basic' },
        results: [{ passed: true }, { applied: true }],
      };

      const result = collector.buildProcessingSteps(processingContext);

      expect(result).toHaveLength(2);
      expect(result[0].step).toBe('step_1');
      expect(result[0].action).toBe('validate');
      expect(result[0].parameters).toEqual({ level: 'basic' });
      expect(result[0].result).toEqual({ passed: true });
    });
  });

  describe('buildDecisionOutcome', () => {
    it('should build decision outcome object', () => {
      const assessmentData = {
        riskLevel: 'High',
        actionsTaken: ['sanitize'],
        confidenceScore: 0.9,
        riskScore: 0.8,
      };

      const result = collector.buildDecisionOutcome(assessmentData);

      expect(result.riskLevel).toBe('High');
      expect(result.actionsTaken).toEqual(['sanitize']);
      expect(result.confidenceScore).toBe(0.9);
      expect(result.riskScore).toBe(0.8);
    });
  });

  describe('buildFeatureVector', () => {
    it('should build feature vector', () => {
      const assessmentData = {
        inputData: {
          content: 'Hello <script>alert("xss")</script> wo',
        },
      };

      const result = collector.buildFeatureVector(assessmentData);

      expect(result.contentLength).toBe(38);
      expect(result.specialCharsCount).toBeGreaterThan(0);
      expect(result.scriptTagsCount).toBe(1);
      expect(result.suspiciousPatternsCount).toBeGreaterThan(0);
      expect(result.entropyScore).toBeGreaterThanOrEqual(0);
      expect(result.entropyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateEntropy', () => {
    it('should calculate entropy for content', () => {
      expect(collector.calculateEntropy('aaa')).toBeCloseTo(0, 1); // Low entropy
      expect(collector.calculateEntropy('abcdef')).toBeGreaterThan(0.5); // Higher entropy
      expect(collector.calculateEntropy('')).toBe(0);
    });
  });

  describe('redactPII', () => {
    it('should redact email addresses', () => {
      expect(collector.redactPII('Contact user@example.com')).toBe('Contact [EMAIL_REDACTED]');
    });

    it('should redact phone numbers', () => {
      expect(collector.redactPII('Call 123-456-7890')).toBe('Call [PHONE_REDACTED]');
    });

    it('should handle non-string input', () => {
      expect(collector.redactPII(null)).toBe(null);
      expect(collector.redactPII(123)).toBe(123);
    });
  });
});
