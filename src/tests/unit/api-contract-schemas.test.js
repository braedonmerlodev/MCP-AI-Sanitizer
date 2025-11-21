const { requestSchemas, responseSchemas } = require('../../schemas/api-contract-schemas');

describe('API Contract Schemas', () => {
  describe('Request Schemas', () => {
    it('should validate valid trust-tokens/validate request', () => {
      const validRequest = {
        contentHash: 'abc123',
        originalHash: 'def456',
        sanitizationVersion: '1.0.0',
        rulesApplied: ['rule1', 'rule2'],
        timestamp: '2023-01-01T00:00:00.000Z',
        expiresAt: '2023-01-02T00:00:00.000Z',
        signature: 'sig123',
      };

      const { error } = requestSchemas['/api/trust-tokens/validate'].validate(validRequest);
      expect(error).toBeUndefined();
    });

    it('should reject invalid trust-tokens/validate request', () => {
      const invalidRequest = {
        // missing required fields
        contentHash: 'abc123',
      };

      const { error } = requestSchemas['/api/trust-tokens/validate'].validate(invalidRequest);
      expect(error).toBeDefined();
    });
  });

  describe('Response Schemas', () => {
    it('should validate valid trust-tokens/validate success response', () => {
      const validResponse = {
        valid: true,
        message: 'Token is valid',
      };

      const { error } = responseSchemas['/api/trust-tokens/validate'].validate(validResponse);
      expect(error).toBeUndefined();
    });

    it('should validate valid trust-tokens/validate error response', () => {
      const validResponse = {
        valid: false,
        error: 'Invalid signature',
      };

      const { error } = responseSchemas['/api/trust-tokens/validate'].validate(validResponse);
      expect(error).toBeUndefined();
    });

    it('should reject invalid trust-tokens/validate response', () => {
      const invalidResponse = {
        valid: 'not boolean',
        message: 123,
      };

      const { error } = responseSchemas['/api/trust-tokens/validate'].validate(invalidResponse);
      expect(error).toBeDefined();
    });
  });
});
