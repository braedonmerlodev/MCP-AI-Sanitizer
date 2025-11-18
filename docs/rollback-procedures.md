# Rollback Procedures for Security Fixes

## Overview

This document outlines the rollback procedures for security hardening changes in the MCP Security Sanitizer application. Rollback should be considered when security fixes cause system instability or performance degradation.

## Rollback Triggers

### Error Rate Thresholds

- **Critical**: >10% error rate across all endpoints for >5 minutes
- **Warning**: >5% error rate across all endpoints for >10 minutes
- **Performance**: >20% increase in response time for critical endpoints

### Security-Related Triggers

- Re-emergence of known vulnerabilities (confirmed by security scanning)
- Authentication/authorization failures affecting legitimate users
- Data integrity issues or sanitization failures

### System Health Triggers

- Application startup failures
- Database connectivity issues
- Memory leaks or resource exhaustion

## Rollback Procedure

### Step 1: Stop Application

```bash
# Stop the running application
pkill -f "node src/app.js"
# Or use your process manager (pm2, systemd, etc.)
```

### Step 2: Restore Package Configuration

```bash
# Restore package.json from backup
cp backups/pre-vulnerability-fix/package.json .

# Reinstall dependencies with original versions
npm install
```

### Step 3: Verify System Health

```bash
# Run basic health checks
npm test

# Test critical endpoints manually
curl -X POST http://localhost:3000/api/sanitize/json \
  -H "Content-Type: application/json" \
  -d '{"content": "test data"}'

# Check application startup
npm start &
```

### Step 4: Monitor Post-Rollback

- Monitor error rates for 30 minutes
- Verify performance baselines
- Check security scanning results
- Validate critical workflows

## Timeline Requirements

- Rollback execution: <15 minutes
- System recovery: <5 minutes
- Full validation: <30 minutes

## Monitoring Setup

### Basic Health Checks

- **Application Startup**: Verify `npm start` completes without errors
- **Test Suite**: Run `npm test` to ensure core functionality
- **Critical Endpoints**:
  - `POST /api/sanitize/json` - Response time <100ms
  - `POST /api/documents/upload` - File processing works
  - `POST /api/export/training-data` - Data export functions
- **Resource Usage**: Monitor memory/CPU via system tools

### Alerting Thresholds

- Error rate >5% across endpoints: Warning alert
- Error rate >10% across endpoints: Critical alert, initiate rollback
- Response time >200ms for sanitization: Performance alert
- Application startup failures: Immediate rollback consideration

### Logging and Monitoring

- **Application Logs**: Winston logging captures errors and performance metrics
- **Audit Trail**: Data integrity operations logged for security monitoring
- **Test Results**: Automated test runs provide health indicators
- **Manual Checks**: Periodic manual testing of critical workflows

### Post-Deployment Monitoring Timeline

- **First 5 minutes**: Basic startup and endpoint availability
- **First 30 minutes**: Full test suite execution and performance validation
- **First 2 hours**: Extended monitoring for stability
- **First 24 hours**: Security scanning and comprehensive validation

## Prevention Measures

- Always create backups before security updates
- Test security fixes in staging environment first
- Implement gradual rollout with feature flags
- Maintain comprehensive test coverage

## Contact Information

- DevOps Team: For rollback execution
- Security Team: For vulnerability assessment
- QA Team: For functionality validation
