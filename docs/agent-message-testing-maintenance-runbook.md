# Agent Message Testing Documentation and Maintenance Runbooks

This comprehensive guide provides documentation for the agent message testing framework, including setup instructions, maintenance procedures, troubleshooting guides, and operational runbooks.

## Testing Framework Overview

The agent message testing framework consists of multiple test suites designed to validate different aspects of the system:

### Test Suites

1. **Integration Tests** (`tests/integration/agent-message-integration.test.js`)
   - End-to-end validation of agent message flow
   - Cross-system integration testing
   - API contract validation

2. **Regression Tests** (`tests/regression/agent-message-regression.test.js`)
   - Automated regression prevention
   - Baseline performance monitoring
   - API contract stability checks

3. **Edge Case Tests** (`tests/edge-cases/agent-message-edge-cases.test.js`)
   - Boundary condition validation
   - Stress testing scenarios
   - Error handling verification

4. **Load Tests** (`load-test-agent-messages.yml`)
   - Performance under concurrent load
   - Scalability validation
   - Resource usage monitoring

5. **Cross-Browser Tests** (`agent/agent-development-env/frontend/tests/e2e/agent-message-display.spec.js`)
   - UI rendering validation
   - Browser compatibility testing
   - Accessibility compliance

## Quick Start Guide

### Prerequisites

```bash
# Install dependencies
npm install

# For frontend testing
cd agent/agent-development-env/frontend
npm install
```

### Running All Tests

```bash
# Run complete test suite
npm test

# Run specific test categories
npm run test:integration    # Integration tests
npm run test:regression     # Regression tests
npm run test:edge-cases     # Edge case tests
npm run test:load          # Load tests
npm run test:performance   # Performance benchmarks

# Frontend cross-browser tests
cd agent/agent-development-env/frontend
npm run test:e2e
```

### CI/CD Integration

Tests are automatically run in GitHub Actions:

- **Pull Requests**: Integration and regression tests
- **Main Branch**: Full test suite including load tests
- **Releases**: Extended testing with performance validation

## Maintenance Runbooks

### Daily Maintenance

#### Test Health Monitoring

```bash
# Check test execution status
npm run test:regression

# Monitor test performance trends
npm run test:performance

# Validate test environment
npm run test:integration
```

#### Log Analysis

- Check `test-results/` directory for recent reports
- Review CI/CD logs for test failures
- Monitor performance baseline deviations

### Weekly Maintenance

#### Test Suite Updates

1. Review failed tests for patterns
2. Update test data and baselines
3. Refresh test dependencies
4. Validate test coverage metrics

#### Performance Baseline Review

```bash
# Run performance benchmarks
npm run test:performance

# Analyze trends in test-results/
# Update baselines in test configurations if needed
```

### Monthly Maintenance

#### Comprehensive System Validation

```bash
# Run full test suite
npm test

# Execute load tests
npm run test:load

# Run edge case validation
npm run test:edge-cases

# Cross-browser testing
cd agent/agent-development-env/frontend && npm run test:e2e
```

#### Documentation Updates

- Update performance baselines
- Refresh test case documentation
- Review and update runbooks
- Validate CI/CD pipeline configurations

## Troubleshooting Guide

### Common Test Failures

#### Integration Test Failures

**Symptoms**: API endpoint errors, WebSocket connection issues
**Solutions**:

```bash
# Check server status
curl http://localhost:3000/api/monitoring/metrics

# Restart test environment
npm start

# Clear test cache
npm test -- --clearCache
```

#### Load Test Failures

**Symptoms**: Performance degradation, timeout errors
**Solutions**:

```bash
# Check system resources
top
df -h

# Reduce load test intensity
# Edit load-test-agent-messages.yml

# Run with increased timeouts
TIMEOUT=60000 npm run test:load
```

#### Cross-Browser Test Failures

**Symptoms**: Browser-specific rendering issues
**Solutions**:

```bash
# Update browser binaries
cd agent/agent-development-env/frontend
npx playwright install

# Run tests in specific browser
npx playwright test --project=chromium

# Debug with UI mode
npx playwright test --ui
```

### Performance Issues

#### Slow Test Execution

```bash
# Run tests in parallel
npm test -- --maxWorkers=4

# Skip slow tests in development
npm test -- --testNamePattern="^(?!.*slow)"

# Profile test performance
npm test -- --verbose --timings
```

#### Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm test

