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

- [ ] Verify backend agent message system exists in JavaScript/Node.js codebase
- [ ] Confirm WebSocket backend implementation for real-time messaging
- [ ] Analyze current message flow in useChat hook and MessageBubble component
- [ ] Design agent message format for sanitization summaries (if backend system exists)
- [ ] Implement/modify backend agent message routing (if needed)
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
- **Backend Integration**: JavaScript/Node.js backend in src/ (not Python)
  - HTTP endpoints in src/routes/api.js
  - WebSocket support to be verified during implementation
- **Dependencies**: Story: Sanitization Summary in HITL Chat provides sanitization logic

### Technical Constraints

- Message display must integrate with existing MessageBubble component patterns
- Chat state management must work with useChat hook architecture
- Performance impact should remain minimal (<5% overhead)
- Backend is JavaScript/Node.js (not Python as initially assumed)
- WebSocket support exists in frontend but backend implementation needs verification
- Agent message routing architecture to be determined during implementation

### Security Considerations

- Sanitization summary messages should be properly validated before sending
- No sensitive information leakage through agent messages
- Message content should be sanitized before display
- Follow existing security patterns from sanitization pipeline

### Implementation Notes

- Backend is JavaScript/Node.js - verify agent message system exists in src/
- WebSocket support exists in frontend (useWebSocket.ts) but backend implementation needs confirmation
- Agent message routing patterns to be determined - may need new backend endpoints
- Message format design needed for agent-sent sanitization summaries
- Integration approach may require backend API extensions

## Testing

### Testing Strategy

- **Integration Tests**: Test agent message flow with sanitization summaries
- **UI Tests**: Verify message display and styling
- **Ordering Tests**: Ensure correct message sequence

## Dev Agent Record

| Date | Agent | Task                                   | Status  | Notes                                                       |
| ---- | ----- | -------------------------------------- | ------- | ----------------------------------------------------------- |
| TBD  | TBD   | Verify JavaScript backend agent system | Pending | Confirm agent message system exists in Node.js backend      |
| TBD  | TBD   | Confirm WebSocket backend support      | Pending | Verify WebSocket endpoints exist in src/                    |
| TBD  | TBD   | Analyze frontend message handling      | Pending | Review useChat hook and MessageBubble component integration |
| TBD  | TBD   | Design agent message format            | Pending | Define message structure for sanitization summaries         |
| TBD  | TBD   | Implement backend message routing      | Pending | Add/modify backend for agent message sending                |
| TBD  | TBD   | Update frontend message display        | Pending | Add support for agent-sent sanitization summary messages    |
| TBD  | TBD   | Test message ordering                  | Pending | Ensure summary appears before normal response               |
| TBD  | TBD   | Add comprehensive tests                | Pending | Integration tests for message flow and WebSocket handling   |

## QA Results

| Date       | QA Agent | Test Type           | Status      | Issues Found                               | Resolution                                                           |
| ---------- | -------- | ------------------- | ----------- | ------------------------------------------ | -------------------------------------------------------------------- |
| 2025-12-04 | PO       | Story validation    | In Progress | Backend language and WebSocket assumptions | Corrected to JavaScript/Node.js backend and added verification tasks |
| TBD        | TBD      | Integration testing | Pending     | Message ordering and display verification  | Implement comprehensive test suite during development                |
| TBD        | TBD      | Security testing    | Pending     | Message validation and sanitization        | Ensure no information leakage through agent messages                 |

## Change Log

| Date       | Version | Description                                          | Author |
| ---------- | ------- | ---------------------------------------------------- | ------ | ---------- |
| 2025-12-04 | v1.0    | Initial story for agent message integration          | PO     |
| 2025-12-04 | v1.1    | Fixed template compliance and added missing sections | PO     |
| 2025-12-04 | v1.2    | Updated with conservative architecture assumptions   | PO     |
| 2025-12-04 | v1.3    | Corrected backend language and WebSocket assumptions | PO     | </content> |

<parameter name="filePath">docs/stories/agent-message-integration-sanitization-summary.md
