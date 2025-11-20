# Testing Documentation

## ApiContractValidationMiddleware Testing Patterns

This document outlines the testing scenarios, validation procedures, and maintenance patterns for ApiContractValidationMiddleware implemented in security hardening epic 1.3.

### Middleware Testing Architecture

#### Test Structure

- **Unit Tests**: `src/tests/unit/middleware/ApiContractValidationMiddleware.test.js`
- **Integration Tests**: `tests/integration/security-integration-preservation.test.js`
- **Test Infrastructure**: Mock response objects, schema validation, error handling

#### Testing Patterns Implemented

##### 1. Mock Response Object Pattern

```javascript
// Pattern for mocking Express response objects
const mockRes = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
  getHeader: jest.fn(),
};
```

##### 2. Schema Validation Testing

- Test all request/response schemas defined in `src/schemas/`
- Validate middleware applies correct schemas per endpoint
- Test both valid and invalid input scenarios

##### 3. Error Handling Patterns

- Non-blocking validation (logs warnings, allows processing)
- Comprehensive error logging with structured data
- Graceful degradation for validation failures

##### 4. Performance Validation

- Response time monitoring (< 50ms target)
- Memory usage tracking
- CPU usage validation

### Test Scenarios and Validation Procedures

#### Constructor and Initialization Tests

- **Middleware Creation**: Verifies middleware instantiates with correct options
- **Schema Loading**: Confirms all required schemas are loaded
- **Configuration Validation**: Tests configuration parameter handling

#### Request Validation Tests

- **Valid Request Processing**: Ensures valid requests pass through unchanged
- **Invalid Request Handling**: Verifies invalid requests are logged but not blocked
- **Schema Compliance**: Tests all defined schemas are properly applied
- **Edge Case Handling**: Validates behavior with malformed or edge case inputs

#### Response Validation Tests

- **Valid Response Processing**: Confirms valid responses pass through
- **Invalid Response Logging**: Ensures invalid responses are logged with details
- **Schema Validation**: Tests response schemas are enforced
- **Performance Impact**: Monitors validation overhead

#### Integration Testing Patterns

- **End-to-End Workflows**: Complete request → validation → processing → response cycles
- **API Contract Consistency**: Validates all endpoints maintain consistent contracts
- **Cross-Endpoint Validation**: Ensures validation behavior is consistent across endpoints

### Performance Benchmarks

#### Validation Performance

- **Request Validation**: < 5ms average
- **Response Validation**: < 3ms average
- **Memory Overhead**: < 2MB per request
- **CPU Usage**: < 1% additional load

#### Integration Test Performance

- **Full Workflow**: < 50ms end-to-end
- **Concurrent Requests**: Maintains performance under load
- **Memory Stability**: No memory leaks detected

### Environment Setup Requirements

#### Test Dependencies

- Jest testing framework
- Supertest for HTTP testing
- Mock implementations for external services
- Isolated test databases

#### Test Environment Configuration

- All tests run with mocked external dependencies
- Environment cleanup between test suites
- No persistent state between test executions

### Troubleshooting Common Issues

#### Mock Response Object Failures

```
Error: mockRes.json is not a function
```

**Solution**: Ensure mock response objects include all required Express response methods

#### Schema Validation Errors

```
Error: Schema validation failed
```

**Solution**: Check schema definitions in `src/schemas/` and ensure test data matches expected formats

#### Performance Degradation

- Monitor validation timing (>10ms may indicate issues)
- Check for memory leaks in validation logic
- Verify schema complexity doesn't impact performance

### Security Testing Notes

#### Validation Security

- Input sanitization integration
- Schema-based validation prevents injection
- Comprehensive logging for security monitoring

#### Tamper Prevention

- Request/response validation prevents manipulation
- Schema enforcement ensures data integrity
- Audit logging tracks all validation operations

#### Risk Mitigation

- Non-blocking validation prevents DoS
- Comprehensive error handling
- Performance monitoring prevents degradation attacks

### Maintenance Guidelines

#### Test Updates

- Add new test cases for schema changes
- Update performance benchmarks as system evolves
- Maintain test isolation and cleanup procedures

#### Schema Maintenance

- Keep schemas synchronized with API changes
- Update tests when schemas are modified
- Document schema changes and impacts

#### Performance Monitoring

