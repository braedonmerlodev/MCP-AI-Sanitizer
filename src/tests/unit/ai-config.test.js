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
    delete process.env.GEMINI_API_KEY;
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

    test('should load valid config when GEMINI_API_KEY is properly set', () => {
      const validKey = 'AIzaSy' + 'a'.repeat(33);
      process.env.GEMINI_API_KEY = validKey;
      const config = require('../../config/aiConfig');
      expect(config.gemini.apiKey).toBe(validKey);
      expect(config.gemini.isValid).toBe(true);
    });

    test('should throw error when GEMINI_API_KEY is not set in production', () => {
      expect(() => require('../../config/aiConfig')).toThrow(
        'GEMINI_API_KEY environment variable must be set in production',
      );
    });

    test('should throw error for invalid format (no AIzaSy prefix)', () => {
      process.env.GEMINI_API_KEY = 'invalid-key';
      expect(() => require('../../config/aiConfig')).toThrow(
        'GEMINI_API_KEY must start with "AIzaSy"',
      );
    });

    test('should throw error for invalid length', () => {
      process.env.GEMINI_API_KEY = 'AIzaSy-short';
      expect(() => require('../../config/aiConfig')).toThrow(
        'GEMINI_API_KEY must be exactly 39 characters, got 12',
      );
    });

    test('should throw error for non-alphanumeric characters', () => {
      const invalidKey = 'AIzaSy' + 'a'.repeat(32) + '!';
      process.env.GEMINI_API_KEY = invalidKey;
      expect(() => require('../../config/aiConfig')).toThrow(
        'GEMINI_API_KEY must contain only alphanumeric characters after "AIzaSy"',
      );
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should load config and warn when GEMINI_API_KEY is not set', () => {
      const config = require('../../config/aiConfig');
      expect(config.gemini.apiKey).toBeUndefined();
      expect(config.gemini.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'GEMINI_API_KEY not set - AI features may not work in development',
      );
    });

    test('should load valid config when GEMINI_API_KEY is properly set', () => {
      const validKey = 'AIzaSy' + 'a'.repeat(33);
      process.env.GEMINI_API_KEY = validKey;
      const config = require('../../config/aiConfig');
      expect(config.gemini.apiKey).toBe(validKey);
      expect(config.gemini.isValid).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should warn for invalid format but not throw', () => {
      process.env.GEMINI_API_KEY = 'invalid-key';
      const config = require('../../config/aiConfig');
      expect(config.gemini.apiKey).toBe('invalid-key');
      expect(config.gemini.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: GEMINI_API_KEY must start with "AIzaSy"',
      );
    });

    test('should warn for invalid length but not throw', () => {
      process.env.GEMINI_API_KEY = 'AIzaSy-short';
      const config = require('../../config/aiConfig');
      expect(config.gemini.apiKey).toBe('AIzaSy-short');
      expect(config.gemini.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: GEMINI_API_KEY must be exactly 39 characters, got 12',
      );
    });

    test('should warn for non-alphanumeric characters but not throw', () => {
      const invalidKey = 'AIzaSy' + 'a'.repeat(32) + '!';
      process.env.GEMINI_API_KEY = invalidKey;
      const config = require('../../config/aiConfig');
      expect(config.gemini.apiKey).toBe(invalidKey);
      expect(config.gemini.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: GEMINI_API_KEY must contain only alphanumeric characters after "AIzaSy"',
      );
    });
  });

  describe('Default Environment (development)', () => {
    test('should default to development when NODE_ENV not set', () => {
      const config = require('../../config/aiConfig');
      expect(config.gemini.apiKey).toBeUndefined();
      expect(config.gemini.isValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'GEMINI_API_KEY not set - AI features may not work in development',
      );
    });
  });
});
