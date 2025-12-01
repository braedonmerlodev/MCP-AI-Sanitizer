# Implement Restricted Data Segregation in AI Text Transformation

## Status

Ready for Review

## Story

**As a** security compliance officer,
**I want** restricted data (PII, malicious patterns, control characters) identified during AI text transformation to be scrubbed or segregated into a restricted section,
**so that** downstream agents and public summaries do not contain sensitive or dangerous information.

## Acceptance Criteria

1. Update the `structure` prompt in `AITextTransformer.js` to explicitly handle restricted data.
2. Instruct the AI to identify and segregate:
   - PII (emails, phones, SSNs)
   - Malicious patterns (XSS, SQLi)
   - Control/Invisible characters
   - Specific problematic sections such as "Zero-width characters", "Control characters", "Invisible characters", "Symbols and special chars", "Unicode text", "Potential XSS", "Patterns", "Mathematical symbols"
3. Move identified restricted data, including entire sections with these titles, to a separate `restricted_data` key in the JSON output.
4. Ensure the main `summary` and `content` fields are free of this data.
5. The output JSON structure remains valid.
6. `restricted_data` section is clearly marked.
7. Verify with the "Test PDF" content that previously triggered the issue.
8. Ensure no regression in normal document summarization.

## Tasks / Subtasks

- [x] Update `AITextTransformer.js` prompt template (AC: 1, 2, 3, 4)
  - [x] Modify `structure` prompt to include instructions for `restricted_data` segregation
  - [x] Ensure instructions explicitly list PII, malicious patterns, and control characters
- [x] Implement Unit Tests (AC: 5, 6, 8)
  - [x] Create or update unit tests in `src/tests/unit/AITextTransformer.test.js` (or similar)
  - [x] Verify JSON structure validity with restricted data
  - [x] Verify normal documents are unaffected
- [x] Verify with "Test PDF" content (AC: 7)
  - [x] Create a reproduction test case using the problematic content (Zero-width chars, etc.)
  - [x] Confirm `restricted_data` contains the artifacts and `summary` is clean

## Dev Notes

**Existing System Integration:**

- Integrates with: `AITextTransformer.js`
- Technology: LangChain, Google Gemini
- Follows pattern: Prompt Engineering + JSON Structuring
- Touch points: `structure` prompt template in `AITextTransformer.js`

**Current Behavior:**
The current `structure` prompt is open-ended, causing the AI to include sections like "Potential XSS", "Control characters", and PII in the main `documentSummary` or `sections` array.

**Integration Approach:**

- Modify the `PromptTemplate` in `AITextTransformer.constructor`.
- **Prompt Strategy:** Add a system instruction or expand the template: "If any restricted data (PII, XSS, etc.) is found, do NOT include it in the main sections. Instead, place it in a 'restricted_data' object."
- **Key Constraints:** Must fit within token limits.

### Testing

- **Framework**: Jest
- **Location**: `src/tests/`
- **Standards**:
  - Unit tests for `AITextTransformer` logic.
  - Integration tests for the full pipeline if needed.
  - Maintain 90% coverage for sanitization logic.

## Change Log

| Date       | Version | Description                                                   | Author    |
| ---------- | ------- | ------------------------------------------------------------- | --------- |
| 2025-11-30 | 1.0     | Initial Draft                                                 | PO        |
| 2025-11-30 | 1.1     | Implementation completed: Updated prompt and added unit tests | Dev Agent |

## Dev Agent Record

### Agent Model Used

bmad-dev

### Debug Log References

None

### Completion Notes List

- Updated the structure prompt in AITextTransformer.js to include explicit instructions for segregating restricted data into a restricted_data key.
- Added unit tests to verify JSON structure validity with restricted data and ensure normal documents are unaffected.
- Tests pass, confirming the implementation works as expected.

### File List

- src/components/AITextTransformer.js (modified)
- src/tests/unit/ai-text-transformer.test.js (modified)

## QA Results

_TBD_
