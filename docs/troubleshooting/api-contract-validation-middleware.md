# ApiContractValidationMiddleware Troubleshooting Guide

## Overview

This guide provides troubleshooting procedures for maintaining and debugging ApiContractValidationMiddleware tests and implementation. Use this guide when encountering issues with middleware testing, validation failures, or performance problems.

## Quick Diagnosis Checklist

### 1. Test Environment Issues

- [ ] Node.js version compatible (18+ recommended)
- [ ] All dependencies installed (`npm install`)
- [ ] Test database/file permissions correct
- [ ] Environment variables properly set

### 2. Mock Object Problems

- [ ] Express response mocks include all required methods
- [ ] Request mocks have correct structure
- [ ] External service mocks are properly configured

### 3. Schema Validation Issues

- [ ] Schema files exist in `src/schemas/`
- [ ] Schema syntax is valid Joi syntax
- [ ] Schema paths match API route definitions

### 4. Performance Problems

- [ ] Validation timing within acceptable limits (< 10ms)
- [ ] Memory usage stable
- [ ] No memory leaks in long-running tests

## Common Issues and Solutions

### Issue: Mock Response Object Errors

**Symptoms:**

```
TypeError: mockRes.json is not a function
TypeError: mockRes.status is not a function
```

**Root Cause:** Incomplete Express response object mocking

**Solution:**

```javascript
// Correct mock pattern
const mockRes = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
  getHeader: jest.fn(),
  send: jest.fn(),
  end: jest.fn(),
};

// Incorrect - missing methods
const badMockRes = {
  json: jest.fn(), // Missing status() chaining
};
```

**Prevention:** Always use the complete mock pattern from the testing documentation.

### Issue: Schema Validation Failures

**Symptoms:**

```
ValidationError: "content" is required
Schema validation failed for endpoint /api/sanitize/json
```

**Diagnosis Steps:**

1. Check schema definition in `src/schemas/`
2. Verify test data matches schema requirements
3. Review schema import in middleware

**Solutions:**

- Update test data to match schema
- Modify schema if business requirements changed
- Check schema loading in middleware constructor

### Issue: Performance Degradation

**Symptoms:**

- Validation times > 10ms
- Memory usage increasing over time
- CPU usage spikes during testing

**Diagnosis:**

```bash
# Run performance tests
npm test -- --testPathPattern=performance

# Check memory usage
node --expose-gc --inspect node_modules/.bin/jest --runInBand
```

**Common Causes:**

1. **Complex Schemas**: Simplify Joi validation rules
2. **Memory Leaks**: Check for retained references in mocks
3. **Inefficient Logging**: Reduce log verbosity in tests

**Solutions:**

- Optimize schema complexity
- Use `jest.clearAllMocks()` between tests
- Mock expensive operations (logging, external calls)

### Issue: Integration Test Failures

**Symptoms:**

- Tests pass individually but fail in CI
- Race conditions in async operations
- External dependency failures

**Diagnosis:**

```bash
# Run integration tests in isolation
npm test -- tests/integration/security-integration-preservation.test.js

# Check for race conditions
npm test -- --runInBand --detectOpenHandles
```

**Solutions:**

- Increase timeouts for async operations
- Use proper cleanup in `beforeEach`/`afterEach`
- Mock external dependencies consistently

### Issue: Environment Variable Problems

**Symptoms:**

```
Error: TRUST_TOKEN_SECRET environment variable must be set
Configuration validation failed
```

**Solution:**

```bash
# Set required environment variables
export TRUST_TOKEN_SECRET="your-test-secret"
export NODE_ENV="test"

# Or use dotenv in tests
require('dotenv').config({ path: '.env.test' });
```

### Issue: Schema Loading Errors

**Symptoms:**

```
Error: Cannot find module '../schemas/apiSchemas'
Schema validation failed: schema not found
```

**Diagnosis:**

- Check file paths in middleware
- Verify schema files exist
- Confirm export syntax in schema files

**Solution:**

```javascript
// Correct import pattern
const requestSchemas = require('../schemas/requestSchemas');
const responseSchemas = require('../schemas/responseSchemas');

// Verify schema structure
console.log('Available schemas:', Object.keys(requestSchemas));
```

## Debugging Procedures

### 1. Enable Debug Logging

```javascript
// In test files
process.env.DEBUG = 'middleware:*';

// In middleware
const debug = require('debug')('middleware:validation');
debug('Validation result:', result);
```

### 2. Step-by-Step Test Debugging

```javascript
// Add debugging to failing test
it('should validate request', () => {
  console.log('Test data:', testData);
  console.log('Schema:', schema);

  const result = middleware.validateRequest(testData, schema);
  console.log('Validation result:', result);

  expect(result.isValid).toBe(true);
});
```

### 3. Performance Profiling

```javascript
// Add timing to tests
const start = process.hrtime.bigint();

const result = middleware.validateRequest(req, schema);

const end = process.hrtime.bigint();
const duration = Number(end - start) / 1_000_000; // Convert to ms

console.log(`Validation took ${duration}ms`);
expect(duration).toBeLessThan(10);
```

## Maintenance Tasks

### Weekly Tasks

- [ ] Run full test suite and check for new failures
- [ ] Review performance metrics for degradation
- [ ] Check error logs for new validation patterns

### Monthly Tasks

- [ ] Update performance baselines
- [ ] Review and update mock objects
- [ ] Audit schema complexity and optimization opportunities

### Schema Update Procedure

1. **Modify Schema**: Update Joi schema in `src/schemas/`
2. **Update Tests**: Modify test data to match new schema
3. **Run Tests**: Execute full test suite
4. **Performance Check**: Verify no performance regression
5. **Documentation**: Update schema documentation

### Adding New Endpoints

1. **Define Schema**: Create request/response schemas
2. **Update Middleware**: Add endpoint to middleware configuration
3. **Add Tests**: Create unit and integration tests
4. **Update Documentation**: Add to API documentation

## Emergency Procedures

### Test Suite Completely Broken

1. Run individual test files to isolate issues
2. Check for environment/configuration problems
3. Restore from last known good commit
4. Rebuild test infrastructure if needed

### Performance Regression in Production

1. Enable detailed performance logging
2. Identify bottleneck (schema validation, logging, etc.)
3. Implement temporary mitigation (reduce validation strictness)
4. Fix root cause and redeploy

### Schema Validation Blocking Requests

1. Check middleware configuration (should be non-blocking)
2. Review error logs for validation failures
3. Temporarily disable strict validation if needed
4. Fix schema issues and re-enable

## Contact and Support

### For Issues:

- **Test Failures**: Check this troubleshooting guide first
- **Schema Issues**: Review schema definitions and test data
- **Performance Issues**: Check performance baselines and profiling
- **Integration Problems**: Verify mock objects and external dependencies

### Escalation:

- **Security Issues**: Contact security team immediately
- **Production Blocking**: Escalate to development lead
- **Architecture Changes**: Require architecture review

## Success Metrics

- **Test Stability**: > 95% test pass rate maintained
- **Performance**: < 5ms average validation time
- **Maintenance**: Issues resolved within 24 hours
- **Documentation**: Troubleshooting guide updated with new issues

---

**Guide Version**: 1.0
**Last Updated**: November 20, 2025
**Review Schedule**: Monthly