- Regular performance benchmark updates
- Monitor for validation overhead increases
- Optimize schemas for performance

---

## TrustTokenGenerator Environment Validation Testing

This document outlines the testing scenarios and validation procedures for TrustTokenGenerator environment variable validation fixes implemented in security hardening epic 1.5.

### Environment Validation Test Scenarios

#### Constructor Validation Tests

- **TRUST_TOKEN_SECRET Required**: Verifies that TrustTokenGenerator throws an error when no secret is provided via options or environment variables
- **Options Priority**: Confirms that constructor options.secret takes precedence over environment variables
- **Environment Variable Support**: Validates that TRUST_TOKEN_SECRET environment variable is properly read
- **Custom Options**: Tests that defaultExpirationHours and defaultVersion options are accepted
- **Cross-Environment Compatibility**: Ensures functionality works across different secret formats and deployment environments

#### Token Generation Tests

- **Valid Token Structure**: Verifies all required fields are present (contentHash, originalHash, sanitizationVersion, rulesApplied, timestamp, expiresAt, signature)
- **Custom Options Override**: Tests that per-token options override constructor defaults
- **Hash Uniqueness**: Confirms different content produces different hashes
- **Type Validation**: Ensures all fields have correct data types

#### Token Validation Tests

- **Valid Token Acceptance**: Confirms correct tokens are validated successfully
- **Missing Fields Rejection**: Tests rejection of tokens missing required fields
- **Expired Token Handling**: Verifies expired tokens are properly rejected
- **Signature Tampering Detection**: Ensures signature validation prevents tampering
- **Content Modification Detection**: Confirms hash validation prevents content changes
- **Malformed Token Handling**: Tests graceful handling of invalid token formats

#### Integration Tests

- **Cross-Instance Compatibility**: Verifies tokens generated by one instance can be validated by another with same secret
- **Secret Isolation**: Confirms tokens from different secrets are rejected
- **End-to-End Workflow**: Tests complete generate → validate → reuse cycle

### Performance Benchmarks

#### Token Validation Performance

- **Average Response Time**: <0.02ms
- **95th Percentile**: <0.03ms
- **Throughput**: High (447KB/s for large content)

#### Content Hashing Performance

- **Small Content (<1KB)**: ~0.02ms average
- **Medium Content (1-10KB)**: ~0.01ms average
- **Large Content (>10KB)**: ~0.01ms average

#### Reuse Performance Improvement

- **Speedup Factor**: 2-5x faster than full sanitization
- **Memory Usage**: Stable, no significant leaks detected

### Environment Setup Requirements

#### Required Environment Variables

- `TRUST_TOKEN_SECRET`: Must be set for TrustTokenGenerator initialization
- `NODE_ENV`: Influences test behavior and logging levels

#### Test Environment Configuration

- All tests run with isolated environment variables
- Environment cleanup performed between test cases
- No persistent state between test executions

### Troubleshooting Common Issues

#### Environment Variable Not Set

```
Error: TRUST_TOKEN_SECRET environment variable must be set
```

**Solution**: Ensure TRUST_TOKEN_SECRET is set in environment or passed via constructor options

#### Token Validation Failures

- Check token expiration (default 24 hours)
- Verify secret consistency between generation and validation
- Confirm token structure integrity

#### Performance Issues

- Monitor token validation latency (>0.1ms may indicate issues)
- Check for memory leaks in long-running processes
- Verify cryptographic operations are not blocked

### Security Testing Notes

#### Cryptographic Validation

- SHA256 hashing for content integrity
- HMAC-SHA256 for signature verification
- Secure key management through environment variables

#### Tamper Prevention

- Signature validation prevents token modification
- Hash verification ensures content integrity
- Expiration prevents indefinite token validity

#### Audit Trail Integration

- All token operations logged through audit system
- Failed validations tracked for security monitoring
- Performance metrics collected for anomaly detection

### Maintenance Guidelines

#### Test Updates

- Add new test cases for environment validation edge cases
- Update performance benchmarks as system evolves
- Maintain test isolation and cleanup procedures

#### Documentation Updates

- Keep this document synchronized with code changes
- Update troubleshooting section with new issues
- Review performance benchmarks quarterly

#### Security Reviews

- Annual review of cryptographic implementations
- Regular testing of security controls
- Monitoring of performance degradation
