# PRE-AI-SANITIZE-2: Node.js Pipeline Simplification

## Status

Pending

## Story

**As a** Node.js developer,
**I want to** simplify threat extraction,
**so that** cleanup focuses on AI-generated content rather than input sanitization.

## Acceptance Criteria

1. Node.js threat extraction handles only AI response cleanup
2. Input sanitization responsibility moved to Python
3. Reduced complexity in extractAndRemoveThreats function
4. Maintained security guarantees

## Tasks / Subtasks

- [ ] Analyze current extractAndRemoveThreats usage
- [ ] Remove input sanitization logic from Node.js
- [ ] Simplify threat extraction to focus on AI responses
- [ ] Update tests for simplified pipeline
- [ ] Verify security guarantees maintained

## Dev Notes

### Previous Story Insights

Currently Node.js does both input sanitization and AI response cleanup. With Python handling input sanitization, Node.js can focus solely on cleaning up any threats that might appear in AI-generated responses.

### Data Models

Threat extraction should focus on AI-generated malicious patterns, not input sanitization artifacts.

### API Specifications

No external API changes - internal pipeline simplification.

### Component Specifications

Modify extractAndRemoveThreats in jobWorker.js to be more targeted.

### File Locations

- Modified: src/workers/jobWorker.js
- Modified: src/tests/unit/jobWorker.sanitizationTests.test.js
- Modified: src/tests/integration/threat-extraction-comprehensive.test.js

### Testing Requirements

- Tests for AI response threat extraction
- Regression tests ensuring no security degradation
- Performance tests for simplified pipeline

### Technical Constraints

- Must maintain all current security guarantees
- Cannot introduce new vulnerabilities
- Should improve performance by removing redundant sanitization

## Testing

- Unit tests for simplified threat extraction
- Integration tests for AI response processing
- Security regression tests
- Performance comparison tests

## Change Log

| Date       | Version | Description                                 | Author |
| ---------- | ------- | ------------------------------------------- | ------ |
| 2025-12-05 | 1.0     | Created from PRE-AI-SANITIZE epic breakdown | SM     |
