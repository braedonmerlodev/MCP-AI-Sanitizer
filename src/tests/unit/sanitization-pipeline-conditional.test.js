const SanitizationPipeline = require('../../components/sanitization-pipeline');

describe('SanitizationPipeline Conditional Logic', () => {
  let pipeline;
  let mockAuditLogger;

  beforeEach(() => {
    mockAuditLogger = {
      logRiskAssessmentDecision: jest.fn().mockResolvedValue('audit-id'),
      logHighRiskCase: jest.fn().mockResolvedValue('audit-id'),
      logUnknownRiskCase: jest.fn().mockResolvedValue('audit-id'),
      logHighFidelityDataCollection: jest.fn().mockResolvedValue('audit-id'),
    };
    pipeline = new SanitizationPipeline({
      enableValidation: false, // Disable for unit tests
      auditLogger: mockAuditLogger,
    });
  });

  test('should apply full sanitization for LLM-bound content', async () => {
    const input = 'Hello\u200Bworld'; // Zero-width space
    const result = await pipeline.sanitize(input, { classification: 'llm' });
    expect(typeof result).toBe('string');
    expect(result).toBe('Helloworld'); // Zero-width removed
  });

  test('should bypass sanitization for non-LLM content', async () => {
    const input = 'Test data with homoglyphs: а';
    const result = await pipeline.sanitize(input, { classification: 'non-llm' });
    // Expect no transformation
    expect(result).toBe(input);
  });

  test('should default to full sanitization for unclear classification', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input, { classification: 'unclear' });
    expect(result).toBe('Helloworld');
  });

  test('should default to full sanitization when no options provided', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input);
    expect(result).toBe('Helloworld');
  });

  test('should bypass sanitization for low risk level', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input, { riskLevel: 'low' });
    expect(result).toBe('Hello\u200Bworld'); // Preserved
  });

  test('should apply full sanitization for high risk level', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input, { riskLevel: 'high' });
    expect(result).toBe('Helloworld'); // Sanitized
  });

  test('should apply full sanitization for medium risk level', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input, { riskLevel: 'medium' });
    expect(result).toBe('Helloworld'); // Sanitized
  });

  test('should handle zero-width characters in LLM content', async () => {
    const input = 'Hello\u200Bworld'; // Zero-width space
    const result = await pipeline.sanitize(input, { classification: 'llm' });
    expect(result).toBe('Helloworld'); // Zero-width removed
  });

  test('should preserve zero-width characters in non-LLM content', async () => {
    const input = 'Hello\u200Bworld';
    const result = await pipeline.sanitize(input, { classification: 'non-llm' });
    expect(result).toBe('Hello\u200Bworld'); // Preserved
  });

  describe('Trust Token Generation', () => {
    let pipelineWithTokens;

    beforeEach(() => {
      pipelineWithTokens = new SanitizationPipeline({
        enableValidation: false,
        trustTokenOptions: { secret: 'test-secret-for-pipeline' },
      });
    });

    test('should return string when trust token not requested', async () => {
      const input = 'Hello\u200Bworld';
      const result = await pipelineWithTokens.sanitize(input, { classification: 'llm' });
      expect(typeof result).toBe('string');
      expect(result).toBe('Helloworld');
    });

    test('should return object with trust token when requested', async () => {
      const input = 'Hello\u200Bworld';
      const result = await pipelineWithTokens.sanitize(input, {
        classification: 'llm',
        generateTrustToken: true,
      });

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('sanitizedData', 'Helloworld');
      expect(result).toHaveProperty('trustToken');

      const token = result.trustToken;
      expect(token).toHaveProperty('contentHash');
      expect(token).toHaveProperty('originalHash');
      expect(token).toHaveProperty('sanitizationVersion');
      expect(token).toHaveProperty('rulesApplied');
      expect(Array.isArray(token.rulesApplied)).toBe(true);
      expect(token.rulesApplied.length).toBeGreaterThan(0);
      expect(token).toHaveProperty('timestamp');
      expect(token).toHaveProperty('expiresAt');
      expect(token).toHaveProperty('signature');
    });

    test('should include applied rules in trust token', async () => {
      const input = 'test input';
      const result = await pipelineWithTokens.sanitize(input, {
        classification: 'llm',
        generateTrustToken: true,
      });

      const appliedRules = result.trustToken.rulesApplied;
      expect(appliedRules).toContain('UnicodeNormalization');
      expect(appliedRules).toContain('SymbolStripping');
      expect(appliedRules).toContain('EscapeNeutralization');
      expect(appliedRules).toContain('PatternRedaction');
    });

    test('should generate different tokens for different content', async () => {
      const result1 = await pipelineWithTokens.sanitize('content1', {
        classification: 'llm',
        generateTrustToken: true,
      });
      const result2 = await pipelineWithTokens.sanitize('content2', {
        classification: 'llm',
        generateTrustToken: true,
      });

      expect(result1.trustToken.contentHash).not.toBe(result2.trustToken.contentHash);
      expect(result1.trustToken.signature).not.toBe(result2.trustToken.signature);
    });
  });

  describe('Risk Assessment Logging Integration', () => {
    test('should log classification decision for low risk level', async () => {
      const input = 'test data';
      await pipeline.sanitize(input, { riskLevel: 'low', userId: 'user123', resourceId: 'res456' });

      expect(mockAuditLogger.logRiskAssessmentDecision).toHaveBeenCalledWith(
        'classification',
        'low',
        { riskScore: 0, triggers: [] },
        { userId: 'user123', resourceId: 'res456', stage: 'risk-assessment' },
      );
    });

    test('should log detection decision for high risk level', async () => {
      const input = 'test data';
      await pipeline.sanitize(input, {
        riskLevel: 'high',
        userId: 'user123',
        resourceId: 'res456',
      });

      expect(mockAuditLogger.logRiskAssessmentDecision).toHaveBeenCalledWith(
        'detection',
        'high',
        { riskScore: 0, triggers: [] },
        { userId: 'user123', resourceId: 'res456', stage: 'risk-assessment' },
      );
    });

    test('should log classification for non-llm classification', async () => {
      const input = 'test data';
      await pipeline.sanitize(input, {
        classification: 'non-llm',
        userId: 'user123',
        resourceId: 'res456',
      });

      expect(mockAuditLogger.logRiskAssessmentDecision).toHaveBeenCalledWith(
        'classification',
        'Low',
        { riskScore: 0, triggers: [] },
        { userId: 'user123', resourceId: 'res456', stage: 'risk-assessment' },
      );
    });

    test('should log classification for unclear classification', async () => {
      const input = 'test data';
      await pipeline.sanitize(input, {
        classification: 'unclear',
        userId: 'user123',
        resourceId: 'res456',
      });

      expect(mockAuditLogger.logRiskAssessmentDecision).toHaveBeenCalledWith(
        'classification',
        'Unknown',
        { riskScore: 0, triggers: [] },
        { userId: 'user123', resourceId: 'res456', stage: 'risk-assessment' },
      );
    });

    test('should include riskScore and triggers in logging', async () => {
      const input = 'test data';
      await pipeline.sanitize(input, {
        riskLevel: 'high',
        userId: 'user123',
        resourceId: 'res456',
        riskScore: 0.85,
        triggers: ['pattern1', 'pattern2'],
      });

      expect(mockAuditLogger.logRiskAssessmentDecision).toHaveBeenCalledWith(
        'detection',
        'high',
        { riskScore: 0.85, triggers: ['pattern1', 'pattern2'] },
        { userId: 'user123', resourceId: 'res456', stage: 'risk-assessment' },
      );
    });
  });
});
