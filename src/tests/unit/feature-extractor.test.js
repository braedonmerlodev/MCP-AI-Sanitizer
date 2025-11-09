const FeatureExtractor = require('../../components/data-integrity/FeatureExtractor');

describe('FeatureExtractor', () => {
  let featureExtractor;

  beforeEach(() => {
    featureExtractor = new FeatureExtractor();
  });

  describe('extractFeatures', () => {
    it('should extract comprehensive features from risk data', () => {
      const riskData = {
        content: '<script>alert("xss")</script><img src="javascript:alert(1)">',
        metadata: {
          userAgent: 'Mozilla/5.0 (compatible; Bot/1.0)',
          timestamp: '2023-11-09T10:00:00Z',
          requestCount: 150,
          timeWindow: 60,
        },
        processingSteps: [
          { step: 'validation', action: 'validate', result: { errors: ['Invalid input'] } },
        ],
        context: { stage: 'assessment' },
      };

      const features = featureExtractor.extractFeatures(riskData);

      expect(features).toHaveProperty('contentLength');
      expect(features).toHaveProperty('scriptTagsCount');
      expect(features).toHaveProperty('entropyScore');
      expect(features).toHaveProperty('processingStepsCount');
      expect(features).toHaveProperty('userAgentAnomaly');
      expect(features).toHaveProperty('riskScore');
      expect(features).toHaveProperty('threatLevel');
    });

    it('should handle empty content gracefully', () => {
      const riskData = {
        content: '',
        metadata: {},
        processingSteps: [],
        context: {},
      };

      const features = featureExtractor.extractFeatures(riskData);

      expect(features.contentLength).toBe(0);
      expect(features.entropyScore).toBe(0);
    });
  });

  describe('extractContentFeatures', () => {
    it('should extract content-based features', () => {
      const content = 'SELECT * FROM users; <script>malicious</script>';
      const features = featureExtractor.extractContentFeatures(content);

      expect(features.contentLength).toBe(content.length);
      expect(features.scriptTagsCount).toBe(1);
      expect(features.sqlInjectionCount).toBe(1);
      expect(features.suspiciousPatternsCount).toBeGreaterThan(0);
    });
  });

  describe('extractRiskIndicators', () => {
    it('should calculate risk scores based on patterns', () => {
      const content = '<script>alert(1)</script><iframe src="evil.com"></iframe>';
      const features = featureExtractor.extractRiskIndicators(content);

      expect(features.riskScore).toBeGreaterThan(0);
      expect(features.threatLevel).toBe('high');
      expect(features.anomalyIndicators).toContain('xss_attempt');
    });
  });

  describe('calculateEntropy', () => {
    it('should calculate Shannon entropy correctly', () => {
      const uniformString = 'abcdefghijk'; // High entropy
      const repetitiveString = 'aaaaaaa'; // Low entropy

      const highEntropy = featureExtractor.calculateEntropy(uniformString);
      const lowEntropy = featureExtractor.calculateEntropy(repetitiveString);

      expect(highEntropy).toBeGreaterThan(lowEntropy);
      expect(highEntropy).toBeLessThanOrEqual(1);
      expect(lowEntropy).toBeLessThanOrEqual(1);
    });
  });

  describe('generateMLFeatureVector', () => {
    it('should generate ML-compatible feature vector', () => {
      const features = {
        contentLength: 100,
        scriptTagsCount: 2,
        entropyScore: 0.8,
        riskScore: 0.9,
        threatLevel: 'high',
      };

      const mlVector = featureExtractor.generateMLFeatureVector(features);

      expect(mlVector).toHaveProperty('features');
      expect(mlVector).toHaveProperty('featureNames');
      expect(mlVector).toHaveProperty('metadata');
      expect(mlVector.metadata.frameworkCompatible).toContain('scikit-learn');
    });
  });
});
