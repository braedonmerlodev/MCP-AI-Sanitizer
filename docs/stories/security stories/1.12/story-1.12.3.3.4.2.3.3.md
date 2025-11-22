# Story 1.12.3.3.4.2.3.3: JobStatusController Status Update Tests

## Status

Approved

## Story

**As a** QA engineer working in a brownfield security hardening environment,
**I want to** write unit tests for job status retrieval and display scenarios,
**so that** status display operations are validated and coverage improves for these critical paths.

## Acceptance Criteria

**Functional Requirements:**

1. At least 3 unit tests added for job status retrieval scenarios
2. Tests cover normal status progression (queued → processing → completed)
3. Tests validate status display logic and message generation
4. Previously uncovered lines in status message generation are now tested

**Integration Requirements:** 5. New tests integrate with existing JobStatusController test suite 6. Tests follow existing Jest patterns and mocking strategies 7. No conflicts with existing job status operations

**Quality Requirements:** 8. All new tests pass in CI/CD pipeline 9. Tests include proper assertions for status changes 10. Code coverage increases for status update functionality

## Tasks / Subtasks

- [ ] Write test for queued status message generation
  - [ ] Test basic "Queued for processing..." message
  - [ ] Verify response includes correct status and metadata
- [ ] Write test for processing status message generation
  - [ ] Test message with currentStep populated
  - [ ] Test message without currentStep (fallback)
  - [ ] Verify progress and estimated completion time
- [ ] Write test for completed status message generation
  - [ ] Test "Completed successfully" message
  - [ ] Verify result inclusion in response
  - [ ] Test completedAt timestamp
- [ ] Ensure tests mock dependencies appropriately
  - [ ] Mock JobStatus.load() for different states
  - [ ] Mock jobStatus.isExpired() scenarios
  - [ ] Use existing Jest/supertest patterns
- [ ] Verify tests integrate with existing test suite
  - [ ] Run tests in src/tests/unit/jobStatusApi.test.js context
  - [ ] Ensure no conflicts with existing tests
  - [ ] Verify coverage improvements

## Dev Notes

Focus on status message generation in JobStatusController.getStatus() method. Target file: `src/controllers/jobStatusController.js`.

### Testing

- Use Jest with supertest for API endpoint testing
- Follow patterns from existing `src/tests/unit/jobStatusApi.test.js`
- Mock JobStatus model using existing mocking strategies
- Test happy path and edge cases in message generation
- Ensure tests are isolated and repeatable

### Dependencies and Risks

- Depends on detailed identification from substory 1.12.3.3.4.2.3.2 (uncovered lines report)
- Low risk for unit tests, monitor for mocking issues
- Brownfield context: Tests validate existing status display behavior

### Business Context

Status message generation is critical for user experience and debugging. Testing ensures consistent, accurate status reporting across all job states.

## Change Log

| Date       | Version | Description                                                   | Author        |
| ---------- | ------- | ------------------------------------------------------------- | ------------- |
| 2025-11-22 | 1.0     | Initial substory creation                                     | Product Owner |
| 2025-11-22 | 1.1     | Updated per PO review - clarified scope and fixed state names | Product Owner |

## Dev Agent Record

_To be populated by development agent during implementation_

### Agent Model Used

bmad-dev (James) - Full Stack Developer

### Debug Log References

_Reference any debug logs or traces generated_

### Completion Notes List

- _To be populated_

### File List

- _To be populated_

## QA Results

_Results from QA Agent QA review of the completed story implementation_