# Run tests with garbage collection
NODE_OPTIONS="--expose-gc" npm test
```

### Network Issues

#### WebSocket Connection Problems

```bash
# Check WebSocket server
netstat -tlnp | grep :3000

# Test WebSocket connection manually
# Use browser developer tools or WebSocket client

# Restart WebSocket server
npm start
```

#### API Timeout Issues

```bash
# Increase timeout settings
# Edit test files: timeout: 30000

# Check API response times
curl -w "@curl-format.txt" http://localhost:3000/api/sanitize/json \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"test","classification":"user_input"}'
```

## Test Data Management

### Test Data Sources

- **Mock Data**: Generated programmatically in tests
- **Static Fixtures**: Stored in `tests/fixtures/` directory
- **Dynamic Data**: Generated based on test parameters

### Data Maintenance

```bash
# Update test fixtures
# Edit files in tests/fixtures/

# Refresh mock data generators
# Update test helper functions

# Validate test data integrity
npm run test:integration
```

## CI/CD Pipeline Management

### Pipeline Configuration

Located in `.github/workflows/` directory:

- `ci.yml`: Main CI pipeline
- `load-test.yml`: Load testing pipeline
- `release.yml`: Release validation pipeline

### Pipeline Maintenance

```yaml
# Update test commands in workflow files
# Modify trigger conditions
# Add new test categories
# Update performance thresholds
```

### Monitoring CI/CD Health

- Check GitHub Actions dashboard
- Monitor test execution times
- Review failure patterns
- Update pipeline configurations

## Performance Monitoring

### Key Metrics

- **Test Execution Time**: Should remain stable
- **Test Pass Rate**: Target > 95%
- **Performance Baselines**: Monitor for regressions
- **Resource Usage**: Memory, CPU, network

### Baseline Management

```javascript
// Performance baselines in test files
const PERFORMANCE_BASELINE = {
  avgResponseTime: 200, // ms
  maxResponseTime: 1000, // ms
  errorRate: 0.05, // 5%
  throughput: 10, // req/sec
};
```

### Trend Analysis

- Review historical test results
- Identify performance degradation patterns
- Update baselines for legitimate changes
- Alert on significant deviations

## Security Testing

### Test Security Validation

- Input sanitization testing
- XSS prevention validation
- Authentication bypass attempts
- Data leakage prevention

### Security Test Maintenance

```bash
# Update security test cases
# Refresh vulnerability patterns
# Validate security controls
# Review security test coverage
```

## Documentation Updates

### Updating This Guide

1. Edit this markdown file
2. Test all commands and procedures
3. Update screenshots/diagrams if needed
4. Commit changes with clear description

### Version Control

- Maintain changelog for major updates
- Tag documentation versions
- Archive outdated procedures
- Cross-reference with code changes

## Emergency Procedures

### Test Suite Completely Broken

1. **Isolate the issue**: Determine which tests are failing
2. **Check dependencies**: Verify all dependencies are installed
3. **Environment validation**: Ensure test environment is correct
4. **Incremental fixes**: Fix one issue at a time
5. **Rollback if needed**: Revert recent changes

### Performance Regression Detected

1. **Identify the change**: Find what caused the regression
2. **Performance profiling**: Use profiling tools to locate bottlenecks
3. **Temporary mitigation**: Implement performance workarounds
4. **Permanent fix**: Optimize the problematic code
5. **Baseline update**: Update performance expectations

### CI/CD Pipeline Failure

1. **Check pipeline status**: Review GitHub Actions logs
2. **Local reproduction**: Run tests locally to reproduce
3. **Environment differences**: Compare local vs CI environment
4. **Fix and redeploy**: Apply fixes and restart pipeline
5. **Monitor recovery**: Ensure pipeline stabilizes

## Support and Escalation

### Internal Support

- **Test Framework Issues**: Contact development team
- **Performance Problems**: Contact DevOps/SRE team
- **CI/CD Issues**: Contact DevOps team
- **Security Concerns**: Contact Security team

### External Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [Testing Best Practices](https://testing.googleblog.com/)

## Changelog

### Version 1.0.0 (2025-12-04)

- Initial comprehensive testing documentation
- Complete runbook for all test suites
- CI/CD integration guidelines
- Troubleshooting and maintenance procedures

### Future Updates

- Performance optimization guides
- Advanced testing techniques
- Integration with monitoring systems
- Automated test generation
