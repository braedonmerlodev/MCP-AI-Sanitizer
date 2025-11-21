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
          steps: [
            'input_validation',
            'threat_detection',
            'content_sanitization',
            'output_formatting',
          ],
          parameters: { sanitizationLevel: 'strict' },
          results: [
            { passed: true, threats: 0 },
            { detected: 1, severity: 'high' },
            { applied: true, changes: 1 },
            { formatted: true, size: 85 },
          ],
        },
        processingTime: 245,
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
      expect(result.processingSteps).toHaveLength(4);
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

    it('should handle null assessmentData gracefully', async () => {
      const result = await collector.collectTrainingData(null);

      expect(result).toBeNull();
      expect(mockAuditLogger.logOperation).not.toHaveBeenCalled();
    });

    it('should handle undefined assessmentData gracefully', async () => {
      const result = await collector.collectTrainingData(undefined);

      expect(result).toBeNull();
      expect(mockAuditLogger.logOperation).not.toHaveBeenCalled();
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

  describe('End-to-End Training Data Collection', () => {
    it('should execute complete training data collection pipeline with data quality validation', async () => {
      // Test data representing a realistic security assessment
      const assessmentData = {
        inputData: {
          content:
            'User input: <script>document.cookie="session=abc123"</script> and some normal text',
          contentType: 'html',
        },
        processingContext: {
          steps: [
            'input_validation',
            'threat_detection',
            'content_sanitization',
            'output_formatting',
          ],
          parameters: { sanitizationLevel: 'strict' },
          results: [
            { passed: true, threats: 0 },
            { detected: 1, severity: 'high' },
            { applied: true, changes: 1 },
            { formatted: true, size: 85 },
          ],
          processingTime: 245,
        },
        riskScore: 0.92,
        confidenceScore: 0.89,
        anomalyScore: 0.23,
        threatPatternId: 'xss_injection',
        riskLevel: 'High',
        actionsTaken: ['sanitize_content', 'log_incident'],
        trainingLabels: { category: 'xss_attack' },
        destination: 'ai_training_pipeline',
        languageFeatures: { language: 'en', sentiment: 'neutral' },
        structuralFeatures: { hasScript: true, hasForms: false },
      };

      const context = {
        userId: 'test_user_456',
        source: 'web_application',
        ipAddress: '10.0.0.100',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        sessionId: 'sess_789',
        timestamp: new Date().toISOString(),
      };

      // Execute end-to-end collection
      const result = await collector.collectTrainingData(assessmentData, context);

      // Validate collection occurred
      expect(result).toBeDefined();
      expect(result).not.toBeNull();

      // Validate data structure and completeness
      expect(result).toHaveProperty('id');
      expect(result.id).toMatch(/^train_\d+_/);

      // Validate inputData section
      expect(result.inputData).toBeDefined();
      expect(result.inputData.content).toBe(assessmentData.inputData.content);
      expect(result.inputData.contentType).toBe('html');
      expect(result.inputData.size).toBeGreaterThan(0);
      expect(result.inputData.hash).toBeDefined();
      expect(typeof result.inputData.hash).toBe('string');

      // Validate processingSteps section
      expect(result.processingSteps).toBeDefined();
      expect(Array.isArray(result.processingSteps)).toBe(true);
      expect(result.processingSteps).toHaveLength(4);
      result.processingSteps.forEach((step) => {
        expect(step).toHaveProperty('step');
        expect(step).toHaveProperty('action');
        expect(step).toHaveProperty('timestamp');
        expect(step.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      // Validate decisionOutcome section
      expect(result.decisionOutcome).toBeDefined();
      expect(result.decisionOutcome.riskLevel).toBe('High');
      expect(result.decisionOutcome.actionsTaken).toEqual(['sanitize_content', 'log_incident']);
      expect(result.decisionOutcome.confidenceScore).toBe(0.89);
      expect(result.decisionOutcome.riskScore).toBe(0.92);

      // Validate featureVector section
      expect(result.featureVector).toBeDefined();
      expect(typeof result.featureVector.contentLength).toBe('number');
      expect(result.featureVector.contentLength).toBeGreaterThan(0);
      expect(typeof result.featureVector.specialCharsCount).toBe('number');
      expect(typeof result.featureVector.scriptTagsCount).toBe('number');
      expect(typeof result.featureVector.suspiciousPatternsCount).toBe('number');
      expect(typeof result.featureVector.entropyScore).toBe('number');
      expect(result.featureVector.entropyScore).toBeGreaterThanOrEqual(0);
      expect(result.featureVector.entropyScore).toBeLessThanOrEqual(1);
      expect(result.featureVector.languageFeatures).toEqual({
        language: 'en',
        sentiment: 'neutral',
      });
      expect(result.featureVector.structuralFeatures).toEqual({ hasScript: true, hasForms: false });

      // Validate trainingLabels section
      expect(result.trainingLabels).toBeDefined();
      expect(result.trainingLabels.riskCategory).toBe('malicious'); // Based on riskLevel mapping
      expect(result.trainingLabels.threatTypes).toEqual([]);
      expect(result.trainingLabels.confidence).toBe(0.89);
      expect(result.trainingLabels.humanVerified).toBe(false); // Default value when not provided

      // Validate metadata section
      expect(result.metadata).toBeDefined();
      expect(result.metadata.collectionTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result.metadata.provenance).toBe('web_application');
      expect(result.metadata.source).toBe('web_application');
      expect(result.metadata.version).toBe('1.0');
      expect(result.metadata.processingDuration).toBeDefined(); // Processing time from assessment data
      expect(result.metadata.environment).toBeDefined();
      expect(result.metadata.collectionTime).toBeDefined();
      expect(typeof result.metadata.collectionTime).toBe('number');

      // Validate audit logging occurred
      expect(mockAuditLogger.logOperation).toHaveBeenCalledWith(
        'training_data_collected',
        expect.objectContaining({
          trainingDataId: result.id,
          riskScore: 0.92,
          riskLevel: 'High',
          collectionTime: expect.any(Number),
          validationPassed: true,
        }),
        expect.objectContaining({
          userId: 'test_user_456',
          source: 'web_application',
          severity: 'info',
        }),
      );

      // Validate data quality metrics
      const dataQualityScore = calculateDataQualityScore(result);
      expect(dataQualityScore).toBeGreaterThanOrEqual(0.8); // High quality threshold
    });

    it('should validate training data against schema requirements', async () => {
      const assessmentData = {
        inputData: { content: 'Safe content', contentType: 'text' },
        processingContext: { steps: ['validate'] },
        riskScore: 0.8,
        riskLevel: 'High',
        actionsTaken: ['monitor'],
      };

      const result = await collector.collectTrainingData(assessmentData);

      expect(result).toBeDefined();

      // Validate required schema fields are present
      const requiredFields = [
        'id',
        'inputData',
        'processingSteps',
        'decisionOutcome',
        'featureVector',
        'trainingLabels',
        'metadata',
      ];
      requiredFields.forEach((field) => {
        expect(result).toHaveProperty(field);
      });

      // Validate data types
      expect(typeof result.id).toBe('string');
      expect(typeof result.inputData).toBe('object');
      expect(Array.isArray(result.processingSteps)).toBe(true);
      expect(typeof result.decisionOutcome).toBe('object');
      expect(typeof result.featureVector).toBe('object');
      expect(typeof result.trainingLabels).toBe('object');
      expect(typeof result.metadata).toBe('object');
    });
  });
});

// Helper function for data quality scoring
function calculateDataQualityScore(trainingData) {
  let score = 0;
  let maxScore = 0;

  // Completeness (40 points)
  maxScore += 40;
  const requiredSections = [
    'inputData',
    'processingSteps',
    'decisionOutcome',
    'featureVector',
    'trainingLabels',
    'metadata',
  ];
  const presentSections = requiredSections.filter((section) => trainingData[section]);
  score += (presentSections.length / requiredSections.length) * 40;

  // Data integrity (30 points)
  maxScore += 30;
  if (trainingData.inputData?.hash && trainingData.inputData?.size > 0) score += 15;
  if (
    trainingData.featureVector?.entropyScore >= 0 &&
    trainingData.featureVector?.entropyScore <= 1
  )
    score += 10;
  if (trainingData.metadata?.collectionTimestamp) score += 5;

  // Processing quality (30 points)
  maxScore += 30;
  if (trainingData.processingSteps?.length > 0) score += 10;
  if (trainingData.decisionOutcome?.riskLevel) score += 10;
  if (trainingData.trainingLabels?.riskCategory) score += 10;

  return score / maxScore;
}
