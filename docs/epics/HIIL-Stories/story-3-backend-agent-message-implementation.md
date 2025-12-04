# Story: Backend Agent Message Implementation

## Status

Ready for Review

## Story

**As a** backend developer implementing agent message integration,
**I want to** implement backend support for sending agent messages including WebSocket endpoints,
**so that** sanitization summaries can be delivered as agent messages through the backend infrastructure.

## Acceptance Criteria

1. **WebSocket Agent Message Support**: Backend can send agent messages via WebSocket connections
2. **HTTP Agent Message Support**: Agent messages included in HTTP chat responses
3. **Message Routing Logic**: Functional routing system for agent messages
4. **Error Handling**: Proper error handling for message delivery failures
5. **Integration with Chat Endpoints**: Agent messages work with existing /api/chat and WebSocket chat endpoints
6. **Performance Requirements**: Message sending adds <5% overhead to chat responses

## Dependencies

- Story 1: Agent Message System Architecture Analysis (provides architectural context)
- Story 2: Agent Message Format Design (provides message format specification)
- Existing chat endpoints (/api/chat, WebSocket chat)

## Tasks / Subtasks

- [ ] Create AgentMessage class and validation functions in backend/api.py
- [ ] Implement priority-based message routing system with queue management
- [ ] Add agent message support to HTTP /api/chat endpoint (extend response format)
- [ ] Update WebSocket /ws/chat handler to send agent messages via chunk protocol
- [ ] Implement delivery guarantees (best-effort/at-least-once/exactly-once) for different message types
- [ ] Add TTL enforcement and message expiration handling
- [ ] Integrate sanitization summaries as agent messages (replace current summary field)
- [ ] Add comprehensive error handling for message delivery failures
- [ ] Implement performance monitoring and overhead tracking (<5% requirement)
- [ ] Add rate limiting for agent message generation per type
- [ ] Create unit tests for message routing and validation logic
- [ ] Test end-to-end agent message flow with existing chat functionality

## Dev Notes

### Agent Message Design Specifications (from Story 2)

**Agent Message Types to Implement:**

- **sanitization**: Security sanitization summaries and alerts (medium priority)
- **security**: General security alerts and warnings (high priority)
- **status**: Processing status updates and progress indicators (low priority)
- **error**: Error messages and system alerts (critical priority)

**Message Schema (Python backend):**

```python
class AgentMessage:
    id: str
    role: str = "assistant"
    content: str
    timestamp: str
    agentType: str  # "sanitization" | "security" | "status" | "error"
    priority: str   # "low" | "medium" | "high" | "critical"
    ttl: int        # Time to live in milliseconds
    deliveryGuarantee: str  # "best-effort" | "at-least-once" | "exactly-once"
    source: str     # Agent component identifier
```

**Routing Logic Requirements:**

- Priority-based message queuing (high/critical bypass rate limits)
- Separate agent message queues from user messages
- Delivery guarantees: best-effort (status), at-least-once (sanitization), exactly-once (security/error)
- Rate limiting to prevent chat flow disruption
- TTL enforcement for temporary messages

### Relevant Source Tree Info

- **HTTP Chat**: agent/agent-development-env/backend/api.py - /api/chat endpoint (lines ~1336-1460)
- **WebSocket Chat**: agent/agent-development-env/backend/api.py - /ws/chat endpoint (lines ~1190-1330)
- **Message Routing**: Backend message sending infrastructure in api.py
- **Performance Monitoring**: Existing metrics and logging in api.py
- **Current Sanitization**: create_sanitization_summary_message() function (lines ~397-425)

### Technical Constraints

- Must maintain backward compatibility with existing chat functionality
- WebSocket implementation should follow existing patterns (JSON messages with type/content)
- Message sending should not block chat response times (<5% overhead)
- Error handling should not crash chat functionality
- Agent messages should integrate with existing sanitization summary flow
- Support both HTTP response fields and WebSocket chunk messages

### Security Considerations

- Agent messages should be validated before sending (no injection attacks)
- WebSocket connections should maintain security context
- No sensitive data exposure through agent messages (sanitize metadata)
- Agent message source verification and integrity checks
- Rate limiting should apply to agent messages (configurable per type)
- Authentication required for agent message sending

## Testing

### Testing Strategy

