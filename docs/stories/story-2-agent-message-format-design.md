# Story: Agent Message Format Design

## Status

Pending

## Story

**As a** developer implementing agent message integration,
**I want to** design the message format and routing system for agent-sent sanitization summaries,
**so that** sanitization alerts can be delivered as proper agent messages with consistent structure and routing.

## Acceptance Criteria

1. **Message Schema Defined**: Complete message structure specification for agent messages
2. **Message Type System**: Clear type identification system for different agent message subtypes
3. **Routing Logic Specified**: Detailed routing logic for agent messages through existing chat protocols
4. **Integration Points Documented**: Clear documentation of how agent messages integrate with existing chat flow
5. **Backward Compatibility**: Design maintains compatibility with existing message formats

## Dependencies

- Story 1: Agent Message System Architecture Analysis (provides architectural context)
- Existing chat message formats and protocols

## Tasks / Subtasks

- [ ] Analyze existing message formats in chat system
- [ ] Design agent message schema with metadata support
- [ ] Define message type constants and identification system
- [ ] Create routing logic specification for HTTP and WebSocket
- [ ] Document integration points with existing chat endpoints
- [ ] Specify backward compatibility requirements
- [ ] Create message format documentation

## Dev Notes

### Relevant Source Tree Info

- **Existing Messages**: Review current message structures in useChat hook and MessageBubble
- **Chat Protocols**: Examine HTTP /api/chat and WebSocket message handling
- **Message Types**: Document existing message type patterns

### Technical Constraints

- Must work with existing WebSocket and HTTP chat implementations
- Message format should be extensible for future agent message types
- Maintain performance requirements (<5% overhead)
- Ensure proper message ordering and sequencing

### Security Considerations

- Message format should not allow injection attacks
- Agent messages should be properly validated
- Sensitive data should not be exposed in message metadata

## Testing

### Testing Strategy

- **Design Review**: Validate message schema against requirements
- **Integration Testing**: Test message format compatibility
- **Performance Testing**: Verify overhead remains within limits

## Dev Agent Record

| Date | Agent | Task                             | Status  | Notes                                             |
| ---- | ----- | -------------------------------- | ------- | ------------------------------------------------- |
| TBD  | TBD   | Analyze existing message formats | Pending | Review current chat message structures            |
| TBD  | TBD   | Design agent message schema      | Pending | Create comprehensive message format specification |
| TBD  | TBD   | Define message type system       | Pending | Establish type identification and constants       |
| TBD  | TBD   | Specify routing logic            | Pending | Document HTTP/WebSocket routing requirements      |
| TBD  | TBD   | Document integration points      | Pending | Detail how messages integrate with chat flow      |

## QA Results

| Date | QA Agent | Test Type     | Status  | Issues Found | Resolution |
| ---- | -------- | ------------- | ------- | ------------ | ---------- |
| TBD  | TBD      | Design review | Pending | TBD          | TBD        |

## Change Log

| Date       | Version | Description                                      | Author |
| ---------- | ------- | ------------------------------------------------ | ------ | ---------- |
| 2025-12-04 | v1.0    | Initial story creation for message format design | PO     | </content> |

<parameter name="filePath">docs/stories/story-2-agent-message-format-design.md
