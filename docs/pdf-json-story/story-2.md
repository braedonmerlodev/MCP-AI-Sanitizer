# Story-2: Implement Restricted Data Segregation

## Status

Ready for Development

## Story

**As a** Security Compliance Officer,  
**I want** restricted data (PII, malicious patterns, control characters) identified during AI text transformation to be segregated into a restricted section,  
**so that** downstream agents and summaries do not contain sensitive or dangerous information.

## Acceptance Criteria

1. Identify and segregate PII (emails, phones, SSNs), malicious patterns (XSS, SQLi), control/invisible characters, and problematic sections into a `restricted_data` key.
2. Ensure main `summary` and `content` fields are clean; `restricted_data` is clearly marked.
3. Maintain valid JSON structure.
4. Test with problematic content (e.g., "Test PDF").
5. No regression in normal document summarization.

## Tasks / Subtasks

- [ ] Modify `structure` prompt in `AITextTransformer.js` to segregate restricted data.
- [ ] Add unit tests for segregation logic and JSON validity.
- [ ] Verify with test cases containing restricted data.

## Dev Notes

- Integrates with AI text transformation pipeline.
- Uses prompt engineering to instruct AI on segregation.
- Security-focused: Prevents exposure of sensitive data.

## Dependencies

- Story-1 (provides threat detection and non-restricted data preservation)

## Change Log

| Date       | Version | Description                             | Author       |
| ---------- | ------- | --------------------------------------- | ------------ |
| 2025-12-01 | 1.0     | Created from master story decomposition | AI Assistant |
