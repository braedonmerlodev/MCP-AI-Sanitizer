# Emergency Rollback Procedures for Security Hardening Changes

## Overview

This document outlines the comprehensive emergency rollback process for reverting all security hardening changes implemented during the Quality & Security Hardening Epic (Stories 1.1-1.12). The rollback restores the system to its baseline state prior to security vulnerability resolution.

**WARNING**: This procedure will reintroduce known security vulnerabilities. It should only be executed in emergency situations where security hardening changes are causing critical system failures that cannot be resolved through other means.

## Prerequisites

- Administrative access to the server/environment
- Backup of current state (recommended)
- Access to pre-vulnerability-fix backup files
- Understanding of the security changes being reverted

## Security Changes to be Reverted

The following security hardening changes will be rolled back:

### Package Version Updates (Story 1.1)

- express: 4.21.2 → 4.18.2 (reintroduces body-parser DoS, path-to-regexp ReDoS, send XSS vulnerabilities)
- body-parser: 1.20.3 → 1.19.0 (reintroduces DoS vulnerability)
- cookie: 0.7.1 → 0.6.0 (reintroduces parsing vulnerability)
- path-to-regexp: 0.1.12 → 0.1.7 (reintroduces ReDoS vulnerability)
- send: 0.19.0 → 0.18.0 (reintroduces XSS vulnerability)
- jest: 29.x → 27.x (reintroduces js-yaml prototype pollution in test dependencies)

### Code Changes (Stories 1.2-1.12)

- AdminOverrideController test fixes
- ApiContractValidationMiddleware test fixes
- QueueManager module resolution fixes
- TrustTokenGenerator environment validation
- JSONTransformer compatibility fixes
- AI config API key validation
- TrainingDataCollector assertion fixes
- HITL escalation logging test fixes
- PDF AI workflow integration test fixes
- Test coverage improvements (80%+)
- QA sign-off validations

## Step-by-Step Rollback Procedure

### Phase 1: Preparation

1. **Stop the Application**

   ```bash
   # Stop all running processes
   pm2 stop all  # or systemctl stop your-service
   # Verify no processes are running
   ps aux | grep node
   ```

2. **Create Emergency Backup**

   ```bash
   # Backup current state
   mkdir -p backups/emergency-$(date +%Y%m%d-%H%M%S)
   cp -r src backups/emergency-$(date +%Y%m%d-%H%M%S)/
   cp package.json backups/emergency-$(date +%Y%m%d-%H%M%S)/
   cp package-lock.json backups/emergency-$(date +%Y%m%d-%H%M%S)/
   ```

3. **Document Current State**
   - Record current package versions: `npm list --depth=0`
   - Record current test status: `npm test`
   - Record current security audit: `npm audit`

### Phase 2: Package Version Rollback

4. **Restore Package Dependencies**

   ```bash
   # Copy pre-vulnerability-fix package.json
   cp backups/pre-vulnerability-fix/package.json .

   # If package-lock.json backup exists, restore it
   cp backups/pre-vulnerability-fix/package-lock.json . 2>/dev/null || true

   # Force installation of vulnerable versions
   npm install --force
   ```

5. **Verify Package Versions**

   ```bash
   # Check installed versions
   npm list express body-parser cookie path-to-regexp send jest

   # Expected vulnerable versions:
   # express@4.18.2
   # body-parser@1.19.0
   # cookie@0.6.0
   # path-to-regexp@0.1.7
   # send@0.18.0
   # jest@27.x.x
   ```

### Phase 3: Code Changes Rollback

6. **Restore Source Code**

   ```bash
   # If git repository, revert commits
   git log --oneline | head -20  # Identify security hardening commits
   git revert <commit-hash-1> <commit-hash-2> ...  # Revert security commits

   # Alternative: Restore from backup
   cp -r backups/pre-vulnerability-fix/src/* src/
   ```

7. **Restore Test Files**

   ```bash
   # Restore original test files
   cp -r backups/pre-vulnerability-fix/src/tests/* src/tests/
   ```

8. **Restore Configuration Files**
   ```bash
   # Restore any modified config files
   cp backups/pre-vulnerability-fix/jest.config.js . 2>/dev/null || true
   cp backups/pre-vulnerability-fix/eslint.config.mjs . 2>/dev/null || true
   ```

### Phase 4: Validation and Testing

9. **Run Security Audit**

   ```bash
   # Verify vulnerabilities are reintroduced
   npm audit --audit-level=moderate

   # Expected: Should show the original 24 vulnerabilities
   # - 3 High severity
   # - 18 Moderate severity
   ```

10. **Run Test Suite**

    ```bash
    # Run tests to verify baseline functionality
    npm test

    # Expected: Tests should pass (original test state)
    # Note: Coverage may drop below 80%
    ```

11. **Integration Testing**

    ```bash
    # Test key endpoints
    npm run test:integration

    # Manual testing of critical paths:
    # - POST /api/sanitize
    # - POST /api/documents/upload
    # - GET /api/jobs/{id}/status
    # - POST /api/admin/override/activate
    ```

12. **Performance Validation**

    ```bash
    # Run performance tests
    npm run test:performance

    # Verify no unexpected performance degradation
    ```

### Phase 5: System Restart

13. **Start the Application**

    ```bash
    # Start the application
    npm start  # or pm2 start ecosystem.config.js
    ```

14. **Monitor System Health**

    ```bash
    # Check application logs
    tail -f logs/app.log

    # Verify endpoints are responding
    curl -X GET http://localhost:3000/health

    # Monitor for errors
    ```

## Validation Checks

### Pre-Rollback Validation

- [ ] Application stopped successfully
- [ ] Emergency backup created
- [ ] Current state documented

### Package Rollback Validation

- [ ] Package versions match baseline
- [ ] npm install completed without errors
- [ ] Security audit shows original vulnerabilities

### Code Rollback Validation

- [ ] Source files restored to baseline
- [ ] Test files restored
- [ ] Configuration files restored

### Functional Validation

- [ ] All tests pass (baseline test suite)
- [ ] Integration tests pass
- [ ] Manual endpoint testing successful
- [ ] Performance metrics within baseline

### Post-Restart Validation

- [ ] Application starts successfully
- [ ] No critical errors in logs
- [ ] Endpoints respond correctly
- [ ] System stable for 30 minutes

## Risk Assessment

### Immediate Risks After Rollback

- **High**: System exposed to 24 known vulnerabilities
- **Medium**: Potential service disruption from untested configurations
- **Low**: Data integrity issues if code changes weren't properly reverted

### Mitigation Measures

- Implement immediate monitoring for exploitation attempts
- Prepare incident response plan
- Schedule urgent security hardening re-implementation
- Consider temporary service suspension

## Recovery Plan

### If Rollback Fails

1. Restore from emergency backup created in Phase 1
2. Investigate failure cause
3. Retry rollback with corrections
4. Contact development team for assistance

### Forward Recovery

1. Identify root cause of emergency requiring rollback
2. Fix the underlying issue
3. Re-implement security hardening changes
4. Perform comprehensive testing before production deployment

## Documentation Updates

After successful rollback:

- Update system status documentation
- Notify security team of vulnerability reintroduction
- Create incident report
- Schedule security hardening re-implementation

## Contact Information

- Security Team: [security@company.com]
- Development Team: [dev@company.com]
- Incident Response: [incident@company.com]

---

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Author**: Development Team
**Approved By**: Security Team</content>
<parameter name="filePath">docs/security/emergency-rollback-procedures.md
