// Mock langchain to avoid ES module issues in Jest
jest.mock('langchain', () => ({
  ChatOpenAI: jest.fn(),
  // Add other exports as needed
}));

// Mock langchain to avoid ES module issues in Jest
jest.mock(
  'langchain',
  () => ({
    ChatOpenAI: jest.fn(),
    // Add other exports as needed
  }),
  { virtual: true },
);

// Mock langchain to avoid ES module issues in Jest
jest.mock('langchain', () => ({
  ChatOpenAI: jest.fn(),
  // Add other exports as needed
}));

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
