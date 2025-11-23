# Epic 3: Red-Flagging and Error Recovery

Integrate MAKER red-flagging into BMAD risk profiles for automatic error detection and recovery.

## Story 3.1: Risk Profile Red-Flagging

As a developer, I want to extend BMAD risk profiles with MAKER red-flagging, so that errors are automatically detected.

**Acceptance Criteria**

1. Modify risk-profile.md to include red-flag criteria
2. Implement automatic error detection in risk assessments
3. Flag formatting errors and inconsistencies
4. Generate red-flag reports

## Story 3.2: BMAD Orchestrator Fallbacks

As a developer, I want the BMAD orchestrator to handle red-flagged failures, so that tasks recover automatically.

**Acceptance Criteria**

1. Configure bmad-orchestrator for fallback logic
2. Implement automatic retry on red-flags
3. Maintain task state during recovery
4. Log fallback actions in story files

## Story 3.3: Red-Flag Analytics in QA

As a developer, I want red-flag data integrated into QA reports, so that error patterns are tracked.

**Acceptance Criteria**

1. Include red-flag metrics in qa-gate files
2. Track error frequency per agent
3. Generate red-flag analytics reports
4. Use analytics to improve agent reliability
