# PDF AI Workflow Troubleshooting Guide

## Overview

This guide provides troubleshooting procedures for PDF AI workflow integration issues in the brownfield security hardening environment.

## Common Issues and Solutions

### 1. PDF AI Processing Failures

**Symptoms:**

- PDF upload succeeds but AI transformation fails
- Error messages containing "AI service unavailable" or "transformation timeout"
- Documents processed without AI enhancement

**Root Causes:**

- AI service API key misconfiguration
- Network connectivity issues to AI providers
- Invalid PDF content causing parsing failures
- AI service rate limiting or quota exceeded

**Troubleshooting Steps:**

1. **Check AI Service Configuration:**

   ```bash
   # Verify environment variables
    echo $GEMINI_API_KEY  # Should start with "AIzaSy"
    echo $AI_PROVIDER     # Should be "gemini", "openai", etc.
   ```

2. **Test AI Service Connectivity:**

   ```javascript
   // From application console
   const aiConfig = require('./src/config/aiConfig');
   const config = aiConfig.getConfig();
   console.log('AI Config:', config);
   ```

3. **Validate PDF Content:**
   - Ensure PDF is not corrupted
   - Check PDF size (large files may timeout)
   - Verify PDF contains extractable text

4. **Check Application Logs:**
   ```bash
   # Look for AI-related errors
   grep "AI\|transformation\|openai" logs/application.log
   ```

**Resolution:**

- For API key issues: Update environment variables and restart application
- For network issues: Check firewall settings and proxy configuration
- For PDF issues: Implement fallback to basic sanitization without AI enhancement
- For rate limiting: Implement exponential backoff and retry logic

### 2. Trust Token Validation Failures

**Symptoms:**

- PDF upload rejected with "Trust token required" error
- AI agent requests failing authentication
- Documents not processed despite valid credentials

**Root Causes:**

- Missing or invalid trust token headers
- Expired trust tokens
- Trust token signature validation failures
- Clock synchronization issues between systems

**Troubleshooting Steps:**

1. **Verify Trust Token Headers:**

   ```javascript
   // Check request headers
   console.log('X-Trust-Token present:', !!req.headers['x-trust-token']);
   ```

2. **Validate Token Structure:**

   ```javascript
   const token = JSON.parse(req.headers['x-trust-token']);
   console.log('Required fields present:', {
     contentHash: !!token.contentHash,
     signature: !!token.signature,
     expiresAt: !!token.expiresAt,
   });
   ```

3. **Check Token Expiration:**
   ```javascript
   const now = new Date();
   const expires = new Date(token.expiresAt);
   console.log('Token expired:', now > expires);
   ```

**Resolution:**

- Ensure AI agents include valid trust tokens in requests
- Implement token refresh logic for expired tokens
- Verify system clocks are synchronized
- Check trust token secret configuration

### 3. Performance Degradation

**Symptoms:**

- PDF processing taking longer than expected (> 2 seconds)
- Memory usage spikes during AI processing
- Application becoming unresponsive under load

**Root Causes:**

- Large PDF files causing memory issues
- AI service response delays
- Inefficient PDF parsing for complex documents
- Resource contention in async processing queues

**Troubleshooting Steps:**

1. **Monitor Processing Times:**

   ```javascript
   // Add timing logs
   const start = Date.now();
   // ... processing logic ...
   const duration = Date.now() - start;
   console.log(`Processing time: ${duration}ms`);
   ```

2. **Check Memory Usage:**

   ```bash
   # Monitor Node.js process
   ps aux | grep node
   # Check memory usage in application logs
   ```

3. **Analyze Queue Backlog:**
   ```javascript
   // Check queue status
   const queueStats = queueManager.getStats();
   console.log('Queue stats:', queueStats);
   ```

**Resolution:**

- Implement file size limits for PDF uploads
- Add timeout handling for AI service calls
- Optimize PDF parsing for large documents
- Implement async processing for large files

### 4. Integration Test Failures

**Symptoms:**

- PDF AI workflow tests failing intermittently
- Mock AI services not responding correctly
- Integration test timeouts

**Root Causes:**

- Mock service configuration issues
- Test data inconsistencies
- Race conditions in async tests
- Environment-specific test failures

**Troubleshooting Steps:**

1. **Verify Test Configuration:**

   ```bash
   # Check test environment setup
   npm run test -- --testPathPattern="pdf-ai" --verbose
   ```

2. **Inspect Mock Responses:**

   ```javascript
   // Check mock AI service responses
   const mockResponse = require('./mocks/ai-service');
   console.log('Mock response:', mockResponse);
   ```

3. **Run Isolated Tests:**
   ```bash
   # Run specific failing tests
   npm run test -- --testNamePattern="should process PDF with AI"
   ```

**Resolution:**

- Update mock configurations to match real AI service responses
- Fix race conditions in async test setup
- Ensure test data consistency across environments
- Implement proper test cleanup procedures

## Maintenance Procedures

### Regular Health Checks

1. **Daily Monitoring:**
   - Check PDF AI processing success rates (> 95%)
   - Monitor average processing times (< 2 seconds)
   - Verify AI service connectivity
   - Review error logs for patterns

2. **Weekly Reviews:**
   - Analyze performance metrics trends
   - Review security audit logs
   - Update AI service configurations if needed
   - Validate trust token rotation

### Emergency Procedures

1. **AI Service Outage:**
   - Enable fallback mode (sanitization without AI)
   - Notify development team
   - Monitor impact on document processing
   - Implement manual processing if needed

2. **Performance Issues:**
   - Scale application resources if needed
   - Implement request throttling
   - Enable async processing for all requests
   - Monitor queue depths and processing times

## Configuration Reference

### Environment Variables

```bash
# AI Service Configuration
GEMINI_API_KEY=AIzaSy...      # Required for Gemini integration
AI_PROVIDER=gemini             # Default AI provider
AI_TIMEOUT=30000               # AI service timeout (ms)
AI_MAX_RETRIES=3               # Maximum retry attempts

# PDF Processing
PDF_MAX_SIZE=10485760          # Maximum PDF size (10MB)
PDF_PROCESSING_TIMEOUT=60000   # PDF processing timeout (ms)

# Trust Token System
TRUST_TOKEN_SECRET=...         # Secret for token signing
TRUST_TOKEN_EXPIRY=3600000     # Token expiry (1 hour)
```

### Key Files

- `src/components/AITextTransformer.js` - AI service integration
- `src/routes/api.js` - PDF upload endpoints
- `src/components/TrustTokenGenerator.js` - Trust token management
- `src/tests/integration/pdf-ai-*.test.js` - Integration tests

## Contact Information

For issues not covered in this guide:

- **Development Team:** Create issue in project repository
- **Security Issues:** Contact security team immediately
- **Performance Issues:** Escalate to infrastructure team

## Version History

- v1.0 (2025-11-21): Initial PDF AI workflow troubleshooting guide
- Covers integration issues, performance problems, and maintenance procedures
