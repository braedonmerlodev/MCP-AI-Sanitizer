# Coverage Troubleshooting Guide

## Overview

This guide provides solutions for common test coverage issues encountered during development and maintenance. It covers diagnosis techniques, resolution steps, and prevention strategies.

## Coverage Analysis Tools

### Basic Coverage Commands

```bash
# Generate coverage report
npm run test:coverage

# View coverage report in browser
open coverage/lcov-report/index.html

# Check coverage thresholds
npm run test:coverage:check

# Run coverage for specific files
npx jest --coverage --testPathPattern="auth"
```

### Coverage Report Interpretation

- **Lines**: Executable code lines covered
- **Functions**: Functions called during tests
- **Branches**: Conditional logic paths executed
- **Statements**: Individual statements executed

## Common Coverage Issues

### Issue 1: Uncovered Lines in Error Handlers

**Symptoms**: Red highlighting on catch blocks and error handling code

**Root Causes**:

- Error conditions not tested
- Exception paths not triggered in tests
- Mock failures not simulating errors

**Solutions**:

```javascript
// Test error handling
it('should handle database connection failure', async () => {
  // Mock the database to throw an error
  jest.spyOn(database, 'connect').mockRejectedValue(new Error('Connection failed'));

  // Execute code that should trigger error handling
  await expect(userService.getUser(userId)).rejects.toThrow('Connection failed');

  // Verify error handling behavior
  expect(logger.error).toHaveBeenCalledWith('Database connection failed');
});
```

**Prevention**: Always test both success and failure paths for operations that can fail.

### Issue 2: Missing Branch Coverage

**Symptoms**: Branch coverage < 100% with uncovered conditional branches

**Root Causes**:

- If/else conditions not fully tested
- Switch statements with missing cases
- Ternary operators with untested paths

**Solutions**:

```javascript
// Test all branches of conditional logic
describe('validateInput', () => {
  it('should return true for valid input', () => {
    const result = validator.validateInput('valid@example.com');
    expect(result).toBe(true);
  });

  it('should return false for null input', () => {
    const result = validator.validateInput(null);
    expect(result).toBe(false);
  });

  it('should return false for empty string', () => {
    const result = validator.validateInput('');
    expect(result).toBe(false);
  });

  it('should return false for invalid format', () => {
    const result = validator.validateInput('invalid-email');
    expect(result).toBe(false);
  });
});
```

**Prevention**: Use code coverage reports to identify untested branches during development.

### Issue 3: Async Operation Coverage Gaps

**Symptoms**: Promises, async/await, and callback functions not covered

**Root Causes**:

- Asynchronous code not properly awaited in tests
- Race conditions in test execution
- Unhandled promise rejections

**Solutions**:

```javascript
// Proper async testing
it('should handle async operation completion', async () => {
  const result = await service.processAsync(data);
  expect(result.status).toBe('completed');
});

it('should handle async operation timeout', async () => {
  // Use fake timers for timeout testing
  jest.useFakeTimers();

  const promise = service.processWithTimeout(data);
  jest.advanceTimersByTime(60000); // Advance past timeout

  await expect(promise).rejects.toThrow('Operation timeout');
});
```

**Prevention**: Always use `async/await` in test functions and properly handle promises.

### Issue 4: External Dependency Mocking Issues

**Symptoms**: Coverage gaps in code that calls external services

**Root Causes**:

- Incomplete mocking of external dependencies
- Mock implementations not matching real behavior
- Missing mock setup in test files

**Solutions**:

```javascript
// Comprehensive mocking
const mockExternalAPI = jest.fn();
jest.mock('external-service', () => ({
  callAPI: mockExternalAPI,
}));

describe('ExternalServiceIntegration', () => {
  beforeEach(() => {
    mockExternalAPI.mockClear();
  });

  it('should handle successful API response', async () => {
    mockExternalAPI.mockResolvedValue({ success: true, data: 'test' });

    const result = await service.callExternalAPI();
    expect(result.success).toBe(true);
  });

  it('should handle API failure', async () => {
    mockExternalAPI.mockRejectedValue(new Error('API Error'));

    await expect(service.callExternalAPI()).rejects.toThrow('API Error');
  });
});
```

**Prevention**: Create reusable mock factories and document mocking requirements.

## Advanced Troubleshooting

### Issue 5: Coverage Not Updating

**Symptoms**: Coverage reports don't reflect recent test changes

