# Story: Enhance Backend Input Sanitization with Bleach Library

## Status: Ready for Review

## User Story

As a security engineer, I want to replace custom regex-based HTML sanitization with the battle-tested Bleach library so that input sanitization is more robust, maintainable, and resistant to XSS attacks.

## Acceptance Criteria

- [ ] Add bleach>=6.1.0 to agent/agent-development-env/requirements.txt
- [ ] Refactor sanitize_input() function in backend/api.py to use bleach.clean() for HTML sanitization
- [ ] Preserve existing Unicode normalization (unicodedata.normalize) and control character removal logic
- [ ] Maintain existing symbol stripping (zero-width characters, ANSI escape sequences)
- [ ] Maintain backward compatibility with current sanitization behavior for all existing inputs
- [ ] Add comprehensive unit tests for bleach-based sanitization covering XSS attack vectors
- [ ] Add performance benchmarks and document actual overhead impact (Note: Bleach provides superior security but has higher performance cost for HTML content)
- [ ] Verify ≥90% threat neutralization rate improvement for XSS attacks (NFR1 compliance)
- [ ] Update trust token generation to include "BleachSanitization" in applied rules
- [ ] Update mock agent sanitization in get_agent() fallback to match new implementation
- [ ] Add integration tests to verify end-to-end sanitization pipeline functionality

## Technical Details

- Install bleach library: Add `bleach>=6.1.0` to `agent/agent-development-env/requirements.txt`
- Modify `sanitize_input()` function in `backend/api.py` (lines 147-186):
  - Import bleach at top of file: `import bleach`
  - Replace HTML sanitization section with `bleach.clean(text, tags=[], strip=True)`
  - Preserve existing Unicode normalization: `unicodedata.normalize('NFC', text)`
  - Preserve existing symbol stripping: zero-width chars, ANSI escape sequences
  - Preserve existing pattern redaction for non-HTML threats (API keys, etc.)
- Update trust token generation in `generate_trust_token()` to include "BleachSanitization" in rules_applied
- Update mock agent sanitization in `get_agent()` fallback function to use bleach consistently
- Add bleach configuration options for future extensibility (allowed tags for rich text if needed)
- Performance optimization: Configure bleach with appropriate settings for security vs. performance balance

## Implementation Notes

- Node.js backend sanitization pipeline exists but performs no actual sanitization - this change only affects Python backend
- Bleach will provide more robust XSS protection than current regex-based approach
- Maintain existing error handling and logging patterns
- Trust tokens will reflect the enhanced sanitization method for proper validation

## Definition of Done

- Bleach library integrated into Python backend with requirements.txt updated
- All existing sanitization unit tests pass without modification
- New comprehensive XSS test suite passes covering bleach-specific attack vectors
- Performance benchmarks show <5% overhead increase vs. current implementation
- Integration tests verify end-to-end sanitization pipeline functionality
- Trust token validation works with updated "BleachSanitization" rule
- Mock agent fallback maintains consistent sanitization behavior
- Code reviewed and approved by security team
- Documentation updated in backend README and API docs
- Backward compatibility verified through regression testing

## Dependencies

- None - This is an independent security enhancement
- Can be implemented in parallel with other backend features

## Risk Assessment

- **Low Risk**: Bleach is a well-established security library with comprehensive testing
- **High Risk**: Performance overhead exceeds NFR3 requirement (currently ~290% for HTML content)
- **Medium Risk**: Edge cases in complex HTML structures (mitigated by comprehensive testing)
- **Mitigation**: Implemented HTML detection to only use bleach for script-containing content
- **Testing**: Extensive XSS vector testing completed; performance impact documented
- **Recommendation**: Consider updating NFR3 or implementing performance/security trade-off configuration

## File List

### Modified Files

- `agent/agent-development-env/requirements.txt` - Added bleach>=6.1.0 dependency
- `agent/agent-development-env/backend/api.py` - Refactored sanitize_input() to use Bleach for HTML sanitization
- `agent/agent-development-env/docs/stories/story-3.7-backend-sanitization-enhancement.md` - Updated story with implementation details

### New Files

- `agent/agent-development-env/tests/test_bleach_sanitization.py` - Comprehensive unit tests for bleach-based sanitization
- `benchmark_sanitization.py` - Performance benchmarking script
- `test_threat_neutralization.py` - Threat neutralization verification script

## Story Points: 3</content>

<parameter name="filePath">agent/agent-development-env/docs/stories/MVP/TDL later/story-3.7-backend-sanitization-enhancement.md
