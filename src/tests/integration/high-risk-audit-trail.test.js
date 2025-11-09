const SanitizationPipeline = require('../../components/sanitization-pipeline');
const AuditLogger = require('../../components/data-integrity/AuditLogger');

describe('High-Risk Audit Trail Integration', () => {
  let pipeline;
  let auditLogger;

  beforeEach(() => {
    // Use memory-only audit logger for testing
    auditLogger = new AuditLogger({
      enableConsole: false,
      maxTrailSize: 100,
    });

    pipeline = new SanitizationPipeline({
      auditLogger,
      enableValidation: false, // Disable for faster tests
    });
  });

  describe('High-Risk Case Logging', () => {
    test('should log high-risk case with ML fields when confidence > 0.8', async () => {
      const testData = 'potentially malicious content';
      const options = {
        riskLevel: 'High',
        riskScore: 0.95,
        userId: 'test-user-123',
        resourceId: 'resource-456',
        sessionId: 'session-789',
        triggers: ['malicious_pattern', 'suspicious_content'],
        threatPatternId: 'pattern-001',
        mitigationActions: ['block', 'alert'],
        featureVector: { indicators: ['malicious', 'suspicious'] },
        trainingLabels: { supervised: 'high_risk' },
        anomalyScore: 0.9,
      };

      await pipeline.sanitize(testData, options);

      // Verify high-risk case was logged
      const highRiskEntries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(highRiskEntries).toHaveLength(1);

      const entry = highRiskEntries[0];
      expect(entry.operation).toBe('high_risk_case');
      expect(entry.details.userId).toBe('test-user-123');
      expect(entry.details.resourceId).toBe('resource-456');
      expect(entry.details.sessionId).toBe('session-789');
      expect(entry.details.stage).toBe('high_risk_detection');

      // Verify ML fields
      expect(entry.details.mlFields).toBeDefined();
      expect(entry.details.mlFields.threatPatternId).toBe('pattern-001');
      expect(entry.details.mlFields.confidenceScore).toBe(0.95);
      expect(entry.details.mlFields.mitigationActions).toEqual(['block', 'alert']);
      expect(entry.details.mlFields.featureVector).toEqual({
        indicators: ['malicious', 'suspicious'],
      });
      expect(entry.details.mlFields.trainingLabels).toEqual({ supervised: 'high_risk' });
      expect(entry.details.mlFields.anomalyScore).toBe(0.9);
      expect(entry.details.mlFields.riskCategory).toBe('high');
      expect(entry.details.mlFields.detectionTimestamp).toBeDefined();

      // Verify context
      expect(entry.context.userId).toBe('test-user-123');
      expect(entry.context.stage).toBe('high_risk_detection');
      expect(entry.context.severity).toBe('warning');
      expect(entry.context.logger).toBe('HighRiskLogger');
    });

    test('should not log high-risk case when confidence <= 0.8', async () => {
      const testData = 'normal content';
      const options = {
        riskLevel: 'High',
        riskScore: 0.7, // Below threshold
        userId: 'test-user-123',
      };

      await pipeline.sanitize(testData, options);

      // Verify no high-risk case was logged
      const highRiskEntries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(highRiskEntries).toHaveLength(0);
    });

    test('should handle missing ML fields with defaults', async () => {
      const testData = 'high risk content';
      const options = {
        riskLevel: 'High',
        riskScore: 0.9,
        userId: 'test-user-123',
        resourceId: 'resource-456',
      };

      await pipeline.sanitize(testData, options);

      const highRiskEntries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(highRiskEntries).toHaveLength(1);

      const entry = highRiskEntries[0];
      expect(entry.details.mlFields.threatPatternId).toBe('unknown'); // Default from triggers
      expect(entry.details.mlFields.confidenceScore).toBe(0.9);
      expect(entry.details.mlFields.mitigationActions).toEqual(['sanitization_applied']);
      expect(entry.details.mlFields.featureVector).toEqual({ riskIndicators: [] });
      expect(entry.details.mlFields.trainingLabels).toEqual({ supervised: 'high_risk' });
      expect(entry.details.mlFields.anomalyScore).toBe(0.9);
      expect(entry.details.mlFields.riskCategory).toBe('high');
    });
  });

  describe('Unknown-Risk Case Logging', () => {
    test('should log unknown-risk case with ML fields when confidence < 0.3', async () => {
      const testData = 'unclear content';
      const options = {
        riskLevel: 'Unknown',
        riskScore: 0.2,
        userId: 'test-user-456',
        resourceId: 'resource-789',
        sessionId: 'session-101',
        triggers: ['unclear_pattern'],
        threatPatternId: 'unknown-001',
        mitigationActions: ['review'],
        featureVector: { indicators: ['unclear'] },
        trainingLabels: { supervised: 'unknown_risk' },
        anomalyScore: 0.8,
      };

      await pipeline.sanitize(testData, options);

      // Verify unknown-risk case was logged
      const unknownRiskEntries = auditLogger.getAuditEntries({ operation: 'unknown_risk_case' });
      expect(unknownRiskEntries).toHaveLength(1);

      const entry = unknownRiskEntries[0];
      expect(entry.operation).toBe('unknown_risk_case');
      expect(entry.details.userId).toBe('test-user-456');
      expect(entry.details.resourceId).toBe('resource-789');
      expect(entry.details.sessionId).toBe('session-101');
      expect(entry.details.stage).toBe('unknown_risk_detection');

      // Verify ML fields
      expect(entry.details.mlFields).toBeDefined();
      expect(entry.details.mlFields.threatPatternId).toBe('unknown-001');
      expect(entry.details.mlFields.confidenceScore).toBe(0.2);
      expect(entry.details.mlFields.mitigationActions).toEqual(['review']);
      expect(entry.details.mlFields.featureVector).toEqual({ indicators: ['unclear'] });
      expect(entry.details.mlFields.trainingLabels).toEqual({ supervised: 'unknown_risk' });
      expect(entry.details.mlFields.anomalyScore).toBe(0.8);
      expect(entry.details.mlFields.riskCategory).toBe('unknown');
      expect(entry.details.mlFields.detectionTimestamp).toBeDefined();

      // Verify context
      expect(entry.context.userId).toBe('test-user-456');
      expect(entry.context.stage).toBe('unknown_risk_detection');
      expect(entry.context.severity).toBe('info');
      expect(entry.context.logger).toBe('UnknownRiskLogger');
    });

    test('should not log unknown-risk case when confidence >= 0.3', async () => {
      const testData = 'somewhat clear content';
      const options = {
        riskLevel: 'Unknown',
        riskScore: 0.4, // Above threshold
        userId: 'test-user-456',
      };

      await pipeline.sanitize(testData, options);

      // Verify no unknown-risk case was logged
      const unknownRiskEntries = auditLogger.getAuditEntries({ operation: 'unknown_risk_case' });
      expect(unknownRiskEntries).toHaveLength(0);
    });

    test('should handle missing ML fields with defaults for unknown risk', async () => {
      const testData = 'unknown risk content';
      const options = {
        riskLevel: 'Unknown',
        riskScore: 0.1,
        userId: 'test-user-456',
        resourceId: 'resource-789',
      };

      await pipeline.sanitize(testData, options);

      const unknownRiskEntries = auditLogger.getAuditEntries({ operation: 'unknown_risk_case' });
      expect(unknownRiskEntries).toHaveLength(1);

      const entry = unknownRiskEntries[0];
      expect(entry.details.mlFields.threatPatternId).toBe('unknown_pattern');
      expect(entry.details.mlFields.confidenceScore).toBe(0.1);
      expect(entry.details.mlFields.mitigationActions).toEqual(['hitl_required']);
      expect(entry.details.mlFields.featureVector).toEqual({ riskIndicators: ['unclear_threat'] });
      expect(entry.details.mlFields.trainingLabels).toEqual({ supervised: 'unknown_risk' });
      expect(entry.details.mlFields.anomalyScore).toBe(0.9); // 1 - 0.1
      expect(entry.details.mlFields.riskCategory).toBe('unknown');
    });
  });

  describe('PII Redaction in Audit Trails', () => {
    test('should redact PII in high-risk case metadata', async () => {
      const testData = 'content with email';
      const options = {
        riskLevel: 'High',
        riskScore: 0.95,
        userId: 'user@example.com',
        resourceId: 'resource-456',
      };

      await pipeline.sanitize(testData, options);

      const highRiskEntries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(highRiskEntries).toHaveLength(1);

      const entry = highRiskEntries[0];
      expect(entry.context.userId).toBe('[EMAIL_REDACTED]');
      expect(entry.details.userId).toBe('user@example.com'); // Details not redacted
    });

    test('should redact PII in unknown-risk case metadata', async () => {
      const testData = 'content with phone';
      const options = {
        riskLevel: 'Unknown',
        riskScore: 0.1,
        userId: 'user@example.com',
        resourceId: 'resource-789',
      };

      await pipeline.sanitize(testData, options);

      const unknownRiskEntries = auditLogger.getAuditEntries({ operation: 'unknown_risk_case' });
      expect(unknownRiskEntries).toHaveLength(1);

      const entry = unknownRiskEntries[0];
      expect(entry.context.userId).toBe('[EMAIL_REDACTED]');
    });
  });

  describe('Concurrent High-Risk Detections', () => {
    test('should handle multiple high-risk cases in sequence', async () => {
      const testData1 = 'first malicious content';
      const testData2 = 'second malicious content';

      const options1 = {
        riskLevel: 'High',
        riskScore: 0.95,
        userId: 'user1',
        resourceId: 'res1',
      };

      const options2 = {
        riskLevel: 'High',
        riskScore: 0.9,
        userId: 'user2',
        resourceId: 'res2',
      };

      await pipeline.sanitize(testData1, options1);
      await pipeline.sanitize(testData2, options2);

      const highRiskEntries = auditLogger.getAuditEntries({ operation: 'high_risk_case' });
      expect(highRiskEntries).toHaveLength(2);

      // Verify each entry has correct data
      expect(highRiskEntries[0].details.userId).toBe('user1');
      expect(highRiskEntries[0].details.mlFields.confidenceScore).toBe(0.95);

      expect(highRiskEntries[1].details.userId).toBe('user2');
      expect(highRiskEntries[1].details.mlFields.confidenceScore).toBe(0.9);
    });
  });
});
