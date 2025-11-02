# Epic 5: LLM-Input-Only Sanitization - Brownfield Enhancement

## Epic Goal

Implement selective sanitization that only processes MCP traffic destined for LLM consumption, improving performance and precision while maintaining security for AI interactions. This reduces unnecessary processing overhead and focuses security measures where they matter most.

## Epic Description

### Existing System Context

- **Current relevant functionality:** The system currently sanitizes all MCP traffic indiscriminately, including file operations, tool calls, and content that may never reach LLMs. This includes symbol stripping, escape neutralization, and other sanitization processes applied universally.

- **Technology stack:** Node.js, Express.js, sanitization pipeline components (EscapeNeutralization, proxy-sanitizer, sanitization-pipeline.js), API endpoints.

- **Integration points:** API routes (/api/documents/upload), sanitization pipeline integration, document processing workflows.

### Enhancement Details

- **What's being added/changed:**
  - Track data flow destinations to identify LLM-bound content
  - Modify sanitization pipeline to conditionally sanitize only when content enters LLM context windows
  - Allow "raw" MCP operations for non-LLM use cases
  - Implement Cryptographic Trust Tokens for Sanitized Content Reuse

- **How it integrates:** The sanitization pipeline will be enhanced with destination checking logic. Content will only be processed through sanitization steps when confirmed to be destined for LLM consumption. A trust token system will enable efficient reuse of sanitized content.

- **Success criteria:**
  - Reduced processing scope (only LLM-bound data sanitized)
  - Measurable performance improvements
  - Maintained security for all LLM inputs
  - Trust token system enables secure content reuse
  - Backward compatibility with existing integrations

### Implementation Plan: Trust Token System

#### Phase 1: Core Trust Token Infrastructure

**Data Structure:**

```typescript
interface SanitizationTrustToken {
  contentHash: string; // SHA-256 of sanitized content
  originalHash: string; // SHA-256 of raw content
  sanitizationVersion: string; // Version of sanitization rules
  rulesApplied: string[]; // Array of applied sanitization rules
  timestamp: Date; // When sanitization occurred
  expiresAt: Date; // Token expiration
  signature: string; // HMAC-SHA256 signature
}
```

**Key Components:**

- Token Generator: Creates tokens during sanitization
- Token Validator: Fast cryptographic verification
- Token Storage: Alongside sanitized content
- Cache Manager: Handles token lifecycle

#### Phase 2: Integration Points

**API Evolution:**

- Enhanced `/api/documents/upload` endpoint returns sanitized content + trust token
- Integration with `/api/trust-tokens/validate` endpoint for trust token validation

**Cache Strategy:**

- Memory Cache: Hot content with valid tokens
- Persistent Cache: Database storage for tokens
- Invalidation: Automatic on rule updates

#### Phase 3: Security Hardening

**Cryptographic Implementation:**

- HMAC-SHA256 for tamper-proof signatures
- Configurable secret key rotation
- Token expiration policies
- Audit logging of all validations

**Trust Boundaries:**

- Validate tokens at API boundaries
- Never trust content without valid token
- Log token validation failures

#### Phase 4: Performance Optimization

**Smart Caching:**

- LRU cache for frequently accessed tokens
- Background revalidation for expiring tokens
- Compression for large token payloads

**Monitoring:**

- Token validation success/failure rates
- Cache hit/miss ratios
- Performance impact metrics

## Stories

1. **Destination Tracking Implementation:** Implement mechanisms to track and identify MCP traffic destinations, determining when content will enter LLM context windows. This includes analyzing request metadata, headers, and routing information to classify traffic types.

2. **Conditional Sanitization Pipeline:** Modify the sanitization pipeline to apply sanitization only when content is destined for LLM consumption, bypassing sanitization for file operations, tool calls, and other non-LLM traffic. Ensure fallback to full sanitization when destination is unclear.

3. **Trust Token System:** Develop and integrate cryptographic trust tokens for sanitized content, enabling secure reuse and validation of previously sanitized data. Implement token generation, validation, storage, and caching mechanisms.

## Compatibility Requirements

- [ ] Existing APIs remain unchanged (backward compatible)
- [ ] Database schema changes are backward compatible
- [ ] UI changes follow existing patterns (minimal/no changes expected)
- [ ] Performance impact is minimal (expected improvement through reduced processing)

## Risk Mitigation

- **Primary Risk:** Potential security vulnerabilities if destination identification fails or non-LLM data inadvertently reaches LLMs without sanitization.
- **Mitigation:** Implement robust destination tracking with validation, comprehensive testing of conditional logic, security audits, and fallback mechanisms.
- **Rollback Plan:** Revert pipeline modifications to restore full sanitization for all traffic; maintain ability to disable selective sanitization via configuration.

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] Existing functionality verified through comprehensive testing
- [ ] Integration points working correctly
- [ ] Documentation updated appropriately
- [ ] No regression in existing features
- [ ] Performance benchmarks show improvement over full sanitization
- [ ] Trust token system validated for security and efficiency
- [ ] Security audit confirms no vulnerabilities introduced
- [ ] Backward compatibility maintained for all existing integrations
