# Error Handling Strategy

## General Approach

- **Error Model:** Custom error classes extending base Error
- **Exception Hierarchy:** SanitizationError, ValidationError, ProvenanceError
- **Error Propagation:** Bubble up with added context, avoid swallowing errors

## Logging Standards

- **Library:** Winston 3.11.0
- **Format:** JSON for structured logging
- **Levels:** error (failures), warn (degraded), info (milestones), debug (detailed)
- **Required Context:**
  - Correlation ID: UUID from request
  - Service Context: Component name and version
  - User Context: Request source (e.g., n8n)

## Error Patterns

### External API Errors

- **Retry Policy:** Exponential backoff up to 3 attempts
- **Circuit Breaker:** Open after 3 failures, half-open after 60s
- **Timeout Configuration:** 30 seconds for LLM calls
- **Error Translation:** Map external errors to custom SanitizationError

### Business Logic Errors

- **Custom Exceptions:** InvalidDataError for bad input
- **User-Facing Errors:** Sanitized messages without sensitive data
- **Error Codes:** SAN-001 for sanitization failures

### Data Consistency

- **Transaction Strategy:** N/A for embedded SQLite
- **Compensation Logic:** Log error and alert on failure
- **Idempotency:** Use request ID to detect duplicates
