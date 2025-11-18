# TrustTokenGenerator Environment Validation Troubleshooting Guide

## Overview

This guide provides troubleshooting procedures for TrustTokenGenerator environment validation issues encountered during deployment and maintenance.

## Common Issues and Solutions

### Issue: Application Fails to Start with "TRUST_TOKEN_SECRET environment variable must be set"

#### Symptoms

- Application crashes on startup
- Error message: `TRUST_TOKEN_SECRET environment variable must be set`
- TrustTokenGenerator constructor fails

#### Root Causes

1. Missing `TRUST_TOKEN_SECRET` environment variable
2. Environment variable not loaded properly
3. Deployment configuration issue

#### Solutions

1. **Check Environment Variable**

   ```bash
   echo $TRUST_TOKEN_SECRET
   # Should output the secret value
   ```

2. **Add to Environment File**

   ```bash
   # .env file
   TRUST_TOKEN_SECRET=your-secure-random-secret-here
   ```

3. **Docker Deployment**

   ```bash
   docker run -e TRUST_TOKEN_SECRET=your-secret your-app
   ```

4. **Kubernetes/ConfigMap**
   ```yaml
   env:
     - name: TRUST_TOKEN_SECRET
       valueFrom:
         secretKeyRef:
           name: app-secrets
           key: trust-token-secret
   ```

#### Prevention

- Always include `TRUST_TOKEN_SECRET` in deployment checklists
- Use secret management systems (Vault, AWS Secrets Manager, etc.)
- Validate environment variables in CI/CD pipelines

---

### Issue: Token Validation Fails with "Invalid token signature"

#### Symptoms

- Trust tokens are rejected as invalid
- API returns 403/401 errors for token-protected endpoints
- Audit logs show signature validation failures

#### Root Causes

1. Different secrets used for generation vs validation
2. Secret changed after tokens were issued
3. Environment variable not consistent across services

#### Solutions

1. **Verify Secret Consistency**

   ```javascript
   // Check secret in both services
   console.log(process.env.TRUST_TOKEN_SECRET);
   ```

2. **Regenerate Tokens** (if secret changed)

   ```javascript
   // All existing tokens become invalid
   // Clients must request new tokens
   ```

3. **Check Service Configuration**
   - Ensure all services use same `TRUST_TOKEN_SECRET`
   - Verify environment loading order
   - Check for environment variable overrides

#### Prevention

- Use shared secret management across services
- Implement secret rotation with token invalidation
- Monitor token validation success rates

---

### Issue: Token Validation Performance Degradation

#### Symptoms

- Token validation takes >0.1ms
- Increased response times on protected endpoints
- Performance monitoring shows crypto operation bottlenecks

#### Root Causes

1. Large token payloads
2. Inefficient crypto operations
3. Memory pressure affecting crypto performance

#### Solutions

1. **Monitor Token Sizes**

   ```javascript
   // Check token size in logs
   console.log('Token size:', JSON.stringify(token).length);
   ```

2. **Performance Profiling**

   ```javascript
   const start = performance.now();
   const result = generator.validateToken(token);
   const duration = performance.now() - start;
   console.log(`Validation took ${duration}ms`);
   ```

3. **Optimize Token Payload**
   - Minimize rulesApplied array
   - Use efficient serialization
   - Consider token compression for large payloads

#### Prevention

- Set up performance monitoring baselines
- Alert on validation times >0.05ms
- Regular performance regression testing

---

### Issue: Environment Variable Not Loaded in Tests

#### Symptoms

- Tests fail with environment validation errors
- CI/CD pipeline failures
- Local development issues

#### Root Causes

1. Test environment not properly configured
2. Environment variables not set in test scripts
3. Jest configuration issues

#### Solutions

1. **Check Test Setup**

   ```javascript
   // In test files
   beforeAll(() => {
     process.env.TRUST_TOKEN_SECRET = 'test-secret';
   });
   ```

2. **Jest Configuration**

   ```javascript
   // jest.config.js
   setupFilesAfterEnv: ['<rootDir>/jest.setup.js'];
   ```

3. **Environment File for Tests**
   ```bash
   # .env.test
   TRUST_TOKEN_SECRET=test-secret-key
   ```

#### Prevention

- Standardize test environment setup
- Include environment validation in test checklists
- Use test-specific environment files

---

### Issue: Token Expiration Issues

#### Symptoms

- Valid tokens suddenly rejected
- Intermittent authentication failures
- Timezone-related validation issues

#### Root Causes

1. Server time drift
2. Token expiration time miscalculation
3. Client/server timezone differences

#### Solutions

1. **Check Server Time**

   ```bash
   date
   # Ensure server time is accurate
   ```

2. **Verify Token Expiration**

   ```javascript
   const token = generator.generateToken(content, original, rules);
   console.log('Expires:', new Date(token.expiresAt));
   ```

3. **NTP Synchronization**
   ```bash
   # Ensure NTP is running
   systemctl status ntpd
   ```

#### Prevention

- Use NTP for time synchronization
- Monitor token expiration patterns
- Set appropriate default expiration times

---

## Diagnostic Tools

### Environment Validation Script

```javascript
// validate-env.js
const TrustTokenGenerator = require('./components/TrustTokenGenerator');

try {
  const generator = new TrustTokenGenerator();
  console.log('✅ Environment validation passed');

  // Test token generation
  const token = generator.generateToken('test', 'test', []);
  console.log('✅ Token generation works');

  // Test token validation
  const result = generator.validateToken(token);
  console.log('✅ Token validation works:', result.isValid);
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}
```

### Performance Monitoring

```javascript
// monitor-performance.js
const TrustTokenGenerator = require('./components/TrustTokenGenerator');
const { performance } = require('perf_hooks');

const generator = new TrustTokenGenerator();
const iterations = 1000;

console.log(`Running ${iterations} token operations...`);

let totalTime = 0;
for (let i = 0; i < iterations; i++) {
  const start = performance.now();

  const token = generator.generateToken(`content-${i}`, `original-${i}`, []);
  const result = generator.validateToken(token);

  const end = performance.now();
  totalTime += end - start;
}

const avgTime = totalTime / iterations;
console.log(`Average operation time: ${avgTime.toFixed(3)}ms`);
console.log(`Total time: ${totalTime.toFixed(2)}ms`);
```

## Emergency Procedures

### Complete Trust Token Reset

1. **Stop all services** using TrustTokenGenerator
2. **Change TRUST_TOKEN_SECRET** to new value
3. **Clear all cached tokens** from client applications
4. **Restart services** with new secret
5. **Monitor** for authentication issues
6. **Communicate** with clients about token invalidation

### Rollback Procedure

1. **Revert** TrustTokenGenerator to previous version
2. **Restore** old TRUST_TOKEN_SECRET
3. **Restart** services
4. **Verify** token validation works
5. **Monitor** for issues

## Maintenance Checklist

### Weekly

- [ ] Check token validation success rates (>99%)
- [ ] Monitor average validation times (<0.05ms)
- [ ] Review error logs for validation failures

### Monthly

- [ ] Audit secret management practices
- [ ] Review token expiration policies
- [ ] Update performance baselines

### Quarterly

- [ ] Security review of crypto implementations
- [ ] Performance regression testing
- [ ] Documentation review and updates

## Contact Information

For urgent issues:

- **Security Team**: security@company.com
- **DevOps**: devops@company.com
- **Development**: dev-team@company.com

## References

- [TrustTokenGenerator API Documentation](./api/trust-tokens.md)
- [Security Hardening Guidelines](./GUIDING-PRINCIPLES.md)
- [Environment Setup Guide](../README.md#environment-setup)
