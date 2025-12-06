# Story 2: Integrate Trust Tokens in JSON Creation

## Story Overview

**As a** backend developer  
**I want to** update the JSON structuring logic in jobWorker.js to append validated trust tokens to sanitized content before final JSON serialization  
**So that** cryptographic metadata is included in the output for content verification

## Business Value

This story enables secure content reuse by ensuring trust tokens are properly integrated into the final JSON output, allowing downstream systems to validate content integrity and authenticity.

## Acceptance Criteria

### Functional Requirements

- [ ] Trust tokens are appended to JSON output when present
- [ ] Trust tokens are validated before inclusion
- [ ] JSON structure maintains backward compatibility
- [ ] Invalid trust tokens are logged but don't break processing

### Non-Functional Requirements

- [ ] JSON serialization performance not degraded
- [ ] Trust token validation is fast (<100ms)
- [ ] Memory usage remains within limits

## Technical Details

### Current Implementation

```javascript
// In jobWorker.js - currently excludes trust tokens
result = { sanitizedData: sanitized };
// Trust tokens are stripped before this point
```

### Proposed Changes

- Modify JSON creation logic to include validated trust tokens
- Add trust token validation before inclusion
- Ensure proper JSON structure with trust tokens

### Files to Modify

- `src/workers/jobWorker.js` - JSON structuring logic
- `src/models/TrustToken.js` - Trust token validation

### Integration Points

- jobWorker.js result creation
- TrustToken model validation
- JSON serialization process

## Testing Strategy

### Unit Tests

- [ ] Test trust token inclusion in JSON output
- [ ] Verify trust token validation logic
- [ ] Test invalid trust token handling

### Integration Tests

- [ ] End-to-end processing with trust tokens in JSON
- [ ] Trust token validation in JSON output
- [ ] Backward compatibility with existing JSON consumers

### Regression Tests

- [ ] JSON output without trust tokens still works
- [ ] Processing performance not degraded
- [ ] Error handling maintains stability

## Definition of Done

- [ ] Code changes implemented and reviewed
- [ ] Unit tests pass with >90% coverage
- [ ] Integration tests pass
- [ ] Regression tests pass
- [ ] Trust tokens included in JSON output
- [ ] Trust token validation working
- [ ] Documentation updated
- [ ] Peer review completed

## Dependencies

- **Epic**: Trust Token Integration in AI Processing Pipeline
- **Depends on**: Story 1 (preserved tokens)
- **Blocks**: Story 3 (validation)
- **Blocked by**: Story 1

## Risk Assessment

**Medium Risk**: JSON structure changes could affect consumers
**Mitigation**: Maintain backward compatibility, feature flag control
**Rollback**: Remove trust token inclusion from JSON output

## Story Points: 3

## Priority: High

## Story Reference

**Epic**: Trust Token Integration in AI Processing Pipeline
**Story Number**: 2 of 3</content>
<parameter name="filePath">docs/epics/trust-tokens/story-2-integrate-trust-tokens-in-json-creation.md
