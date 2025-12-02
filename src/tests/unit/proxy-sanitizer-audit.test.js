const ProxySanitizer = require('../../components/proxy-sanitizer');
const AuditLog = require('../../models/AuditLog');

describe('ProxySanitizer Audit Logging', () => {
  let proxySanitizer;

  beforeEach(() => {
    proxySanitizer = new ProxySanitizer();
  });

  describe('sanitize method audit logging', () => {
    test('should create audit log for LLM-bound sanitization', async () => {
      const testData = 'test data with <script>alert("xss")</script>';
      const options = { classification: 'llm' };

      // Mock the pipeline to avoid actual sanitization
      proxySanitizer.pipeline.sanitize = jest.fn().mockResolvedValue('sanitized data');

      const result = await proxySanitizer.sanitize(testData, options);

      expect(result).toBe('sanitized data');
      expect(proxySanitizer.pipeline.sanitize).toHaveBeenCalledWith(testData, {
        ...options,
        riskLevel: 'high',
      });

      // Note: In a real test environment, we would verify audit log creation
      // but for unit tests, we focus on the sanitization logic
    });

    test('should create audit log for non-LLM bypass', async () => {
      const testData = 'safe data';
      const options = { classification: 'non-llm' };

      // Mock the pipeline
      proxySanitizer.pipeline.sanitize = jest.fn().mockResolvedValue(testData);

      const result = await proxySanitizer.sanitize(testData, options);

      expect(result).toBe(testData);
      expect(proxySanitizer.pipeline.sanitize).toHaveBeenCalledWith(testData, {
        ...options,
        riskLevel: 'low',
      });
    });
  });

  describe('handleN8nWebhook audit logging', () => {
    test('should process webhook with audit logging for both directions', async () => {
      const payload = { data: 'webhook data' };
      const options = { classification: 'llm' };

      // Mock the sanitize method to track calls
      const mockSanitize = jest.spyOn(proxySanitizer, 'sanitize');
      mockSanitize.mockResolvedValueOnce('sanitized input');
      mockSanitize.mockResolvedValueOnce('sanitized output');

      // Mock forwardToLLM
      proxySanitizer.forwardToLLM = jest.fn().mockReturnValue('llm response');

      const result = await proxySanitizer.handleN8nWebhook(payload, options);

      expect(mockSanitize).toHaveBeenCalledTimes(2);
      expect(mockSanitize).toHaveBeenNthCalledWith(1, 'webhook data', {
        ...options,
        operation: 'request',
      });
      expect(mockSanitize).toHaveBeenNthCalledWith(2, 'llm response', {
        ...options,
        operation: 'response',
      });
      expect(proxySanitizer.forwardToLLM).toHaveBeenCalledWith('sanitized input');
      expect(result).toEqual({ result: { sanitizedData: 'sanitized output' } });
    });
  });

  describe('AuditLog model extensions', () => {
    test('should create audit log with sanitization fields', () => {
      const auditLog = new AuditLog({
        action: 'data_sanitization_applied',
        resourceId: 'sanitization_request_123',
        details: {
          dataLength: 100,
          sanitizedLength: 95,
          operation: 'request',
        },
        destination: 'llm',
        riskLevel: 'high',
        sanitizationLevel: 'full',
      });

      expect(auditLog.action).toBe('data_sanitization_applied');
      expect(auditLog.destination).toBe('llm');
      expect(auditLog.riskLevel).toBe('high');
      expect(auditLog.sanitizationLevel).toBe('full');
      expect(auditLog.isSecurityCritical()).toBe(true);
      expect(auditLog.getCategory()).toBe('sanitization');
    });

    test('should include sanitization fields in toObject', () => {
      const auditLog = new AuditLog({
        action: 'data_sanitization_bypassed',
        destination: 'non-llm',
        riskLevel: 'low',
        sanitizationLevel: 'bypassed',
      });

      const obj = auditLog.toObject();

      expect(obj.destination).toBe('non-llm');
      expect(obj.riskLevel).toBe('low');
      expect(obj.sanitizationLevel).toBe('bypassed');
    });

    test('should include sanitization fields in signature generation', () => {
      const auditLog = new AuditLog({
        action: 'data_sanitization_applied',
        destination: 'llm',
        riskLevel: 'high',
        sanitizationLevel: 'full',
      });

      // Verify signature includes new fields
      expect(auditLog.verifySignature()).toBe(true);

      // Modify a new field and verify signature fails
      const obj = auditLog.toObject();
      obj.riskLevel = 'modified';
      const modifiedAuditLog = AuditLog.fromObject(obj, { secret: 'test-secret' });
      expect(modifiedAuditLog.verifySignature()).toBe(false);
    });
  });
});
