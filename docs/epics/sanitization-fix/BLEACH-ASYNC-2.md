# BLEACH-ASYNC-2: Async Pipeline Integration

## Status

Pending

## Story

**As a** systems architect,
**I want to** integrate comprehensive sanitization into the async pipeline,
**so that** all processing paths include bleach-level cleanup.

## Acceptance Criteria

1. All async job processing includes comprehensive sanitization
2. PDF processing, AI transformation, and direct sanitization covered
3. Concurrent async operations maintain performance
4. Single-pass sanitization prevents duplication

## Tasks / Subtasks

- [ ] Audit all async processing paths in jobWorker.js
- [ ] Ensure bleach sanitization applied to all paths
- [ ] Remove redundant sanitization steps
- [ ] Test concurrent async processing performance
- [ ] Verify single-pass sanitization

## Dev Notes

### Previous Story Insights

Current jobWorker has multiple sanitization points, but they may not be comprehensive. Need to ensure bleach-level sanitization happens once but covers all cases.

### Data Models

All job results should be sanitized before storage/return.

### API Specifications

Async job results should be consistently sanitized.

### Component Specifications

Modify jobWorker.js to use comprehensive sanitization in all processing paths.

### File Locations

- Modified: src/workers/jobWorker.js
- Modified: src/tests/integration/threat-extraction-comprehensive.test.js

### Testing Requirements

- Test all async processing paths
- Verify concurrent processing works
- Performance testing for async sanitization

### Technical Constraints

- Maintain async job queue functionality
- Ensure single sanitization pass per job
- Don't break existing async workflows

## Testing

- Integration tests for all async paths
- Performance tests for concurrent processing
- End-to-end tests for job sanitization
- Load testing for async sanitization

## Change Log

| Date       | Version | Description                              | Author |
| ---------- | ------- | ---------------------------------------- | ------ |
| 2025-12-05 | 1.0     | Created from BLEACH-ASYNC epic breakdown | SM     |
