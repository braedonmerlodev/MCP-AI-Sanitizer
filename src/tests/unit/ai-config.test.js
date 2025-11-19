// Mock dotenv before any requires
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('AI Config', () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalEnv;
    }
  });

  test('should load config when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const config = require('../../config/aiConfig');
    expect(config.openai.apiKey).toBe('test-key');
  });

  test('should throw error when OPENAI_API_KEY is not set', () => {
    expect(() => require('../../config/aiConfig')).toThrow(
      'OPENAI_API_KEY environment variable must be set',
    );
  });
});
