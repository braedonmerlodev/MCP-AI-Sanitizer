# Story-7.1: Agent Trust Token Display & Validation

## Status

Ready for Development

## Parent Story

Story-7: Agent Integration & Trust Token Handling

## Story

**As a** Python Agent Developer,
**I want** the agent to properly parse, validate, and display trust tokens from API responses,
**so that** users can verify the authenticity and integrity of processed content.

## Acceptance Criteria

1. Agent parses complete API response structure including trust tokens
2. Agent validates trust token cryptographic signatures
3. Agent displays trust token validation information (hash, signature, expiration, rules applied)
4. Agent handles missing trust tokens gracefully with appropriate warnings
5. Agent provides clear visual indicators for trust token validation status
6. Agent includes trust token information in all content display outputs

## Problem Statement

Currently, the Python agent only extracts and displays the sanitized content (`response.result.sanitizedContent.sanitizedData`) from API responses, completely ignoring the trust token validation information. This means users cannot verify that:

- Content has been properly sanitized
- Content integrity is maintained
- Content originated from a trusted source
- Content has not been tampered with

## Solution Overview

Update the agent's response parsing and display logic to:

1. Extract both content and trust token from API responses
2. Validate trust token signatures using the agent's trust token validator
3. Display comprehensive trust information alongside content
4. Provide clear success/failure indicators for trust validation

## Technical Details

### Current Agent Behavior

```python
# Current code only extracts content
result = response.json()
content = result['result']['sanitizedContent']['sanitizedData']
print(json.dumps(content, indent=2))  # Only shows content
```

### Required Agent Behavior

```python
# Updated code extracts and validates trust tokens
result = response.json()

if 'result' in result and 'sanitizedContent' in result['result']:
    content = result['result']['sanitizedContent']['sanitizedData']
    trust_token = result['result']['sanitizedContent'].get('trustToken')

    # Display content
    print(json.dumps(content, indent=2))

    # Validate and display trust token
    if trust_token:
        print("\n🔐 Trust Token Validation:")
        print(f"✅ Content Hash: {trust_token['contentHash']}")
        print(f"✅ Signature: {trust_token['signature'][:16]}...")
        print(f"✅ Valid Until: {trust_token['expiresAt']}")
        print(f"✅ Rules Applied: {', '.join(trust_token['rulesApplied'])}")

        # Perform cryptographic validation
        is_valid = validate_trust_token(trust_token)
        if is_valid:
            print("✅ Trust Token: VALID")
        else:
            print("❌ Trust Token: INVALID")
    else:
        print("\n❌ No trust token found!")
```

### API Response Structure

```json
{
  "taskId": "pdf_123456789",
  "status": "completed",
  "result": {
    "sanitizedContent": {
      "sanitizedData": {
        "title": "Business Proposal",
        "content": "..."
      },
      "trustToken": {
        "contentHash": "abc123...",
        "originalHash": "def456...",
        "sanitizationVersion": "1.0",
        "rulesApplied": ["UnicodeNormalization", "SymbolStripping"],
        "timestamp": "2025-12-02T03:47:44.453Z",
        "expiresAt": "2025-12-03T03:47:44.453Z",
        "signature": "signature_hash...",
        "nonce": "random_nonce"
      }
    },
    "metadata": {
      "timestamp": "2025-12-02T03:47:44.454Z",
      "reused": false,
      "performance": { "totalTimeMs": 10 }
    }
  }
}
```

## Tasks / Subtasks

- [ ] Update response parsing logic to extract trust tokens
- [ ] Implement trust token validation function
- [ ] Add trust token display formatting
- [ ] Update all content display methods to include trust information
- [ ] Add error handling for missing/invalid trust tokens
- [ ] Test with valid and invalid trust token responses
- [ ] Update agent logging to include trust token validation results

## Implementation Notes

### Trust Token Validation Function

```python
def validate_trust_token(trust_token: dict) -> bool:
    """
    Validate trust token cryptographic signature
    Returns True if valid, False otherwise
    """
    try:
        # Implement HMAC-SHA256 validation using agent's secret
        # Compare trust_token['signature'] with computed signature
        return True  # Placeholder
    except Exception as e:
        logger.error(f"Trust token validation failed: {e}")
        return False
```

### Display Format Options

- Console output with emojis and color coding
- Structured logging with trust token details
- Optional verbose mode showing full token details
- Warning messages for missing tokens

## Dependencies

- Story-3: Trust Token System (for validation logic)
- Story-6.2: Full Pipeline Integration Testing (for test data)

## Testing Strategy

### Unit Tests

- Test trust token parsing from various response formats
- Test validation function with valid/invalid tokens
- Test display formatting functions

### Integration Tests

- Test with real API responses containing trust tokens
- Test with responses missing trust tokens
- Test with invalid trust token signatures

### Manual Testing

- Upload PDF and verify trust token display
- Test with tampered responses
- Test with expired tokens

## Success Criteria

- [ ] Agent displays trust token validation for all API responses
- [ ] Trust token validation passes for legitimate responses
- [ ] Clear error messages for missing/invalid tokens
- [ ] No performance impact on content display
- [ ] Backward compatibility with existing response formats

## File List

- Modified: `agent/agent-development-env/src/api_client.py` (response parsing)
- Modified: `agent/agent-development-env/src/trust_validator.py` (new validation module)
- Modified: `agent/agent-development-env/src/display.py` (content display with trust info)
- Created: `agent/agent-development-env/tests/test_trust_display.py`

## Dev Notes

- Ensure cryptographic validation uses the same secret as the Node.js API
- Consider caching validation results to avoid repeated computations
- Add configuration option to disable trust token display if needed
- Maintain backward compatibility with responses that don't include trust tokens

## Change Log

| Date       | Version | Description                                           |
| ---------- | ------- | ----------------------------------------------------- |
| 2025-12-02 | 1.0     | Initial story creation for agent trust token handling |
