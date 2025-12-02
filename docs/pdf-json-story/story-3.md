# Story-3: Integrate Trust Tokens into JSON Outputs

## Status

Ready for Development

## Story

**As a** Security Engineer,  
**I want** trust tokens included in JSON outputs for cryptographic validation and smart caching,  
**so that** previously sanitized content can be securely verified and reused without reprocessing.

## Acceptance Criteria

1. Generate trust tokens during sanitization with content hash, applied rules, HMAC-SHA256 signature, expiration, and version.
2. Include `trustToken` field in JSON output with token details.
3. Enable smart caching: Valid tokens skip redundant sanitization (<10ms response).
4. Support cryptographic validation to prevent tampering.
5. Maintain backward compatibility for requests without tokens.

## Tasks / Subtasks

- [ ] Integrate `TrustTokenGenerator` into sanitization pipeline.
- [ ] Modify JSON output to include `trustToken` field.
- [ ] Implement caching logic for valid tokens.
- [ ] Add cryptographic validation endpoints.
- [ ] Update unit/integration tests for token functionality.

## Dev Notes

- Uses HMAC-SHA256 for signatures.
- Reduces redundant processing by up to 42%.
- Critical for performance and security.
- JSON Output Example: `{ "sanitizedData": "...", "trustToken": { "contentHash": "...", "originalHash": "...", "sanitizationVersion": "1.0", "rulesApplied": [...], "timestamp": "...", "expiresAt": "...", "signature": "..." } }`
- Cryptographic Validation Endpoints: New `/api/trust-tokens/validate` route for token verification.
- Caching Strategy: In-memory LRU cache with configurable TTL and size limits.

## Risk Notes

- **Token Tampering**: Weak signatures could allow malicious cache bypass; mitigated by HMAC-SHA256.
- **Key Compromise**: Exposed secret keys enable forged tokens; mitigated by secure key management.
- **Cache Poisoning**: Invalid cached results from tampered tokens; mitigated by content hash validation.

## Recommendations

- **Resolve Dependency Cycle**: Implement TrustTokenGenerator component independently first, then integrate into Story-1. This avoids circular dependencies between token generation and sanitization.
- **Security Best Practices**: Ensure HMAC secret key is securely managed (environment variables, key rotation).
- **Performance Monitoring**: Track cache hit rates and token validation times in production.

## Dependencies

- None (implement TrustTokenGenerator independently to resolve cycle with Story-1)

## Change Log

| Date       | Version | Description                             | Author       |
| ---------- | ------- | --------------------------------------- | ------------ |
| 2025-12-01 | 1.0     | Created from master story decomposition | AI Assistant |
