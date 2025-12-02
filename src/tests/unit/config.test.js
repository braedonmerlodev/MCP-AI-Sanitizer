describe('Config Feature Flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    // Clear module cache
    delete require.cache[require.resolve('../../config/index')];
  });

  afterEach(() => {
    process.env = originalEnv;
    delete require.cache[require.resolve('../../config/index')];
  });

  describe('Trust Tokens Feature Flag', () => {
    test('should enable trust tokens by default', () => {
      delete process.env.TRUST_TOKENS_ENABLED;
      const freshConfig = require('../../config/index');
      expect(freshConfig.features.trustTokens.enabled).toBe(true);
    });

    test('should enable trust tokens when set to true', () => {
      process.env.TRUST_TOKENS_ENABLED = 'true';
      const freshConfig = require('../../config/index');
      expect(freshConfig.features.trustTokens.enabled).toBe(true);
    });

    test('should disable trust tokens when set to false', () => {
      process.env.TRUST_TOKENS_ENABLED = 'false';
      const freshConfig = require('../../config/index');
      expect(freshConfig.features.trustTokens.enabled).toBe(false);
    });

    test('should disable trust tokens when set to falsy strings', () => {
      process.env.TRUST_TOKENS_ENABLED = '0';
      const freshConfig = require('../../config/index');
      expect(freshConfig.features.trustTokens.enabled).toBe(false);

      process.env.TRUST_TOKENS_ENABLED = 'no';
      delete require.cache[require.resolve('../../config/index')];
      const freshConfig2 = require('../../config/index');
      expect(freshConfig2.features.trustTokens.enabled).toBe(false);
    });
  });
});