- **Unit Tests**: Test AgentMessage validation, priority routing logic, TTL enforcement, delivery guarantees
- **Integration Tests**: Test HTTP /api/chat with agent messages, WebSocket chunk delivery, end-to-end sanitization flow
- **Performance Tests**: Measure chat response times with agent messages, verify <5% overhead, test rate limiting
- **Error Tests**: Test delivery failures, WebSocket disconnects, invalid message formats, rate limit enforcement
- **Security Tests**: Validate message sanitization, authentication checks, no sensitive data exposure
- **Backward Compatibility Tests**: Ensure existing chat functionality unchanged, sanitization summaries still work

## Dev Agent Record

| Date       | Agent | Task                                    | Status    | Notes                                                             |
| ---------- | ----- | --------------------------------------- | --------- | ----------------------------------------------------------------- |
| 2025-12-04 | dev   | Create AgentMessage class               | Completed | Implemented AgentMessage schema with validation in backend/api.py |
| 2025-12-04 | dev   | Implement priority routing system       | Completed | Added priority-based queues and delivery guarantees               |
| 2025-12-04 | dev   | Extend HTTP /api/chat response          | Completed | Include agent messages in chat API responses                      |
| 2025-12-04 | dev   | Update WebSocket chunk protocol         | Completed | Send agent messages as chunks in WebSocket chat                   |
| 2025-12-04 | dev   | Add TTL and expiration handling         | Completed | Implemented message expiration based on TTL                       |
| 2025-12-04 | dev   | Integrate sanitization as agent message | Completed | Replace summary field with proper agent message format            |
| 2025-12-04 | dev   | Implement delivery guarantees           | Completed | Add retry logic for at-least-once and exactly-once messages       |
| 2025-12-04 | dev   | Add comprehensive error handling        | Completed | Handle message delivery failures gracefully                       |
| 2025-12-04 | dev   | Implement performance monitoring        | Completed | Track and ensure <5% overhead requirement                         |
| 2025-12-04 | dev   | Add rate limiting per message type      | Completed | Prevent abuse with configurable rate limits                       |
| 2025-12-04 | dev   | Create unit tests                       | Completed | Test routing logic, validation, and error scenarios               |
| 2025-12-04 | dev   | Test end-to-end integration             | Completed | Created and ran integration tests verifying agent message flow    |

## Agent Model Used

dev-agent-v1.0

## Debug Log References

## Completion Notes List

- **AgentMessage Class Implemented**: Created Pydantic BaseModel with full validation for agentType, priority, ttl, deliveryGuarantee, and source fields
- **Priority Routing System**: Implemented dual-queue system (immediate/background) with automatic routing based on priority levels
- **HTTP Integration**: Modified /api/chat endpoint to return agent_messages array instead of sanitization_summary field
- **WebSocket Enhancement**: Updated chunk protocol to include agentMessage metadata while maintaining backward compatibility
- **TTL & Expiration**: Added cleanup task for expired messages with Prometheus metrics tracking
- **Delivery Guarantees**: Implemented retry logic for at-least-once and exactly-once delivery with connection-based delivery
- **Rate Limiting**: Added per-message-type rate limiting to prevent chat flow disruption
- **Performance Monitoring**: Added comprehensive Prometheus metrics for message lifecycle tracking
- **Security Validation**: Implemented sensitive data detection and timestamp validation
- **Unit Tests**: Created comprehensive test suite covering all routing, validation, and monitoring functionality
- **Integration Tests**: Created and executed integration tests verifying HTTP response format, WebSocket chunk protocol, and message routing functionality

## File List

- Modified: agent/agent-development-env/backend/api.py (added AgentMessage class, routing system, HTTP/WebSocket integration)
- Created: agent-message-backend.test.js (unit tests for agent message functionality)
- Created: agent-message-integration.test.js (integration tests for end-to-end agent message flow)

## QA Results

| Date | QA Agent | Test Type              | Status  | Issues Found | Resolution |
| ---- | -------- | ---------------------- | ------- | ------------ | ---------- |
| TBD  | TBD      | Backend implementation | Pending | TBD          | TBD        |

## Change Log

| Date       | Version | Description                                                                           | Author |
| ---------- | ------- | ------------------------------------------------------------------------------------- | ------ | ---------- |
| 2025-12-04 | v1.1    | Refined story with detailed specifications from Story 2 design completion             | SM     |
| 2025-12-04 | v1.1    | Completed full backend implementation with agent message system, routing, and testing | dev    | </content> |

<parameter name="filePath">docs/stories/story-3-backend-agent-message-implementation.md
