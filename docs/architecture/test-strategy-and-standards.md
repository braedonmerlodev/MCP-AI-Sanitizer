# Test Strategy and Standards

## Testing Philosophy

- **Approach:** Test-after development for MVP speed
- **Coverage Goals:** 80% overall, 90% for critical sanitization functions
- **Test Pyramid:** 70% unit, 20% integration, 10% manual

## Test Types and Organization

### Unit Tests

- **Framework:** Jest 29.7.0
- **File Convention:** \*.test.js alongside source files
- **Location:** src/**tests**/
- **Mocking Library:** Sinon for external dependencies
- **Coverage Requirement:** 90% for sanitization logic

**AI Agent Requirements:**

- Generate tests for all public methods
- Cover edge cases and error conditions
- Follow AAA pattern (Arrange, Act, Assert)
- Mock all external dependencies

### Integration Tests

- **Scope:** End-to-end pipeline with mocked LLMs/MCP
- **Location:** tests/integration/
- **Test Infrastructure:**
  - **LLMs/MCP:** WireMock for stubbing responses

### E2E Tests

- **Framework:** Not implemented for MVP
- **Scope:** Full workflow testing
- **Environment:** N/A
- **Test Data:** N/A

## Test Data Management

- **Strategy:** In-memory for unit, fixtures for integration
- **Fixtures:** tests/fixtures/
- **Factories:** Builder pattern for test data
- **Cleanup:** Automatic after each test

## Continuous Testing

- **CI Integration:** GitHub Actions runs all tests on PR
- **Performance Tests:** Artillery for load testing
- **Security Tests:** OWASP ZAP for API scanning
