const sanitizationConfig = require('../../config/sanitizationConfig');

describe('SanitizationConfig', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env.SANITIZATION_RISK_MAPPINGS;
    delete process.env.SANITIZATION_RISK_MAPPINGS;
    // Reset the config instance for testing
    sanitizationConfig.riskMappings = sanitizationConfig.loadRiskMappings();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv) {
      process.env.SANITIZATION_RISK_MAPPINGS = originalEnv;
    } else {
      delete process.env.SANITIZATION_RISK_MAPPINGS;
    }
  });

  describe('loadRiskMappings', () => {
    it('should return default mappings when no config is provided', () => {
      const mappings = sanitizationConfig.loadRiskMappings();
      expect(mappings).toEqual({
        llm: 'high',
        'non-llm': 'low',
        unclear: 'medium',
        internal: 'low',
        external: 'high',
      });
    });

    it('should load mappings from environment variable', () => {
      process.env.SANITIZATION_RISK_MAPPINGS = '{"llm":"low","custom":"high"}';
      const mappings = sanitizationConfig.loadRiskMappings();
      expect(mappings).toEqual({
        llm: 'low',
        'non-llm': 'low',
        unclear: 'medium',
        internal: 'low',
        external: 'high',
        custom: 'high',
      });
    });

    it('should fallback to defaults when env var is invalid JSON', () => {
      process.env.SANITIZATION_RISK_MAPPINGS = 'invalid json';
      const mappings = sanitizationConfig.loadRiskMappings();
      expect(mappings).toEqual({
        llm: 'high',
        'non-llm': 'low',
        unclear: 'medium',
        internal: 'low',
        external: 'high',
      });
    });

    it('should validate mappings and reject invalid risk levels', () => {
      process.env.SANITIZATION_RISK_MAPPINGS = '{"llm":"invalid"}';
      const mappings = sanitizationConfig.loadRiskMappings();
      expect(mappings).toEqual({
        llm: 'high',
        'non-llm': 'low',
        unclear: 'medium',
        internal: 'low',
        external: 'high',
      });
    });

    it('should validate mappings and reject non-string keys or values', () => {
      process.env.SANITIZATION_RISK_MAPPINGS = '{"llm":123}';
      const mappings = sanitizationConfig.loadRiskMappings();
      expect(mappings).toEqual({
        llm: 'high',
        'non-llm': 'low',
        unclear: 'medium',
        internal: 'low',
        external: 'high',
      });
    });
  });

  describe('validateMappings', () => {
    it('should return true for valid mappings', () => {
      const validMappings = { llm: 'high', internal: 'low' };
      expect(sanitizationConfig.validateMappings(validMappings)).toBe(true);
    });

    it('should return false for invalid mappings', () => {
      expect(sanitizationConfig.validateMappings(null)).toBe(false);
      expect(sanitizationConfig.validateMappings({ llm: 'invalid' })).toBe(false);
      expect(sanitizationConfig.validateMappings({ llm: 123 })).toBe(false);
    });
  });

  describe('getRiskLevel', () => {
    it('should return correct risk level for known classifications', () => {
      expect(sanitizationConfig.getRiskLevel('llm')).toBe('high');
      expect(sanitizationConfig.getRiskLevel('non-llm')).toBe('low');
      expect(sanitizationConfig.getRiskLevel('internal')).toBe('low');
    });

    it('should return medium for unknown classifications', () => {
      expect(sanitizationConfig.getRiskLevel('unknown')).toBe('medium');
    });

    it('should return medium for unclear classification', () => {
      expect(sanitizationConfig.getRiskLevel('unclear')).toBe('medium');
    });
  });
});
