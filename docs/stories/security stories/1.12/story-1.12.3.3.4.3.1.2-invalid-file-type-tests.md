# Story 1.12.3.3.4.3.1.2: Invalid File Type Handling Tests for Document Upload

## Status

Ready for Review

## Story

**As a** QA lead working in a brownfield security hardening environment,
**I want** unit tests for invalid file type handling in the document upload endpoint,
**so that** API routes coverage increases by covering previously uncovered validation failures.

## Acceptance Criteria

**Functional Requirements:**

1. At least 2 unit tests added for invalid file type handling in /api/documents/upload
2. Tests cover file type validation errors (e.g., unsupported MIME types)
3. Tests verify proper error responses (e.g., 400 Bad Request with appropriate error messages)
4. Tests include mocking of file type validation logic

**Integration Requirements:** 5. New tests integrate with existing test suite without conflicts 6. Tests pass in CI/CD pipeline 7. No regression in existing functionality verified

## Tasks / Subtasks

- [x] Write unit test for invalid file type (e.g., executable files, unsupported formats)
- [x] Write unit test for missing or malformed file type metadata
- [x] Mock file type validation to simulate rejection
- [x] Verify error response format and status codes
- [x] Run tests to ensure they pass

## Dev Notes

This substory focuses specifically on invalid file type handling in the document upload endpoint. Ensure tests cover various invalid file types that should be rejected.

### Testing

- Use Jest mocking for file type validation
- Target validation failure paths in the document upload route
- Ensure tests are isolated and cover edge cases

## Change Log

| Date       | Version | Description                                  | Author               |
| ---------- | ------- | -------------------------------------------- | -------------------- |
| 2025-11-22 | 1.0     | Initial substory creation                    | Product Owner        |
| 2025-11-22 | 1.1     | Implemented invalid file type handling tests | Full Stack Developer |

## File List

- Modified: src/tests/unit/api.test.js (added unit tests for invalid file type handling)

## Dev Agent Record

### Agent Model Used

bmad-dev (James) - Full Stack Developer

### Debug Log References

- Implemented invalid file type handling tests with mocking

### Completion Notes

- Added 3 new unit tests for invalid file type handling in src/tests/unit/api.test.js
- Tests cover executable files, malformed MIME types, and mocked validation rejection
- All tests pass and verify proper 400 error responses with appropriate messages
- No regressions introduced, existing tests continue to pass
