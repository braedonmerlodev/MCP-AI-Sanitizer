# Epic: Agent Message Integration for Sanitization Summary

## Status

Draft

## Epic Overview

**Problem**: Sanitization summaries are implemented but not rendering as agent messages in the chat interface. The current implementation sends summaries as response fields or WebSocket chunks, but users expect them to appear seamlessly as agent messages.

**Solution**: Implement a comprehensive agent message system that allows sanitization summaries to be delivered as proper agent messages with correct ordering, styling, and persistence.

**Business Value**: Provides users with immediate, contextual security information about content sanitization directly within their chat experience, improving security awareness and response times.

## Epic Goals

- Sanitization summaries appear as seamless agent messages in chat
- Proper message ordering and persistence
- Support for both HTTP and WebSocket delivery
- Extensible architecture for future agent message types
- Comprehensive testing and documentation

## Success Criteria

- Users see sanitization alerts as natural agent messages
- No disruption to existing chat functionality
- Message ordering maintains conversation flow
- Performance impact remains <5% overhead
- All acceptance criteria from child stories met

## Dependencies

- Story: Sanitization Summary in HITL Chat (provides sanitization logic)
- Agent Chat Interface: ChatInterface.tsx component
- Backend API: JavaScript/Node.js implementation

## Child Stories

### Story 1: Agent Message System Architecture Analysis

**Status**: Ready

**Description**: Analyze and document the current agent message system architecture in the JavaScript backend.

**Acceptance Criteria**:

- Document existing message routing patterns
- Identify WebSocket endpoint capabilities
- Assess agent message system completeness
- Provide architectural recommendations

**Tasks**:

- [ ] Review JavaScript backend message handling
- [ ] Document WebSocket implementation status
- [ ] Analyze message routing architecture
- [ ] Create architectural assessment report

### Story 2: Agent Message Format Design

**Status**: Pending

**Description**: Design the message format and routing system for agent-sent sanitization summaries.

**Acceptance Criteria**:

- Defined message structure for sanitization summaries
- Message type identification system
- Routing logic for agent messages
- Integration with existing chat protocols

**Tasks**:

- [ ] Design agent message schema
- [ ] Define message type constants
- [ ] Create routing logic specification
- [ ] Document integration points

### Story 3: Backend Agent Message Implementation

**Status**: Pending

**Description**: Implement backend support for sending agent messages, including any required WebSocket endpoints.

**Acceptance Criteria**:

- Backend can send agent messages via WebSocket
- Message routing system functional
- Integration with existing chat endpoints
- Error handling for message delivery failures

**Tasks**:

- [ ] Implement WebSocket agent message endpoints
- [ ] Add message routing logic
- [ ] Integrate with HTTP chat responses
- [ ] Add error handling and logging

### Story 4: Frontend Agent Message Display

**Status**: Pending

**Description**: Update frontend components to properly display and handle agent-sent messages.

**Acceptance Criteria**:

- MessageBubble component supports agent message types
- Proper styling for sanitization summary messages
- Message ordering and persistence
- Integration with useChat hook

**Tasks**:

- [ ] Update MessageBubble component
- [ ] Modify useChat hook for agent messages
- [ ] Implement message ordering logic
- [ ] Add message persistence handling

### Story 5: Agent Message Integration Testing

**Status**: Pending

**Description**: Comprehensive testing of the agent message system and sanitization summary integration.

**Acceptance Criteria**:

- Unit tests for message routing and display
- Integration tests for end-to-end message flow
- WebSocket and HTTP testing
- Performance and security validation

**Tasks**:

- [ ] Create unit tests for message components
- [ ] Implement integration tests
- [ ] Test WebSocket message delivery
- [ ] Validate performance metrics

## Risk Assessment

### High Risk

- **Agent System Architecture Unknown**: May require significant backend restructuring
- **WebSocket Implementation Gap**: Could require new endpoint development
- **Message Ordering Complexity**: Ensuring proper conversation flow

### Mitigation Strategies

- Start with Story 1 (Architecture Analysis) to understand scope
- Implement incrementally with frequent testing
- Maintain backward compatibility throughout
- Have rollback plan for each story

## Effort Estimation

- **Story 1**: 2-3 days (Architecture analysis)
- **Story 2**: 1-2 days (Design work)
- **Story 3**: 3-5 days (Backend implementation)
- **Story 4**: 2-3 days (Frontend updates)
- **Story 5**: 2-3 days (Testing and validation)

**Total Estimate**: 10-16 days

## Definition of Done

- [ ] All child stories completed and tested
- [ ] Sanitization summaries appear as agent messages
- [ ] Message ordering and persistence working
- [ ] WebSocket and HTTP support verified
- [ ] Performance requirements met (<5% overhead)
- [ ] Documentation updated
- [ ] Security review completed

## Change Log

| Date       | Version | Description                                         | Author |
| ---------- | ------- | --------------------------------------------------- | ------ | ---------- |
| 2025-12-04 | v1.0    | Initial epic creation for agent message integration | PO     | </content> |

<parameter name="filePath">docs/epics/agent-message-integration-epic.md
