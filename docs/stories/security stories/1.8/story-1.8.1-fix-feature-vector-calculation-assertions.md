# Story 1.8.1: Fix Feature Vector Calculation Assertions

**As a** developer working in a brownfield security environment,
**I want to** fix feature vector calculation assertion failures in TrainingDataCollector,
**so that** training data collection assertions work correctly.

**Business Context:**
Feature vector calculations are critical for AI training data quality. Fixing assertion failures ensures that training data is properly validated and meets quality standards for machine learning models.

**Acceptance Criteria:**

- [ ] Identify specific feature vector calculation assertion failures
- [ ] Analyze the calculation logic and expected vs actual values
- [ ] Fix assertion logic to match correct feature vector calculations
- [ ] Verify fixes don't break other related calculations

**Technical Implementation Details:**

- **Assertion Analysis**: Review failing assertions and expected behavior
- **Code Review**: Examine feature vector calculation implementation
- **Fix Implementation**: Correct assertion conditions or calculation logic
- **Testing**: Validate fixes with various input scenarios

**Dependencies:**

- TrainingDataCollector source code
- Test framework and assertion libraries
- Feature vector calculation specifications

**Priority:** High
**Estimate:** 2-3 hours
**Risk Level:** Medium (logic changes)

**Success Metrics:**

- Feature vector assertions pass
- No regression in calculation accuracy
- Test suite stability improved
