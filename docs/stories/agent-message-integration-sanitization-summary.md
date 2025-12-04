# Story: Agent Message Integration for Sanitization Summary

## Status

Draft

## Story

**As a** security operator using the HITL chat interface,
**I want to** see sanitization summaries displayed as agent messages in the chat,
**so that** the security notifications appear seamlessly integrated with the conversation flow.

## Acceptance Criteria

1. **Agent Message Display**: Sanitization summaries appear as messages from the agent in the chat interface
2. **Proper Message Formatting**: Agent messages include security shield icon and amber styling
3. **Message Ordering**: Sanitization summary appears immediately after user input when threshold exceeded
4. **Message Persistence**: Summary messages are stored in chat history like other agent messages
5. **No Response Interference**: Sanitization summaries don't interfere with normal agent responses
6. **WebSocket Support**: Works correctly with both HTTP and WebSocket chat connections
7. **Testing Coverage**: Integration tests verify message display and ordering
8. **Documentation**: Update agent documentation with sanitization summary message handling

## Tasks / Subtasks

- [ ] Verify agent message system architecture and routing patterns
- [ ] Analyze current message flow in useChat hook and MessageBubble component
- [ ] Design agent message format for sanitization summaries
- [ ] Modify backend to send sanitization summaries as agent messages
- [ ] Update message type identification in frontend components
- [ ] Ensure proper message ordering (summary before normal response)
- [ ] Test WebSocket message flow for sanitization summaries
- [ ] Add integration tests for agent message display and ordering
- [ ] Update agent documentation with message handling patterns

## Dev Notes

### Relevant Source Tree Info

- **Frontend Components**: Verified components in agent/agent-development-env/frontend/
  - MessageBubble component for message display
  - useChat hook for message state management
  - ChatInterface for UI integration
- **Backend Integration**: api.py contains HTTP/WebSocket endpoints
- **Dependencies**: Story: Sanitization Summary in HITL Chat provides sanitization logic

### Technical Constraints

- Message display must integrate with existing MessageBubble component patterns
- Chat state management must work with useChat hook architecture
- Performance impact should remain minimal (<5% overhead)
- Must support both WebSocket streaming and HTTP response formats
- Agent message routing to be determined during implementation

### Security Considerations

- Sanitization summary messages should be properly validated before sending
- No sensitive information leakage through agent messages
- Message content should be sanitized before display
- Follow existing security patterns from sanitization pipeline

### Implementation Notes

- Agent message system architecture needs verification during development
- Message routing patterns to be confirmed with existing agent implementation
- WebSocket message handling to be validated against current streaming implementation

## Testing

### Testing Strategy

- **Integration Tests**: Test agent message flow with sanitization summaries
- **UI Tests**: Verify message display and styling
- **Ordering Tests**: Ensure correct message sequence

## Dev Agent Record

| Date | Agent | Task                              | Status  | Notes                                                       |
| ---- | ----- | --------------------------------- | ------- | ----------------------------------------------------------- |
| TBD  | TBD   | Verify agent message architecture | Pending | Confirm agent message system exists and routing patterns    |
| TBD  | TBD   | Analyze frontend message handling | Pending | Review useChat hook and MessageBubble component integration |
| TBD  | TBD   | Design agent message format       | Pending | Define message structure for sanitization summaries         |
| TBD  | TBD   | Implement backend message sending | Pending | Modify backend to route summaries as agent messages         |
| TBD  | TBD   | Update frontend message display   | Pending | Add support for agent-sent sanitization summary messages    |
| TBD  | TBD   | Test message ordering             | Pending | Ensure summary appears before normal response               |
| TBD  | TBD   | Add comprehensive tests           | Pending | Integration tests for message flow and WebSocket handling   |

## QA Results

| Date       | QA Agent | Test Type           | Status      | Issues Found                              | Resolution                                                                       |
| ---------- | -------- | ------------------- | ----------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| 2025-12-04 | PO       | Story validation    | In Progress | Agent message system documentation gaps   | Updated story with verified architecture references and conservative assumptions |
| TBD        | TBD      | Integration testing | Pending     | Message ordering and display verification | Implement comprehensive test suite during development                            |
| TBD        | TBD      | Security testing    | Pending     | Message validation and sanitization       | Ensure no information leakage through agent messages                             |

## Change Log

| Date       | Version | Description                                          | Author |
| ---------- | ------- | ---------------------------------------------------- | ------ | ---------- |
| 2025-12-04 | v1.0    | Initial story for agent message integration          | PO     |
| 2025-12-04 | v1.1    | Fixed template compliance and added missing sections | PO     |
| 2025-12-04 | v1.2    | Updated with conservative architecture assumptions   | PO     | </content> |

<parameter name="filePath">docs/stories/agent-message-integration-sanitization-summary.md
