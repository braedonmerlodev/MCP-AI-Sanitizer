# BLEACH-ASYNC-PIPELINE-3.1: Update Unit Tests for Reordered Pipeline

## Status

In Progress

## Story

**As a** QA engineer,
**I want to** update jobWorker unit tests to match the new result structure,
**so that** tests pass with the reordered sanitization pipeline.

## Acceptance Criteria

1. All jobWorker unit tests pass with new result structure _[8/9 currently failing]_
2. Test expectations updated for reordered processing steps _[Job types corrected, progress updated]_
3. Progress tracking assertions corrected for new pipeline order _[AI progress updated to 70%]_
4. Backward compatibility maintained where possible _[Confirmed]_

## Tasks / Subtasks

- [x] Analyze current test failures in jobWorker.test.js
- [x] Identify job type mismatches (upload-pdf → pdf_processing)
- [x] Update progress percentage assertions (55% → 70% for AI transformation)
- [x] Diagnose result structure issues (result undefined in tests)
- [ ] Update test expectations for result.sanitizedData vs result.sanitizedContent
- [ ] Fix mock objects to match new pipeline flow
- [ ] Verify all test scenarios work with reordered pipeline
- [ ] Add regression tests for pipeline reordering

## Dev Notes

### Previous Story Insights

The pipeline reordering changed the result structure and processing order. Tests were written for the old order (AI → Sanitization) and need updates for the new order (Sanitization → AI).

**Analysis Complete**: Issues identified and fix patterns established. Job types corrected, progress assertions updated. Result structure issues diagnosed - tests failing due to result being undefined, likely rewire/mock setup issues.

**Implementation Challenges Identified**:

- Rewire mocking may not be returning results correctly
- Result formatting logic may have issues with default path
- Mock cleanup missing (no afterEach)
- Complex interdependencies between mocks

### Data Models

Result structure: sanitizedData is now available immediately after sanitization, before AI processing.

### API Specifications

Test mocks need to reflect the new processing order and result availability.

### Component Specifications

jobWorker.js now sanitizes first, then applies AI transformation.

### File Locations

- Modified: src/tests/unit/jobWorker.test.js
- Modified: src/tests/unit/jobWorker.sanitizationTests.test.js

### Testing Requirements

- Unit test coverage for reordered pipeline
- Mock validation for new processing order
- Result structure validation

### Technical Constraints

- Must maintain test coverage levels
- Cannot break existing test infrastructure
- Need to support both pipeline orders during transition

## Testing

- Unit tests for reordered pipeline result structure
- Mock validation tests
- Progress tracking verification tests

## Change Log

| Date       | Version | Description                                    | Author |
| ---------- | ------- | ---------------------------------------------- | ------ |
| 2025-12-05 | 1.0     | Created from BLEACH-ASYNC-PIPELINE-3 breakdown | SM     |
