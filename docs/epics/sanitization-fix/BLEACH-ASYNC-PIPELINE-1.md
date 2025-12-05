# BLEACH-ASYNC-PIPELINE-1: Pipeline Reordering Implementation

## Status

Pending

## Story

**As a** backend developer,
**I want to** reorder the PDF processing pipeline,
**so that** bleach sanitization occurs before AI transformation.

## Acceptance Criteria

1. PDF processing pipeline reordered: Text → Markdown → Sanitization → AI → Cleanup
2. AI transformation receives bleach-sanitized input
3. Pipeline maintains async performance
4. Backward compatibility preserved

## Tasks / Subtasks

- [ ] Analyze current jobWorker.js pipeline order
- [ ] Move sanitization before AI transformation
- [ ] Update progress tracking for new order
- [ ] Test pipeline reordering with existing functionality
- [ ] Verify async performance maintained

## Dev Notes

### Previous Story Insights

Current order: PDF → Text → Markdown → AI → Sanitize
Required order: PDF → Text → Markdown → Sanitize → AI → Cleanup

This reordering prevents AI from processing malicious content and eliminates sanitization metadata generation.

### Data Models

Job processing flow changes but data structures remain compatible.

### API Specifications

No external API changes - internal processing reordering only.

### Component Specifications

Modify src/workers/jobWorker.js to reorder processing steps.

### File Locations

- Modified: src/workers/jobWorker.js
- Modified: src/tests/integration/threat-extraction-comprehensive.test.js

### Testing Requirements

- Test reordered pipeline with various job types
- Verify AI receives clean input
- Performance testing for reordered pipeline

### Technical Constraints

- Must maintain all existing functionality
- Cannot break async job processing
- Progress updates must reflect new order

## Testing

- Unit tests for reordered jobWorker pipeline
- Integration tests for end-to-end processing
- Performance tests comparing old vs new order
- Regression tests for existing features

## Change Log

| Date       | Version | Description                                       | Author |
| ---------- | ------- | ------------------------------------------------- | ------ |
| 2025-12-05 | 1.0     | Created from BLEACH-ASYNC-PIPELINE epic breakdown | SM     |
