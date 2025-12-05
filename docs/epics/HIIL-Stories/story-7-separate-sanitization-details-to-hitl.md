# Story: Separate Sanitization Details to HITL Alert and Refine Message Clarity

## Status

Draft

## Story

**As a** security operator,
**I want** to separate sanitization findings from the healthy response and receive specific, actionable HITL alerts,
**So that** the final user output is clean, and I am clearly informed if malicious payloads were detected (with details) or if the document was verified as safe.

## Acceptance Criteria

1.  **Exclude Sanitization Details from Response**: The final JSON response returned by the pipeline must **NOT** contain the `sanitizationTests` object.
2.  **Include Sanitization Details in HITL Alert**: The HITL alert payload must receive the extracted `sanitizationTests` object.
3.  **Refine HITL Message Content**:
    - **Clean State**: If no threats are detected in `sanitizationTests` (all clear/null), the agent must state: "No malicious scripts or payloads detected."
    - **Threat Detected**: If threats are found (e.g., fields marked "Present" or containing patterns), the agent must state: "Malicious Payload Detected:" followed by the specific key-value pairs of the findings (e.g., `potentialXSS: { patterns: [...] }`).
    - **Prohibit Generic Messages**: Ensure generic phrases like "Sanitized characters from PDF processing..." are replaced by the specific states above.
4.  **Preserve Healthy Data**: The `documentDetails`, `ripplingAnalysis`, `trustToken`, and any other valid business data must remain in the final healthy JSON response.
5.  **Verification**:
    - Test with a clean document: Verify alert says "No malicious scripts or payloads detected."
    - Test with a malicious document: Verify alert says "Malicious Payload Detected:" and lists the specific `sanitizationTests` findings.
    - Verify the API response to the user does not contain `sanitizationTests`.

## Tasks / Subtasks

- [x] Identify the specific code block in the sanitization pipeline where the final JSON output is constructed.
- [x] Implement logic to extract `sanitizationTests` from the response object before it is sent to the user.
- [x] Update the API response handler to return only the "healthy" data (e.g., `documentDetails`, `ripplingAnalysis`, `trustToken`).
- [x] Modify the HITL trigger function (or agent message handler) to accept the extracted `sanitizationTests` data.
- [x] Implement the message formatting logic within the HITL handler:
  - [x] Logic to check if `sanitizationTests` indicates threats (e.g., fields != "None" or non-empty arrays).
  - [x] Formatting for the "Clean State" message.
  - [x] Formatting for the "Threat Detected" message (enumerating findings).
- [x] Remove any existing generic or hardcoded messages regarding sanitization (e.g., "Sanitized characters from PDF processing...").
- [x] Add unit tests for the JSON separation logic.
- [x] Add unit tests for the message formatting logic (clean vs. malicious scenarios).
- [ ] Verify end-to-end flow: Input PDF -> Pipeline -> User gets clean JSON -> HITL gets detailed alert.

## Dev Notes

### Context

The sanitization pipeline currently returns a JSON object that combines the sanitized document content with sanitization findings. This story separates them to improve security hygiene.

### Example Data

**Input/Current Output (Internal Pipeline Result):**

```json
{
  "documentDetails": { "title": "Test PDF..." },
  "sanitizationTests": {
    "zeroWidthCharacters": "Present",
    "potentialXSS": { "patterns": ["email@test.com"] },
    ...
  },
  "ripplingAnalysis": { ... },
  "trustToken": { ... }
}
```

**Target Healthy Response (To User):**

```json
{
  "documentDetails": { "title": "Test PDF..." },
  "ripplingAnalysis": { ... },
  "trustToken": { ... }
}
```

## Testing

- **Unit Tests**:
  - Create a test case with a mock "malicious" result object. Verify separation.
  - Create a test case with a mock "clean" result object. Verify separation.
  - Test the message formatter with various `sanitizationTests` payloads (empty, simple threat, complex threat).
- **Integration Tests**:
  - Run the full pipeline with `test-valid.pdf` (or similar). Check the actual API response body.
  - Check the HITL alert output (console or mock interface) for the correct message text.

## Change Log

| Date       | Version | Description                                                                           | Author |
| ---------- | ------- | ------------------------------------------------------------------------------------- | ------ |
| 2025-12-04 | v1.0    | Initial story draft created with separation logic and message formatting requirements | PM     |

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

- Unit test passed: `src/tests/unit/jobWorker.sanitizationTests.test.js`

### Completion Notes List

- Modified `src/workers/jobWorker.js` to intercept `aiTransformType === 'structure'` results.
- Extracted `sanitizationTests` from the JSON object.
- Instantiated `AuditLogger` and called `logEscalationDecision` with the separated data.
- Implemented message formatting logic to distinguish between "Clean State" and "Threat Detected".
- Removed `sanitizationTests` from the final user response.
- Verified with unit tests using mocks for dependencies.
- **Fix Applied**: Updated extraction logic to handle multiple key variations (`sanitizationTests`, `sanitizationTargets`, `sanitizationReport`, `securityReport`) to improve robustness against AI variability.

### File List

- `src/workers/jobWorker.js` (Modified)
- `src/tests/unit/jobWorker.sanitizationTests.test.js` (Created)
- `docs/epics/HIIL-Stories/story-7-separate-sanitization-details-to-hitl.md` (Updated)

### Debug Log References

_To be filled by Dev Agent_

### Completion Notes List

_To be filled by Dev Agent_

### File List

_To be filled by Dev Agent_
