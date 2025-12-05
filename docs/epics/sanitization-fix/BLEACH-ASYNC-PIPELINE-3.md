# BLEACH-ASYNC-PIPELINE-3: Post-Reordering Validation & Enhancement

## Status

Pending

## Story

**As a** QA engineer,
**I want to** validate the reordered pipeline and prepare for enhanced sanitization,
**so that** the system operates securely with improved threat removal.

## Acceptance Criteria

1. Unit tests updated to match new result structure from reordered pipeline
2. AI input sanitization verified in production environment
3. Metadata leakage monitoring implemented
4. Bleach-equivalent sanitization enhancement planned

## Tasks / Subtasks

- [ ] Update jobWorker unit tests for new result structure (sanitizedData vs sanitizedContent)
- [ ] Fix test expectations for reordered processing steps and progress tracking
- [ ] Add integration tests to verify AI receives sanitized input
- [ ] Implement monitoring for sanitization metadata leakage reduction
- [ ] Research and plan bleach-equivalent Node.js sanitization implementation
- [ ] Create performance benchmarks for reordered pipeline

## Dev Notes

### Previous Story Insights

Pipeline reordering is complete but tests and monitoring need updates. The reordered pipeline (Sanitization → AI) provides immediate security benefits but needs validation and enhancement planning.

### Data Models

Result structure changed: sanitizedData is now set earlier in the process, affecting how tests and API consumers access results.

### API Specifications

API responses remain compatible - internal result structure changes don't affect external interfaces.

### Component Specifications

jobWorker.js result handling updated for earlier sanitization. Tests need corresponding updates.

### File Locations

- Modified: src/tests/unit/jobWorker.test.js (update expectations)
- Modified: src/tests/integration/threat-extraction-comprehensive.test.js
- New: src/utils/sanitization-monitor.js (for metadata leakage tracking)
- Modified: docs/epics/sanitization-fix/ (bleach enhancement planning)

### Testing Requirements

- Unit tests for reordered pipeline result structure
- Integration tests for AI input sanitization
- Performance tests comparing old vs new pipeline order
- Security tests for metadata leakage reduction

### Technical Constraints

- Must maintain backward compatibility for API consumers
- Cannot break existing async job processing
- Need to support both old and new result formats during transition

## Testing

- Unit tests for updated result structure expectations
- Integration tests for end-to-end reordered pipeline
- Security tests for AI input sanitization verification
- Performance tests for reordered pipeline efficiency

## Change Log

| Date       | Version | Description                                       | Author |
| ---------- | ------- | ------------------------------------------------- | ------ |
| 2025-12-05 | 1.0     | Created from BLEACH-ASYNC-PIPELINE epic breakdown | SM     |
