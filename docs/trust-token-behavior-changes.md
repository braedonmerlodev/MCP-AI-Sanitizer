# TrustTokenGenerator Behavior Changes Documentation

## Overview

This document outlines the behavior changes implemented in TrustTokenGenerator as part of security hardening epic 1.5 (TrustTokenGenerator Environment Validation).

## Environment Validation Changes

### Constructor Validation (Breaking Change)

**Previous Behavior**: TrustTokenGenerator constructor accepted any options without validation
**New Behavior**: Constructor now validates TRUST_TOKEN_SECRET presence

```javascript
// Before: Would create instance without secret validation
const generator = new TrustTokenGenerator({});

// After: Throws error if no secret provided
const generator = new TrustTokenGenerator({});
// Error: TRUST_TOKEN_SECRET environment variable must be set
```

### Environment Variable Priority

**Behavior**: Options.secret takes precedence over environment variables
**Implementation**: Constructor checks options.secret first, then falls back to process.env.TRUST_TOKEN_SECRET

```javascript
// Options take precedence
const generator = new TrustTokenGenerator({ secret: 'option-secret' });
// Uses 'option-secret' even if TRUST_TOKEN_SECRET env var is set
```

### Error Handling

**New Feature**: Clear error messages for missing secrets
**Error Message**: `"TRUST_TOKEN_SECRET environment variable must be set"`

## Token Generation/Validation (No Changes)

### Token Structure

**Unchanged**: All token fields and validation logic remain identical

- contentHash, originalHash, sanitizationVersion, rulesApplied, timestamp, expiresAt, signature

### Cryptographic Operations

**Unchanged**: SHA256 hashing and HMAC-SHA256 signatures work identically
**Performance**: No performance impact on token operations

### Compatibility

**Guaranteed**: All existing tokens remain valid
**Migration**: No migration required for existing trust tokens

## Environment Requirements

### Required Environment Variables

- `TRUST_TOKEN_SECRET`: Must be set for TrustTokenGenerator initialization
- Type: String, minimum length recommended: 32 characters
- Security: Should be cryptographically secure random string

### Optional Environment Variables

- No changes to existing optional environment variables

## Deployment Considerations

### Backward Compatibility

- **Safe**: No breaking changes to existing token functionality
- **Required**: TRUST_TOKEN_SECRET must be set in all environments
- **Migration**: Add environment variable to existing deployments

### Testing Requirements

- **New**: Environment validation tests added
- **Existing**: All existing tests continue to pass
- **Performance**: No regression in token operation performance

## Troubleshooting

### Common Issues

1. **Missing TRUST_TOKEN_SECRET**: Application fails to start with clear error message
2. **Environment Variable Not Set**: Check deployment configuration
3. **Options vs Environment**: Options.secret overrides environment variables

### Migration Guide

1. Add `TRUST_TOKEN_SECRET` to environment variables
2. Generate secure random string (recommended: 32+ characters)
3. Test in staging environment before production deployment
4. Update deployment scripts and documentation

## Security Impact

### Positive Changes

- **Validation**: Prevents accidental deployment without proper secrets
- **Clarity**: Clear error messages aid troubleshooting
- **Consistency**: Standardized secret management across environments

### No Security Degradation

- **Cryptography**: Unchanged - SHA256, HMAC-SHA256 still secure
- **Token Validity**: Existing tokens remain valid indefinitely
- **Performance**: No impact on security operations

## Maintenance Notes

### Future Changes

- Monitor for new Node.js crypto API changes
- Consider secret rotation mechanisms
- Review token expiration policies periodically

### Monitoring

- Watch for constructor validation errors in logs
- Monitor token validation performance metrics
- Track token generation success rates
