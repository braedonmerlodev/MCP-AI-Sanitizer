# Story 1.7.3: API Key Validation Fixes

## Status

Draft

## Story

**As a** developer working in a brownfield security environment,
**I want** implement proper API key validation fixes in AI config,
**so that** AI services work securely across all deployment environments.

## Acceptance Criteria

1. Fix "OPENAI_API_KEY environment variable must be set" validation error in tests
2. Implement proper API key validation in AI config initialization
3. Add comprehensive API key testing with various validation scenarios
4. Verify API key validation works across different deployment environments
5. Ensure API key validation doesn't interfere with existing AI service operations

## Tasks / Subtasks

- [ ] Enhance aiConfig.js validation logic
  - [ ] Add format validation (check for valid OpenAI API key patterns: sk- prefix)
  - [ ] Implement length checks (51 characters for OpenAI secret keys)
  - [ ] Add environment-specific validation rules
- [ ] Refactor AI service integrations
  - [ ] Modify AITextTransformer to import and use aiConfig instead of direct env access
  - [ ] Ensure all AI components use validated config consistently
  - [ ] Update any other components accessing OPENAI_API_KEY directly
- [ ] Expand test suite comprehensively
  - [ ] Add tests for invalid formats, edge cases, and special characters
  - [ ] Implement environment-specific test scenarios
  - [ ] Add integration tests for AI service initialization with validation
- [ ] Implement environment differentiation
  - [ ] Add NODE_ENV checks for different validation strictness
  - [ ] Allow more lenient validation in development/local environments
  - [ ] Enforce strict validation in production
- [ ] Verify backward compatibility
  - [ ] Ensure existing AI functionality continues working
  - [ ] Test all AI service integrations (text transformation, JSON processing, PDF enhancement)
  - [ ] Validate no performance regressions

## Dev Notes

### Relevant Source Tree

- AI configuration: `src/config/aiConfig.js`
- AI service components: `src/components/AITextTransformer.js`
- AI tests: `src/tests/unit/ai-config.test.js`, `src/tests/integration/pdf-ai-workflow.test.js`
- Job worker integration: `src/workers/jobWorker.js`

### Technical Context from Architecture

**Tech Stack (docs/architecture/tech-stack.md):**

- Language: Node.js 20.11.0
- AI Integration: Langchain with OpenAI API
- Testing: Jest 29.7.0 for unit and integration tests
- Environment: Environment variables for secrets (.env for development, Azure Key Vault for production)

**Security Requirements (docs/architecture/security.md):**

- Secrets Management: Access via configuration service only, never hardcode
- API Key Validation: Required for AI service security
- Environment Variables: Used for development, Key Vault for production
- Code Requirements: No secrets in logs or error messages

**Testing Standards (docs/architecture/test-strategy-and-standards.md):**

- Unit Tests: Jest framework, alongside source files in `src/tests/`
- Integration Tests: End-to-end pipeline with mocked LLMs in `tests/integration/`
- Coverage Goals: 80% overall, focus on critical sanitization functions
- Test Location: `src/tests/unit/` for unit, `tests/integration/` for integration

### Previous Story Context

This is a sub-story of Epic 1.7 "AI Config API Key Validation". The parent story focuses on fixing test failures, while this sub-story implements the actual validation fixes. Builds on existing AI infrastructure established in earlier stories (PDF AI enhancement, etc.).

### Implementation Notes

- Current aiConfig.js has basic presence check; needs enhancement for format and length validation
- AITextTransformer directly accesses process.env.OPENAI_API_KEY; needs refactoring to use validated config
- OpenAI API keys follow specific format: sk- followed by 48 alphanumeric characters (total 51 chars)
- Environment differentiation needed: strict validation in production, lenient in development
- Backward compatibility critical: existing AI workflows must continue functioning

#### Testing

- Test file location: `src/tests/unit/ai-config.test.js` (extend existing)
- Test standards: AAA pattern (Arrange, Act, Assert), mock external dependencies
- Testing frameworks: Jest with Sinon for mocks
- Specific testing requirements: Cover format validation, length checks, environment scenarios
- Integration testing: Verify AI service initialization with validation in `tests/integration/`

## Change Log

| Date       | Version | Description   | Author   |
| ---------- | ------- | ------------- | -------- |
| 2025-11-20 | 1.0     | Initial draft | PM Agent |

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

TBD

### Completion Notes List

TBD

### File List

TBD

## QA Results

TBD

## Validation Recommendations

1. Rewrite story following story-tmpl.yaml template
2. Add Dev Notes section with information from tech-stack.md, security.md, and test-strategy.md
3. Verify and correct technical claims (API key formats, lengths)
4. Align acceptance criteria with epic requirements or clearly establish as sub-story
5. Add proper references to architecture documents
6. Include Tasks/Subtasks section with actionable implementation steps
