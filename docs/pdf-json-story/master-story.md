# Master Story: Integrated AI-Powered PDF Processing with Restricted Data Segregation and Trust Token Validation

**As a** Product Manager and Security Compliance Officer,  
**I want** the system to process PDF text, sanitize threats, segregate restricted data, structure content into semantic JSON, and include trust tokens for cryptographic validation and smart caching,  
**so that** downstream agents receive clean, structured, and verifiable data while ensuring compliance, security, and performance through reuse mechanisms.

## Business Context

This master story combines the AI-powered structuring and sanitization of PDFs (Story 2) with restricted data segregation (Story 1), while integrating trust tokens (from Story 5.3: Implement Trust Token System) to enable smart caching and cryptographic validation. The current system sanitizes and structures PDFs but does not segregate restricted data or include trust tokens in JSON outputs, leading to potential security risks and inefficient caching. Trust tokens will allow validation of previously sanitized content, reducing redundant processing by up to 42% (based on prior findings).

## Risk Assessment

- **High Risk**: Failure to segregate restricted data could expose PII/malicious content; missing trust tokens could lead to invalid caching and security bypasses.
- **Medium Risk**: AI structuring might lose semantic meaning if sanitization is too aggressive; trust token generation could impact performance.
- **Mitigation**: Comprehensive testing for segregation, structuring, and token integration; performance benchmarks for token generation.

## Acceptance Criteria

1. **Sanitization and Structuring (from Story 2)**:
   - Process PDF text, remove threats (zero-width/invisible/XSS) while preserving structure markers (bullet points, newlines, colons).
   - Output semantic JSON with keys like `headline`, `problem_statement`, `recommended_approach`, `target_outcomes`.
   - Verify content extraction (e.g., bullet points for problem statements) using test cases like "Rippling" PDF.

2. **Restricted Data Segregation (from Story 1)**:
   - Identify and segregate PII (emails, phones, SSNs), malicious patterns (XSS, SQLi), control/invisible characters, and problematic sections into a `restricted_data` key.
   - Ensure main `summary` and `content` fields are clean; `restricted_data` is clearly marked.
   - Maintain valid JSON structure and test with problematic content (e.g., "Test PDF").

3. **Trust Token Integration**:
   - Generate trust tokens during sanitization with content hash, applied rules, HMAC-SHA256 signature, expiration, and version.
   - Include trust tokens in JSON output (e.g., add `trustToken` field with token details).
   - Enable smart caching: Valid tokens skip redundant sanitization (achieve <10ms response for cached content).
   - Support cryptographic validation: Tokens verify content integrity and prevent tampering.
   - Backward compatibility: Requests without tokens process normally.

4. **Integration and Verification**:
   - JSON output includes both structured content and `trustToken` for all processed PDFs.
   - End-to-end testing confirms segregation, structuring, and token validation.
   - No regression in normal document processing; performance meets benchmarks (e.g., 1.8s average processing time).
   - Audit logging captures token generation and validation events.

## Tasks / Subtasks

- [ ] **Sanitization and Structuring Tasks** (from Story 2):
  - Update `AITextTransformer.js` to handle PDF text processing and semantic JSON structuring.
  - Preserve structure markers during sanitization.
  - Create integration tests for content extraction (e.g., `manual-test-rippling-structure.js`).

- [ ] **Restricted Data Segregation Tasks** (from Story 1):
  - Modify `structure` prompt in `AITextTransformer.js` to segregate restricted data into `restricted_data` key.
  - Add unit tests for segregation logic and JSON validity.

- [ ] **Trust Token Integration Tasks**:
  - Integrate `TrustTokenGenerator` (from Story 5.3) into the sanitization pipeline.
  - Modify JSON output to include `trustToken` field with hash, signature, expiration, etc.
  - Implement caching logic: Validate tokens to skip processing for repeated content.
  - Add cryptographic validation endpoints and audit logging.
  - Update unit/integration tests for token generation, validation, and caching.

- [ ] **Combined Testing and Verification**:
  - End-to-end tests for full pipeline (sanitization → segregation → structuring → token inclusion).
  - Performance tests for caching efficiency and token generation latency.
  - Security tests for token tampering prevention.

## Dev Notes

- **Existing System Integration**: Builds on `AITextTransformer.js`, `TrustTokenGenerator.js`, and sanitization pipeline. Uses LangChain/Gemini for AI, HMAC-SHA256 for tokens.
- **Key Constraints**: Maintain JSON validity; ensure token generation doesn't exceed 5% performance overhead; fit within AI token limits.
- **Testing Standards**: Jest for unit/integration tests; 90% coverage; include edge cases for restricted data and token expiration.

## Change Log

| Date       | Version | Description                                                                     | Author       |
| ---------- | ------- | ------------------------------------------------------------------------------- | ------------ |
| 2025-12-01 | 1.0     | Master story created by combining Stories 1 & 2, adding trust token integration | AI Assistant |

## QA Results

- **Status**: Ready for Development (requires implementation of trust token inclusion in JSON outputs).
- **Recommendations**: Prioritize trust token integration to address the user's concern about missing tokens in JSON objects. Monitor for performance impact during token generation.

## Recommendations and Mitigations (from PO Master Checklist)

### Must-Fix Before Development (Critical Blocking Issues)

1. **Enhance Rollback Strategy**: Implement feature flags and monitoring triggers for safe brownfield deployment. Define clear rollback procedures with thresholds for when to revert changes.
2. **Add API Documentation**: Create explicit API documentation for trust token endpoints and JSON output changes, including examples of token validation requests.
3. **Define API Constraints**: Specify API limit constraints and fallback strategies for Gemini (e.g., rate limiting, error handling for quota exceeded).

### Should-Fix for Quality

1. **Verify LangChain/Gemini Compatibility**: Add explicit version compatibility checks and testing for LangChain and Gemini integrations.
2. **Implement Detailed Integration Testing**: Specify step-by-step integration testing procedures at each development stage, including end-to-end pipeline validation.
3. **Document Technical Debt**: Identify and document current technical debt (e.g., performance overhead concerns) and future extensibility points.

### Consider for Improvement

1. **Add Credential Storage Procedures**: Define secure procedures for storing and managing API credentials (e.g., Gemini API keys).
2. **Enhance Performance Benchmarks**: Provide more detailed performance benchmarks for token generation, including latency measurements and CPU usage thresholds.
3. **Plan Code Review Knowledge Sharing**: Establish procedures for sharing code review insights and lessons learned during development.

### Post-MVP Deferrals

- Advanced monitoring enhancements (e.g., detailed metrics for token validation success rates).
- User documentation (if frontend components are added later).
