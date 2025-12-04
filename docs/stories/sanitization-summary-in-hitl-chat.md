# Story: Sanitization Summary in HITL Chat

## Status

Draft

## Story

**As a** security operator using the HITL chat interface,
**I want to** see a detailed summary of what characters were stripped during bleach sanitization processing, along with contextual advice about the sanitization,
**so that** I can understand exactly what content was modified and assess potential security implications.

## Acceptance Criteria

1. **Sanitization Summary Display**: Show a clear list or diff of characters/content that was stripped by the bleach library after processing user input
2. **Advice Provision**: Include contextual advice about the sanitization (e.g., "HTML tags removed - potential XSS attempt detected", "Special characters neutralized - safe for display")
3. **HITL Chat Integration**: Display the summary as an agent message in the ChatInterface component that doesn't disrupt normal chat flow
4. **Performance-Based Triggering**: Only show sanitization summary when stripped content exceeds 5% of original input length
5. **Backend Integration**: Agent sends sanitization summary message after processing user input through the sanitization pipeline when threshold exceeded
6. **Existing Functionality**: Bleach sanitization and chat interface continue to work unchanged
7. **Testing Coverage**: Unit tests for summary generation, threshold logic, and integration tests for chat message display
8. **Documentation**: Update ChatInterface documentation with the new summary feature and performance thresholds

## Dependencies

- Story 5.2a: Conditional Sanitization Logic (docs/stories/5.2a-implement-conditional-sanitization-logic.md) - Provides bleach sanitization pipeline
- Agent Chat Interface: ChatInterface.tsx component in agent/agent-development-env/frontend/src/components/

## Tasks / Subtasks

- [ ] Analyze current bleach sanitization pipeline to identify capture points for stripped content
- [ ] Implement performance threshold logic (5% sanitization impact calculation)
- [ ] Design sanitization summary message format and advice logic
- [ ] Modify backend agent to calculate sanitization impact and conditionally send summary messages
- [ ] Update ChatInterface to handle and display sanitization summary messages
- [ ] Add unit tests for summary generation logic and threshold calculations
- [ ] Add integration tests for chat message display and threshold triggering
- [ ] Update documentation with performance metrics and threshold behavior

## Dev Notes

### Relevant Source Tree Info

- **Chat Interface**: agent/agent-development-env/frontend/src/components/ChatInterface.tsx - Main chat UI component
- **Sanitization Pipeline**: src/components/sanitization-pipeline.js - Backend bleach processing
- **Message Handling**: agent/agent-development-env/frontend/src/hooks/useChat.ts - Chat message flow
- **Frontend Sanitization**: agent/agent-development-env/frontend/src/lib/sanitizationUtils.ts - Client-side sanitization

### Technical Constraints

- Sanitization summary must be sent as agent message via existing WebSocket/HTTP chat channels
- Summary should not interfere with normal chat responses
- Performance impact must be minimal (<5% overhead)
- Summary should be optional/toggleable to avoid cluttering chat
- Threshold calculation: (original_length - sanitized_length) / original_length > 0.05

### Security Considerations

- Sanitization summary should not reveal sensitive information about what was sanitized
- Summary messages should be properly sanitized themselves
- Access to sanitization details should follow existing security patterns
- Threshold triggering helps avoid unnecessary exposure of sanitization details for minor changes

### Performance Metrics

- **Sanitization Impact Threshold**: 5% minimum change required to trigger summary
- **Calculation Method**: `(original_length - sanitized_length) / original_length > 0.05`
- **Performance Overhead**: <5% additional processing time for threshold calculation
- **Trigger Behavior**: Only show HITL message when significant content modification detected

## Testing

### Testing Strategy

- **Unit Tests**: Test sanitization summary generation logic
- **Integration Tests**: Test end-to-end summary message flow through chat interface
- **UI Tests**: Verify summary display in ChatInterface component

## Change Log

| Date       | Version | Description                                                           | Author |
| ---------- | ------- | --------------------------------------------------------------------- | ------ | ---------- |
| 2025-12-04 | v1.0    | Initial story creation with clarified HITL chat interface integration | PO     |
| 2025-12-04 | v1.1    | Added performance metrics and 5% threshold logic for HITL triggering  | PO     | </content> |

<parameter name="filePath">docs/stories/sanitization-summary-in-hitl-chat.md
