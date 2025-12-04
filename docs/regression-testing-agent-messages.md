# Agent Message Regression Testing

This document describes the automated regression test suite for agent message functionality, designed to prevent future regressions and ensure system stability.

## Overview

Regression tests are automated tests that verify existing functionality continues to work after code changes. The agent message regression suite focuses on critical functionality that must remain stable across releases.

## Test Structure

### Test Categories

#### 1. PDF Processing Agent Message Generation

- **Purpose**: Ensures PDF uploads continue to generate agent messages correctly
- **Coverage**:
  - Agent message triggering on PDF upload
  - Required data fields in agent messages
  - Trust token validity in messages

#### 2. Sanitization API Agent Message Integration

- **Purpose**: Verifies sanitization API doesn't interfere with agent messages
- **Coverage**:
  - Sanitization requests don't trigger unwanted agent messages
  - Trust token validation continues working

#### 3. Message Ordering and Sequencing

- **Purpose**: Ensures message ordering logic remains intact
- **Coverage**:
  - Chronological ordering of agent messages
  - Unique message ID generation

#### 4. Error Handling and Resilience

- **Purpose**: Verifies error handling doesn't break agent message functionality
- **Coverage**:
  - Graceful handling of malformed PDFs
  - WebSocket failure resilience
  - Race condition prevention in concurrent requests

#### 5. Performance Baselines

- **Purpose**: Prevents performance regressions
- **Coverage**:
  - Response time baselines
  - Memory usage monitoring
  - Resource leak detection

#### 6. API Contract Stability

- **Purpose**: Ensures API contracts remain stable
- **Coverage**:
  - Agent message structure consistency
  - Job status API compatibility

## Running Regression Tests

### Local Development

```bash
# Run all regression tests
npm run test:regression

# Run specific regression test category
npm test -- --testPathPattern=regression --testNamePattern="PDF Processing"

# Run with coverage
npm test -- --testPathPattern=regression --coverage
```

### CI/CD Integration

The regression tests are automatically run in CI/CD pipelines:

- **Pull Requests**: All regression tests must pass
- **Main Branch**: Full regression suite execution
- **Releases**: Extended regression testing with performance validation

### Test Results

- Results are saved in `test-results/` directory
- Markdown reports provide detailed analysis
- Coverage reports show code coverage metrics
- Exit code 1 indicates regressions detected

## Regression Prevention Strategy

### Test Naming Convention

All regression tests use the `REGRESSION:` prefix to clearly identify their purpose:

```javascript
test('REGRESSION: PDF upload should trigger agent message generation', async () => {
  // Test implementation
});
```

### Failure Analysis

When regression tests fail:

1. **Identify the change** that caused the failure
2. **Determine if the change is intentional** or a bug
3. **Update tests or fix code** accordingly
4. **Document the change** in release notes

### Baseline Updates

Performance baselines should be updated when:

- Intentional performance changes are made
- Infrastructure improvements affect metrics
- New features change expected behavior

## Test Maintenance

### Adding New Regression Tests

1. Identify critical functionality that must not regress
2. Write test with `REGRESSION:` prefix
3. Ensure test is deterministic and reliable
4. Add to appropriate test category
5. Update documentation

### Updating Existing Tests

- Keep test logic focused on regression prevention
- Update baselines when legitimate changes occur
- Maintain test readability and documentation
- Ensure tests remain fast and reliable

## Performance Monitoring

### Metrics Tracked

- Response times for agent message generation
- Memory usage during concurrent operations
- Error rates under load
- Message ordering consistency

### Baselines

- Average response time: < 500ms
- Memory increase: < 50MB for 20 operations
- Error rate: 0% for regression tests
- Test execution time: < 30 seconds

## Troubleshooting

### Common Issues

#### Tests Failing Due to Implementation Changes

- Check if the agent message system implementation has changed
- Update test expectations to match new behavior
- Ensure changes are documented

#### Performance Regressions

- Compare against historical performance data
- Check for memory leaks or resource issues
- Review recent code changes for performance impact

#### Flaky Tests

- Ensure tests are deterministic
- Remove external dependencies
- Use proper mocking for external services

### Debugging Failed Tests

```bash
# Run with verbose output
npm test -- --testPathPattern=regression --verbose

# Run specific failing test
npm test -- --testPathPattern=regression --testNamePattern="specific test name"

# Debug with inspector
npm test -- --testPathPattern=regression --inspect-brk
```

## Integration with Development Workflow

### Pre-commit Hooks

Regression tests can be run as pre-commit hooks to catch issues early.

### Code Review Checklist

- [ ] Regression tests pass
- [ ] No performance regressions detected
- [ ] Code coverage maintained
- [ ] API contracts unchanged (or intentionally updated)

### Release Process

1. Run full regression test suite
2. Verify performance baselines
3. Generate regression report
4. Include regression status in release notes

## Future Enhancements

### Planned Improvements

- Historical performance trend analysis
- Automated baseline updates
- Integration with monitoring systems
- Visual regression testing for UI components
- Load testing integration with regression suite

### Monitoring Integration

- Connect regression results to application monitoring
- Alert on performance degradation trends
- Automated issue creation for test failures
