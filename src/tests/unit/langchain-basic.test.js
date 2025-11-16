const { ChatOpenAI } = require('@langchain/openai');

describe('Langchain Basic Functionality', () => {
  test('should create ChatOpenAI instance', () => {
    const chat = new ChatOpenAI({ openAIApiKey: 'test-key', modelName: 'gpt-3.5-turbo' });
    expect(chat).toBeDefined();
  });
});
