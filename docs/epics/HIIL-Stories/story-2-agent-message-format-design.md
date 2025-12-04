# Story: Agent Message Format Design

## Status

Pending

## Story

**As a** developer implementing agent message integration,
**I want to** design comprehensive message formats and routing for agent-generated content (sanitization summaries, security alerts, processing status),
**so that** agent messages can be properly delivered through existing chat infrastructure with appropriate handling and user experience.

## Acceptance Criteria

1. **Agent Message Schema**: Complete type system for sanitization summaries, security alerts, and processing status messages
2. **Message Metadata Design**: Priority levels, TTL, delivery guarantees, and source identification
3. **Routing Logic Specification**: Agent message routing vs user message routing with priority handling
4. **Frontend Integration**: UI treatment for different agent message types (banners, alerts, status updates)
5. **Backward Compatibility**: Migration strategy maintaining existing message format compatibility
6. **Performance Impact**: <5% overhead with message size limits and frequency controls

## Dependencies

- **Story 1: Agent Message System Architecture Analysis (MUST BE COMPLETED FIRST)** - provides foundation analysis and architectural context
- Existing chat message formats and protocols
- Agent message integration points identified in Story 1

## Tasks / Subtasks

- [ ] Analyze existing message formats and agent message integration points
- [ ] Design agent message type system (sanitization, security, status, error)
- [ ] Create message schema with metadata support (priority, TTL, routing)
- [ ] Define routing logic for agent messages (priority queues, delivery guarantees)
- [ ] Specify frontend handling for different agent message types
- [ ] Document backward compatibility and migration strategy
- [ ] Create comprehensive message format specification

## Dev Notes

### Relevant Source Tree Info

- **Existing Messages**: Review current message structures in useChat hook, MessageBubble, and chatSlice
- **Chat Protocols**: Examine HTTP /api/chat and WebSocket message handling in backend/api.py
- **Message Types**: Document existing message type patterns and WebSocket message schemas
- **Agent Integration**: Review sanitization summary handling in frontend and backend

### Technical Constraints

- Must work with existing WebSocket and HTTP chat implementations
- Message format should be extensible for future agent message types
- Maintain performance requirements (<5% overhead)
- Ensure proper message ordering and sequencing
- Message size limits and frequency controls for agent messages
- Agent message priority handling without disrupting user chat flow

### Security Considerations

- Message format should not allow injection attacks
- Agent messages should be properly validated and authenticated
- Sensitive data should not be exposed in message metadata
- Agent message source verification and integrity checks
- Rate limiting for agent message generation to prevent abuse

## Testing

### Testing Strategy

- **Design Review**: Validate message schema against requirements and Story 1 findings
- **Integration Testing**: Test message format compatibility with existing chat system
- **Performance Testing**: Verify overhead remains within limits (<5%)
- **Security Testing**: Validate agent message authentication and validation
- **Backward Compatibility Testing**: Ensure existing messages still work

## Dev Agent Record

| Date | Agent | Task                                    | Status  | Notes                                                               |
| ---- | ----- | --------------------------------------- | ------- | ------------------------------------------------------------------- |
| TBD  | TBD   | Analyze existing message formats        | Pending | Review current chat message structures and agent integration points |
| TBD  | TBD   | Design agent message type system        | Pending | Define sanitization, security, status, and error message types      |
| TBD  | TBD   | Create message schema with metadata     | Pending | Design priority, TTL, routing, and source identification            |
| TBD  | TBD   | Define routing logic for agent messages | Pending | Specify priority queues and delivery guarantees                     |
| TBD  | TBD   | Specify frontend handling               | Pending | Define UI treatment for different agent message types               |
| TBD  | TBD   | Document backward compatibility         | Pending | Create migration strategy for existing messages                     |
| TBD  | TBD   | Create comprehensive specification      | Pending | Document complete message format system                             |

## Priority Assessment

**HIGH PRIORITY**: Update story to include specific agent message types and integration requirements. The current generic approach won't support the complex agent message ecosystem needed.

**RECOMMENDATION**: Transform this from a generic "message format" story to a specific "agent message ecosystem" design that addresses the unique requirements of agent-generated content.

## QA Results

| Date | QA Agent | Test Type     | Status  | Issues Found | Resolution |
| ---- | -------- | ------------- | ------- | ------------ | ---------- |
| TBD  | TBD      | Design review | Pending | TBD          | TBD        |

## Change Log

| Date       | Version | Description                                                                                                            | Author    |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------- | --------- |
| 2025-12-04 | v1.1    | Major revision: Enhanced to include specific agent message types, comprehensive schema design, and priority assessment | Dev Agent |
| 2025-12-04 | v1.0    | Initial story creation for message format design                                                                       | PO        |

<parameter name="filePath">docs/stories/story-2-agent-message-format-design.md
