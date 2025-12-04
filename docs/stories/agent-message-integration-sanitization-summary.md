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

## Dependencies

- Story: Sanitization Summary in HITL Chat (docs/stories/sanitization-summary-in-hitl-chat.md) - Provides backend sanitization logic
- Agent Chat System: Existing agent message routing and display system

## Tasks / Subtasks

- [ ] Analyze current agent message flow and routing system
- [ ] Modify backend to send sanitization summaries as agent messages instead of response fields
- [ ] Update message type identification for sanitization summaries
- [ ] Ensure proper message ordering (summary before normal response)
- [ ] Test WebSocket message flow for sanitization summaries
- [ ] Update frontend message handling for agent-sent sanitization summaries
- [ ] Add integration tests for agent message display
- [ ] Update agent documentation

## Dev Notes

### Relevant Source Tree Info

- **Agent Message System**: agent/agent-development-env/backend/ - Agent response handling
- **Message Routing**: WebSocket and HTTP response paths
- **Frontend Display**: MessageBubble component message type handling
- **Chat Flow**: useChat hook message processing

### Technical Constraints

- Agent messages must follow existing message format and routing
- Summary messages should be distinguishable from normal responses
- Message ordering must be preserved in chat history
- Performance impact should remain minimal

### Security Considerations

- Sanitization summary messages should be properly validated
- No sensitive information leakage through agent messages
- Message content should be sanitized before display

## Testing

### Testing Strategy

- **Integration Tests**: Test agent message flow with sanitization summaries
- **UI Tests**: Verify message display and styling
- **Ordering Tests**: Ensure correct message sequence

## Change Log

| Date       | Version | Description                                 | Author |
| ---------- | ------- | ------------------------------------------- | ------ | ---------- |
| 2025-12-04 | v1.0    | Initial story for agent message integration | PO     | </content> |

<parameter name="filePath">docs/stories/agent-message-integration-sanitization-summary.md
