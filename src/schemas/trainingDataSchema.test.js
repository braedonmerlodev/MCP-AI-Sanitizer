const trainingDataSchema = require('../schemas/trainingDataSchema');

describe('TrainingDataSchema', () => {
  describe('valid training data', () => {
    const validData = {
      id: 'train_1234567890_abc123',
      timestamp: '2025-11-09T18:32:20.577Z',
      sessionId: 'sess_456789',
      inputFeatures: {
        length: 1024,
        type: 'text',
        encoding: 'utf-8',
        hasSpecialChars: true,
        hasUnicode: false,
        languageDetected: 'en',
      },
      processingFeatures: {
        steps: ['validation', 'normalization', 'sanitization'],
        sanitizationApplied: true,
        sanitizationLevel: 'advanced',
        validationPassed: true,
        provenanceValidated: true,
        processingTimeMs: 150,
      },
      riskFeatures: {
        riskScore: 0.85,
        confidenceScore: 0.92,
        anomalyScore: 0.15,
        threatPatternId: 'pattern_001',
        riskCategory: 'High',
        featureVector: { feature1: 0.5, feature2: 1.2 },
      },
      labels: {
        finalDecision: 'sanitize',
        riskLevel: 'High',
        actionTaken: 'advanced_sanitization',
        effectivenessScore: 0.95,
        trainingLabels: { supervised: true, category: 'malicious' },
      },
      context: {
        userId: 'user_anon_123',
        destination: 'llm_endpoint',
        source: 'n8n',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
      quality: {
        dataCompleteness: 0.98,
        validationErrors: [],
        isValidForTraining: true,
      },
    };

    it('should validate successfully with complete valid data', () => {
      const { error } = trainingDataSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should validate successfully with minimal required data', () => {
      const minimalData = {
        id: 'train_123',
        timestamp: '2025-11-09T18:32:20.577Z',
        sessionId: 'sess_456',
        inputFeatures: {
          length: 100,
          type: 'text',
          hasSpecialChars: false,
          hasUnicode: false,
        },
        processingFeatures: {
          steps: ['validation'],
          sanitizationApplied: false,
          sanitizationLevel: 'none',
          validationPassed: true,
          provenanceValidated: false,
          processingTimeMs: 50,
        },
        riskFeatures: {
          riskScore: 0.1,
          confidenceScore: 0.8,
          anomalyScore: 0.05,
          riskCategory: 'Low',
        },
        labels: {
          finalDecision: 'allow',
          riskLevel: 'Low',
          actionTaken: 'no_action',
        },
        context: {
          source: 'direct',
        },
        quality: {
          dataCompleteness: 0.9,
          isValidForTraining: true,
        },
      };

      const { error } = trainingDataSchema.validate(minimalData);
      expect(error).toBeUndefined();
    });
  });

  describe('invalid training data', () => {
    it('should reject missing required fields', () => {
      const invalidData = {
        id: 'train_123',
        // missing timestamp, sessionId, etc.
      };

      const { error } = trainingDataSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details.length).toBeGreaterThan(0);
    });

    it('should reject invalid risk score range', () => {
      const invalidData = {
        id: 'train_123',
        timestamp: '2025-11-09T18:32:20.577Z',
        sessionId: 'sess_456',
        inputFeatures: {
          length: 100,
          type: 'text',
          hasSpecialChars: false,
          hasUnicode: false,
        },
        processingFeatures: {
          steps: ['validation'],
          sanitizationApplied: false,
          sanitizationLevel: 'none',
          validationPassed: true,
          provenanceValidated: false,
          processingTimeMs: 50,
        },
        riskFeatures: {
          riskScore: 1.5, // invalid: > 1
          confidenceScore: 0.8,
          anomalyScore: 0.05,
          riskCategory: 'Low',
        },
        labels: {
          finalDecision: 'allow',
          riskLevel: 'Low',
          actionTaken: 'no_action',
        },
        context: {
          source: 'direct',
        },
        quality: {
          dataCompleteness: 0.9,
          isValidForTraining: true,
        },
      };

      const { error } = trainingDataSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('riskScore');
    });

    it('should reject invalid input type', () => {
      const invalidData = {
        id: 'train_123',
        timestamp: '2025-11-09T18:32:20.577Z',
        sessionId: 'sess_456',
        inputFeatures: {
          length: 100,
          type: 'invalid_type', // invalid
          hasSpecialChars: false,
          hasUnicode: false,
        },
        processingFeatures: {
          steps: ['validation'],
          sanitizationApplied: false,
          sanitizationLevel: 'none',
          validationPassed: true,
          provenanceValidated: false,
          processingTimeMs: 50,
        },
        riskFeatures: {
          riskScore: 0.1,
          confidenceScore: 0.8,
          anomalyScore: 0.05,
          riskCategory: 'Low',
        },
        labels: {
          finalDecision: 'allow',
          riskLevel: 'Low',
          actionTaken: 'no_action',
        },
        context: {
          source: 'direct',
        },
        quality: {
          dataCompleteness: 0.9,
          isValidForTraining: true,
        },
      };

      const { error } = trainingDataSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('type');
    });

    it('should reject negative processing time', () => {
      const invalidData = {
        id: 'train_123',
        timestamp: '2025-11-09T18:32:20.577Z',
        sessionId: 'sess_456',
        inputFeatures: {
          length: 100,
          type: 'text',
          hasSpecialChars: false,
          hasUnicode: false,
        },
        processingFeatures: {
          steps: ['validation'],
          sanitizationApplied: false,
          sanitizationLevel: 'none',
          validationPassed: true,
          provenanceValidated: false,
          processingTimeMs: -10, // invalid
        },
        riskFeatures: {
          riskScore: 0.1,
          confidenceScore: 0.8,
          anomalyScore: 0.05,
          riskCategory: 'Low',
        },
        labels: {
          finalDecision: 'allow',
          riskLevel: 'Low',
          actionTaken: 'no_action',
        },
        context: {
          source: 'direct',
        },
        quality: {
          dataCompleteness: 0.9,
          isValidForTraining: true,
        },
      };

      const { error } = trainingDataSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('processingTimeMs');
    });
  });
});
