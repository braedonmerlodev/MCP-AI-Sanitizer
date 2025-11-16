const OpenAI = require('openai');

describe('OpenAI API Connectivity', () => {
  test('should create OpenAI client', () => {
    const client = new OpenAI({ apiKey: 'test-key' });
    expect(client).toBeDefined();
  });
});
