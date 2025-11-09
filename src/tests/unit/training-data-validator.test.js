/**
 * Unit tests for TrainingDataValidator
 */

const TrainingDataValidator = require('../../components/data-integrity/TrainingDataValidator');

describe('TrainingDataValidator', () => {
  let validator;
  let mockAuditLogger;

  beforeEach(() => {
    // Mock audit logger
    mockAuditLogger = {
      logValidation: jest.fn().mockResolvedValue('audit-id'),
    };

    validator = new TrainingDataValidator({ auditLogger: mockAuditLogger });
  });

  describe('validateTrainingData', () => {
    it('should validate complete and correct training data', async () => {
      const validTrainingData = {
        inputData: {
          content: 'Sample content for testing',
          contentType: 'text',
          size: 28,
          hash: 'abc123',
        },
        processingSteps: [
          {
            step: 'sanitization',
            action: 'strip_scripts',
            timestamp: '2023-11-09T10:00:00.000Z',
            parameters: { target: 'script' },
            result: { scriptsRemoved: 2 },
          },
        ],
        decisionOutcome: {
          riskLevel: 'Low',
          actionsTaken: ['sanitized', 'logged'],
          confidenceScore: 0.85,
          riskScore: 15,
        },
        featureVector: {
          contentLength: 28,
          specialCharsCount: 2,
          scriptTagsCount: 0,
          suspiciousPatternsCount: 1,
          entropyScore: 0.75,
          languageFeatures: { englishWords: 5 },
          structuralFeatures: { hasHtml: false },
        },
        trainingLabels: {
          riskCategory: 'safe',
          threatTypes: [],
          confidence: 0.9,
          humanVerified: true,
          verificationTimestamp: '2023-11-09T10:05:00.000Z',
        },
        metadata: {
          collectionTimestamp: new Date().toISOString(),
          provenance: 'risk_assessment_system',
          source: 'api_request',
          version: '1.0.0',
          processingDuration: 150,
          environment: 'production',
        },
      };

      const result = await validator.validateTrainingData(validTrainingData, {
        userId: 'test-user',
        sessionId: 'test-session',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(mockAuditLogger.logValidation).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: true,
        }),
        expect.objectContaining({
          validationType: 'training_data_quality',
          userId: 'test-user',
          sessionId: 'test-session',
        }),
      );
    });

    it('should reject training data with missing required fields', async () => {
      const invalidTrainingData = {
        inputData: {
          content: 'Sample content',
          // Missing contentType, size, hash
        },
        // Missing processingSteps, decisionOutcome, etc.
      };

      const result = await validator.validateTrainingData(invalidTrainingData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('"inputData.contentType" is required');
    });

    it('should detect quality issues and generate warnings', async () => {
      const lowQualityData = {
        inputData: {
          content: 'This is a test message that is long enough', // Above minimum
          contentType: 'text',
          size: 45,
          hash: 'abc123',
        },
        processingSteps: [
          {
            step: 'sanitization',
            action: 'strip_scripts',
            timestamp: new Date().toISOString(),
          },
        ],
        decisionOutcome: {
          riskLevel: 'Low',
          actionsTaken: ['logged'],
          confidenceScore: 0.05, // Low confidence
        },
        featureVector: {
          contentLength: 45,
          specialCharsCount: 1,
          scriptTagsCount: 0,
          suspiciousPatternsCount: 0,
          entropyScore: 0.1,
        },
        trainingLabels: {
          riskCategory: 'safe',
          confidence: 0.95,
        },
        metadata: {
          collectionTimestamp: new Date().toISOString(),
          provenance: 'test',
          source: 'test',
          version: '1.0',
        },
      };

      const result = await validator.validateTrainingData(lowQualityData);

      expect(result.isValid).toBe(true); // Schema valid but quality warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain(
        'Decision confidence score 0.05 is below recommended minimum 0.1',
      );
    });

    it('should handle validation errors gracefully', async () => {
      const invalidData = null; // Invalid input

      const result = await validator.validateTrainingData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(mockAuditLogger.logValidation).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: false,
        }),
        expect.objectContaining({
          validationType: 'training_data_quality',
          severity: 'error',
        }),
      );
    });
  });

  describe('validateQualityMetrics', () => {
    it('should validate quality metrics correctly', () => {
      const goodData = {
        inputData: { size: 100 },
        processingSteps: [{}],
        decisionOutcome: { confidenceScore: 0.8 },
        featureVector: {
          contentLength: 100,
          specialCharsCount: 5,
          entropyScore: 0.7,
        },
        trainingLabels: { confidence: 0.9 },
        metadata: {
          collectionTimestamp: '2023-11-09T10:00:00.000Z',
          provenance: 'test',
          source: 'test',
          version: '1.0',
        },
      };

      const result = validator.validateQualityMetrics(goodData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect content length issues', () => {
      const shortContent = {
        inputData: { size: 5 }, // Too short
        processingSteps: [{}],
        featureVector: {},
        trainingLabels: {},
        metadata: {},
      };

      const result = validator.validateQualityMetrics(shortContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content length 5 is below minimum threshold 10');
    });

    it('should detect missing required features', () => {
      const missingFeatures = {
        inputData: { size: 100 },
        processingSteps: [{}],
        featureVector: {}, // Missing required fields
        trainingLabels: {},
        metadata: {
          collectionTimestamp: '2023-11-09T10:00:00.000Z',
          provenance: 'test',
          source: 'test',
          version: '1.0',
        },
      };

      const result = validator.validateQualityMetrics(missingFeatures);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Missing required feature fields: contentLength, specialCharsCount, entropyScore',
      );
    });
  });

  describe('validateTrainingDataBatch', () => {
    it('should validate a batch of training data', async () => {
      const batchData = [
        {
          inputData: {
            content: 'This is test content 1',
            contentType: 'text',
            size: 23,
            hash: 'h1',
          },
          processingSteps: [{ step: 'test', action: 'test', timestamp: new Date().toISOString() }],
          decisionOutcome: { riskLevel: 'Low', actionsTaken: [] },
          featureVector: {
            contentLength: 23,
            specialCharsCount: 0,
            scriptTagsCount: 0,
            suspiciousPatternsCount: 0,
            entropyScore: 0.5,
          },
          trainingLabels: { riskCategory: 'safe', confidence: 0.8 },
          metadata: {
            collectionTimestamp: new Date().toISOString(),
            provenance: 'test',
            source: 'test',
            version: '1.0',
          },
        },
        {
          inputData: {
            content: 'This is test content 2',
            contentType: 'text',
            size: 23,
            hash: 'h2',
          },
          processingSteps: [{ step: 'test', action: 'test', timestamp: new Date().toISOString() }],
          decisionOutcome: { riskLevel: 'High', actionsTaken: [] },
          featureVector: {
            contentLength: 23,
            specialCharsCount: 0,
            scriptTagsCount: 0,
            suspiciousPatternsCount: 0,
            entropyScore: 0.5,
          },
          trainingLabels: { riskCategory: 'malicious', confidence: 0.9 },
          metadata: {
            collectionTimestamp: new Date().toISOString(),
            provenance: 'test',
            source: 'test',
            version: '1.0',
          },
        },
      ];

      const result = await validator.validateTrainingDataBatch(batchData, {
        batchSource: 'test-batch',
      });

      expect(result.totalRecords).toBe(2);
      expect(result.validRecords).toBe(2);
      expect(result.invalidRecords).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(mockAuditLogger.logValidation).toHaveBeenCalledTimes(3); // 2 individual + 1 batch
    });
  });

  describe('getValidationStatistics', () => {
    it('should return validation statistics', () => {
      // Mock audit entries
      mockAuditLogger.getAuditEntries = jest.fn().mockReturnValue([
        {
          timestamp: '2023-11-09T10:00:00.000Z',
          details: { isValid: true, errors: [], processingTime: 100 },
        },
        {
          timestamp: '2023-11-09T10:01:00.000Z',
          details: { isValid: false, errors: ['error1'], processingTime: 150 },
        },
      ]);

      const stats = validator.getValidationStatistics();

      expect(stats.totalValidations).toBe(2);
      expect(stats.validCount).toBe(1);
      expect(stats.invalidCount).toBe(1);
      expect(stats.averageProcessingTime).toBe(125);
    });
  });
});
