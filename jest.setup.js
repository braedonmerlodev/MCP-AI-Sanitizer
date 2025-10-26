// Jest setup file for global mocks and polyfills

// Mock pdf-parse to avoid DOMMatrix dependency
jest.mock('pdf-parse', () => jest.fn());

// Provide DOMMatrix polyfill if needed
global.DOMMatrix = class DOMMatrix {
  constructor() {
    // Minimal implementation
  }
};
