# BLEACH-ASYNC-PIPELINE: Corrected Sanitization Pipeline Order

## Status

Draft

## Epic Overview

**Problem**: The current PDF processing pipeline applies AI transformation BEFORE sanitization, allowing AI models to process potentially malicious content and generate sanitization metadata in responses. This creates security risks and requires complex cleanup.

**Solution**: Reorder the pipeline to apply comprehensive bleach sanitization BEFORE AI transformation, ensuring AI models receive clean input and generate clean responses without sanitization artifacts.

**Business Value**: Eliminates AI processing of malicious content, prevents sanitization metadata leakage, and ensures clean responses from input to output with optimal async performance.

## Epic Goals

- Reorder PDF processing pipeline: Sanitization → AI Transform → Final Cleanup
- Implement bleach-equivalent sanitization before AI processing
- Ensure AI models receive only sanitized input
- Eliminate sanitization metadata from AI responses
- Maintain async performance with single comprehensive sanitization

## Stories

### Story 1: Pipeline Reordering Implementation

**As a** backend developer,
**I want to** reorder the PDF processing pipeline,
**so that** bleach sanitization occurs before AI transformation.

**Acceptance Criteria:**

1. PDF processing pipeline reordered: Text → Markdown → Sanitization → AI → Cleanup
2. AI transformation receives bleach-sanitized input
3. Pipeline maintains async performance
4. Backward compatibility preserved

### Story 2: Bleach Sanitization Integration

**As a** security engineer,
**I want to** integrate comprehensive bleach sanitization,
**so that** all malicious content is removed before AI processing.

**Acceptance Criteria:**

1. Bleach-equivalent sanitization implemented in Node.js
2. HTML, scripts, attributes, and URLs sanitized
3. Threat analysis and reporting integrated
4. Performance optimized for async processing

### Story 3: AI Input Validation

**As a** AI engineer,
**I want to** validate AI receives clean input,
**so that** AI models process only sanitized content.

**Acceptance Criteria:**

1. AI transformer receives pre-sanitized input
2. AI responses contain no sanitization metadata
3. AI processing performance maintained
4. Security validation of AI input/output

### Story 4: Response Security Validation

**As a** QA engineer,
**I want to** validate end-to-end security,
**so that** no sanitization metadata leaks to users.

**Acceptance Criteria:**

1. All response paths validated for metadata leakage
2. AI-generated content confirmed clean
3. Security audit logging comprehensive
4. User responses contain no security artifacts

## Technical Considerations

### Current Pipeline (Problematic):

```
PDF → Text Extraction → Markdown → AI Transform → Sanitization → Threat Extraction → Response
```

### Corrected Pipeline (Secure):

```
PDF → Text Extraction → Markdown → Bleach Sanitization → AI Transform → Final Validation → Response
```

### Implementation Strategy:

- **Reorder jobWorker.js** processing steps
- **Integrate BleachSanitizer** component
- **Update AI transformer** to expect clean input
- **Enhance threat reporting** with pre/post AI analysis
- **Maintain async performance** through optimized sanitization

### Risk Assessment:

- **Medium Risk**: Pipeline reordering affects core processing logic
- **Low Risk**: Enhanced security with bleach sanitization
- **Low Risk**: Async performance maintained through optimization

## Dependencies

- Bleach-equivalent Node.js library research/implementation
- AI transformer input validation updates
- Async pipeline performance testing
- Security audit logging enhancements

## Success Metrics

- Zero sanitization metadata in AI responses
- AI models process only sanitized input
- Pipeline performance within 10% of current benchmarks
- All response paths confirmed secure
- Comprehensive threat removal validated
