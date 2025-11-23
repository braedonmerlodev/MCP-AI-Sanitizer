# Asynchronous Sanitization APIs - Brownfield Enhancement

## Epic Goal

Enable asynchronous processing of sanitization tasks to handle long-running operations like PDF sanitization and generation without timeouts, improving reliability, scalability, and user experience for agentic orchestration while maintaining full operability for the autonomous security agent.

## Epic Description

**Existing System Context:**

- Current relevant functionality: Synchronous API endpoints for the sanitization pipeline, including PDF processing and generation operations that can take significant time; autonomous security agent operates as in-line proxy requiring real-time synchronous sanitization
- Technology stack: Node.js backend with Express/FastAPI, cloud deployment with containerization
- Integration points: n8n workflows, MCP server integrations, LLM interactions, existing sanitization pipeline components, agent proxy operations

**Enhancement Details:**

- What's being added/changed: Convert specific sanitization endpoints to asynchronous operations that return task IDs immediately for long-running tasks, add job queue system for background processing, implement status checking endpoints, enable progress tracking, and ensure agent compatibility through synchronous modes
- How it integrates: Modify existing API routes to submit jobs to a queue system (e.g., Redis/Bull) for async processing, add new status endpoints, integrate with existing sanitization pipeline, implement sync modes for agent proxy use without disrupting current synchronous flows
- Success criteria: APIs return task IDs within 100ms for async, status endpoints provide real-time progress, long-running tasks complete without timeouts, retry logic implemented, no performance degradation for short tasks, agent maintains synchronous proxy behavior

## Stories

1. **Story 1: Implement Job Queue Infrastructure** - Set up background job processing system with queue management, worker processes, and job persistence for handling asynchronous sanitization tasks.

2. **Story 2: Convert Sanitization Endpoints to Asynchronous** - Modify specific sanitization API endpoints (PDF processing, sanitization) to submit jobs asynchronously and return task IDs immediately, while preserving synchronous behavior for agent requests.

3. **Story 3: Add Task Status and Progress Tracking** - Implement status checking and result retrieval endpoints for async jobs.

4. **Story 4: Ensure Agent Compatibility with Sync Modes** - Implement synchronous processing modes for agent proxy operations, ensuring real-time sanitization without polling or delays.

## Compatibility Requirements

- [ ] Existing synchronous APIs remain unchanged and functional for all non-async use cases
- [ ] Database schema changes are backward compatible
- [ ] No changes to existing n8n integration patterns
- [ ] Performance impact is minimal for non-async operations
- [ ] Agent proxy operations maintain synchronous behavior and real-time performance (<100ms response times)
- [ ] Trust token validation and access control remain synchronous for agent use

## Risk Mitigation

- **Primary Risk:** Disruption to autonomous security agent proxy behavior and existing synchronous workflows during transition
- **Mitigation:** Implement async endpoints alongside existing sync ones with agent-specific sync modes, thorough testing of both paths and agent proxy flows
- **Rollback Plan:** Disable async endpoints and revert to fully synchronous processing for all sanitization endpoints if agent functionality or existing workflows degrade

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] Existing synchronous functionality verified through comprehensive testing
- [ ] Integration points with n8n and MCP servers working correctly
- [ ] Agent proxy behavior validated with no polling delays or timeouts
- [ ] Documentation updated with new async API usage patterns and sync mode specifications
- [ ] No regression in existing sanitization pipeline performance or agent operations
- [ ] Async operations handle timeouts and provide progress tracking as specified</content>
      <parameter name="filePath">docs/prd/epic-13-asynchronous-sanitization-apis.md