**Solutions**:

1. Clear Jest cache: `npx jest --clearCache`
2. Delete coverage directory: `rm -rf coverage/`
3. Restart test runner
4. Check file paths and naming conventions
5. Verify Jest configuration includes test files

### Issue 6: Inconsistent Coverage Results

**Symptoms**: Coverage percentages vary between runs

**Solutions**:

1. Use deterministic test data
2. Avoid random values in tests
3. Ensure proper test isolation
4. Check for race conditions
5. Use `beforeEach`/`afterEach` for setup/cleanup

### Issue 7: Performance Impact from Coverage

**Symptoms**: Tests run significantly slower with coverage enabled

**Solutions**:

1. Run coverage only when needed: `npm run test:coverage`
2. Use coverage thresholds instead of full collection
3. Exclude unnecessary files from coverage
4. Use parallel test execution
5. Cache coverage results when possible

## Debugging Techniques

### 1. Targeted Coverage Analysis

```bash
# Run coverage for specific test file
npx jest --coverage --testPathPattern="auth.test.js"

# Run coverage for specific source file
npx jest --coverage --collectCoverageFrom="src/auth.js"

# Generate detailed coverage report
npx jest --coverage --coverageReporters="json" --coverageReporters="html"
```

### 2. Step-by-Step Debugging

1. Run test with coverage disabled to verify functionality
2. Enable coverage and check which lines are missed
3. Add targeted test cases for missed lines
4. Re-run coverage to verify improvement
5. Refactor code if needed for better testability

### 3. Coverage Gap Analysis

```javascript
// Use coverage data to identify gaps
const coverageData = require('./coverage/coverage-final.json');

function analyzeCoverageGaps(filePath) {
  const fileCoverage = coverageData[filePath];
  if (!fileCoverage) return;

  Object.entries(fileCoverage.s).forEach(([statementId, count]) => {
    if (count === 0) {
      console.log(`Uncovered statement ${statementId} in ${filePath}`);
    }
  });
}
```

## Prevention Strategies

### Code Design for Testability

- Use dependency injection
- Avoid complex conditional logic
- Create pure functions where possible
- Use interfaces for external dependencies

### Test Organization

- Group related tests in describe blocks
- Use beforeEach/afterEach for setup
- Create shared test utilities
- Document testing patterns

### Continuous Integration

- Set up coverage gates in CI/CD
- Monitor coverage trends
- Alert on coverage regressions
- Require coverage for new features

## Common Pitfalls

### Pitfall 1: Testing Implementation Details

**Problem**: Tests break when implementation changes
**Solution**: Test behavior, not implementation details

### Pitfall 2: Over-Mocking

**Problem**: Tests become brittle and don't catch integration issues
**Solution**: Use integration tests for critical paths

### Pitfall 3: Ignoring Edge Cases

**Problem**: Production bugs from untested scenarios
**Solution**: Always consider edge cases and error conditions

### Pitfall 4: Test Data Management

**Problem**: Tests interfere with each other
**Solution**: Use proper test isolation and cleanup

## Tools and Resources

### Coverage Tools

- **Jest**: Primary test framework with coverage
- **Istanbul**: Coverage instrumentation
- **nyc**: Istanbul command line interface

### Debugging Tools

- **Chrome DevTools**: For debugging test execution
- **Jest Debug Mode**: Step-through debugging
- **Coverage Diff Tools**: Compare coverage between commits

### Community Resources

- Jest Documentation: https://jestjs.io/docs/configuration#collectcoveragefrom
- Testing Library: https://testing-library.com/docs/
- Kent C. Dodds Testing Blog: https://kentcdodds.com/blog/

## Escalation Procedures

### When to Seek Help

- Coverage issues blocking development
- Unresolvable mocking problems
- Performance issues with coverage collection
- Complex integration testing challenges

### Support Channels

1. Development team coverage discussion
2. QA team consultation
3. Architecture review for testability issues
4. External testing experts for complex scenarios

## Maintenance Checklist

### Daily

- [ ] Review coverage reports for new gaps
- [ ] Address failing coverage checks
- [ ] Update tests for code changes

### Weekly

- [ ] Analyze coverage trends
- [ ] Review test effectiveness
- [ ] Update test documentation

### Monthly

- [ ] Comprehensive coverage audit
- [ ] Test strategy review
- [ ] Tool and process updates
