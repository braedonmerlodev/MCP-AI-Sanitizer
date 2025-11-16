const langchain = require('langchain');
const openai = require('openai');

describe('AI Dependencies', () => {
  test('should load langchain package', () => {
    expect(langchain).toBeDefined();
  });

  test('should load openai package', () => {
    expect(openai).toBeDefined();
  });
});
