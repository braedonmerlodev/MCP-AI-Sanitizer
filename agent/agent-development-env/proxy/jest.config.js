module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js', '**/*_integration.js'],
  verbose: true,
  collectCoverageFrom: ['proxy.js', '!node_modules/**', '!test_*.js'],
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: [],
  testTimeout: 30000,
  transform: {},
  extensionsToTreatAsEsm: [],
  globals: {
    'ts-jest': {
      useESM: false,
    },
  },
};
