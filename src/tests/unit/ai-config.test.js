// Mock dotenv before any requires
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('AI Config', () => {
  const originalEnv = process.env;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.resetModules();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Reset env
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleWarnSpy.mockRestore();
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    test('should load valid config when OPENAI_API_KEY is properly set', () => {
      const validKey = 'sk-' + 'a'.repeat(48);
      process.env.OPENAI_API_KEY = validKey;
      const config = require('../../config/aiConfig');
      expect(config.openai.apiKey).toBe(validKey);
      expect(config.openai.isValid).toBe(true);
    });

    test('should throw error when OPENAI_API_KEY is not set in production', () => {
      expect(() => require('../../config/aiConfig')).toThrow(
        'OPENAI_API_KEY environment variable must be set in production',
      );
    });

    test('should throw error for invalid format (no sk- prefix)', () => {
      process.env.OPENAI_API_KEY = 'invalid-key';
      expect(() => require('../../config/aiConfig')).toThrow(
        'OPENAI_API_KEY must start with "sk-"',
      );
    });

    test('should throw error for invalid length', () => {
      process.env.OPENAI_API_KEY = 'sk-short';
      expect(() => require('../../config/aiConfig')).toThrow(
        'OPENAI_API_KEY must be exactly 51 characters, got 8',
      );
    });

    test('should throw error for non-alphanumeric characters', () => {
      const invalidKey = 'sk-' + 'a'.repeat(47) + '!';
      process.env.OPENAI_API_KEY = invalidKey;
      expect(() => require('../../config/aiConfig')).toThrow(
        'OPENAI_API_KEY must contain only alphanumeric characters after "sk-"',
      );
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should load config and warn when OPENAI_API_KEY is not set', () => {
      const config = require('../../config/aiConfig');
      expect(config.openai.apiKey).toBeUndefined();
      expect(config.openai.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'OPENAI_API_KEY not set - AI features may not work in development',
      );
    });

    test('should load valid config when OPENAI_API_KEY is properly set', () => {
      const validKey = 'sk-' + 'a'.repeat(48);
      process.env.OPENAI_API_KEY = validKey;
      const config = require('../../config/aiConfig');
      expect(config.openai.apiKey).toBe(validKey);
      expect(config.openai.isValid).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should warn for invalid format but not throw', () => {
      process.env.OPENAI_API_KEY = 'invalid-key';
      const config = require('../../config/aiConfig');
      expect(config.openai.apiKey).toBe('invalid-key');
      expect(config.openai.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Warning: OPENAI_API_KEY must start with "sk-"');
    });

    test('should warn for invalid length but not throw', () => {
      process.env.OPENAI_API_KEY = 'sk-short';
      const config = require('../../config/aiConfig');
      expect(config.openai.apiKey).toBe('sk-short');
      expect(config.openai.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: OPENAI_API_KEY must be exactly 51 characters, got 8',
      );
    });

    test('should warn for non-alphanumeric characters but not throw', () => {
      const invalidKey = 'sk-' + 'a'.repeat(47) + '!';
      process.env.OPENAI_API_KEY = invalidKey;
      const config = require('../../config/aiConfig');
      expect(config.openai.apiKey).toBe(invalidKey);
      expect(config.openai.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: OPENAI_API_KEY must contain only alphanumeric characters after "sk-"',
      );
    });
  });

  describe('Default Environment (development)', () => {
    test('should default to development when NODE_ENV not set', () => {
      const config = require('../../config/aiConfig');
      expect(config.openai.apiKey).toBeUndefined();
      expect(config.openai.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'OPENAI_API_KEY not set - AI features may not work in development',
      );
    });
  });
});
