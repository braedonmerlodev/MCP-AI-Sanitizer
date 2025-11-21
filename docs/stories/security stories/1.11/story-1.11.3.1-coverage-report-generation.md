# Story 1.11.3.1: Generate Comprehensive Coverage Report

**As a** QA engineer working in a brownfield security hardening environment,
**I want to** generate a comprehensive coverage report identifying all uncovered code paths,
**so that** test coverage gaps are clearly identified for local development scenarios.

**Business Context:**
Before implementing new tests, a detailed analysis of current coverage is needed to identify gaps. This brownfield planning must focus on local testing scenarios and prioritize improvements that support agent development with local models.

**Acceptance Criteria:**

- [x] Run coverage analysis tools on the current codebase
- [x] Generate detailed coverage report showing line, branch, and function coverage
- [x] Identify all uncovered code paths and modules
- [x] Document coverage metrics for core functionality
- [x] Export coverage report in readable format for review

**Coverage Analysis Results:**

**Overall Coverage Metrics:**

- Statements: 72.31% (1740/2406)
- Branches: 65.21% (1125/1725)
- Functions: 68.7% (259/377)
- Lines: 73.11% (1708/2336)

**Core Functionality Coverage:**

- Sanitization Pipeline: 100% (critical security component fully covered)
- Middleware: 100% (request processing fully covered)
- Config: 88.23% (configuration loading well covered)
- Controllers: 86.44% (API controllers well covered)
- Components (general): 84.92% (core components well covered)

**Identified Coverage Gaps (Uncovered Code Paths and Modules):**

- **utils/queueManager.js**: 30.76% statements, 0% branches/functions - Queue management for async processing largely untested
- **workers/jobWorker.js**: 10% statements, 0% branches/functions - Background job processing completely untested
- **models/**: 64.13% overall - Data models have significant gaps, especially in error handling and edge cases
- **routes/**: 69.5% overall - API routing has uncovered paths, particularly error scenarios
- **schemas/**: 57.14% overall - Validation schemas under-tested
- **components/data-integrity/**: 66.73% overall - Audit and integrity features have gaps

**Reports Exported:**

- HTML Report: coverage/index.html (readable web interface)
- LCOV Report: coverage/lcov-report/ (detailed HTML breakdown)
- JSON Data: coverage/coverage-final.json (machine-readable)
- LCOV Info: coverage/lcov.info (CI/CD compatible)

**File List:**

- coverage/index.html (main coverage report)
- coverage/lcov-report/index.html (detailed LCOV report)
- coverage/coverage-final.json (coverage data)
- coverage/lcov.info (LCOV format)
- coverage/ (directory with all report files)

**Technical Notes:**

- Use existing coverage tools (e.g., nyc, istanbul)
- Focus analysis on local model integration paths
- Include both unit and integration test coverage
- Generate HTML and JSON reports

**Priority:** High
**Estimate:** 1 hour
