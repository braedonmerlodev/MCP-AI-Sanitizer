export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|react-syntax-highlighter|vfile|vfile-message|unist-.*|unified|bail|is-plain-obj|trough|remark-.*|mdast-.*|micromark.*|decode-named-character-reference|character-entities|property-information|hast-.*|space-separated-tokens|comma-separated-tokens|zwitch|longest-streak|hastscript|hast-util-.*|web-namespaces|html-void-elements|ccount|escape-string-regexp|markdown-table|trim-lines|trim-trailing-lines|trim|repeat-string|parse-entities|character-reference-invalid|is-decimal|is-hexadecimal|is-alphanumerical|is-alphabetical|stringify-entities|has-property|prismjs|refractor)/)',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx|js)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}
