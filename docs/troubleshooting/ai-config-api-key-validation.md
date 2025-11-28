# AI Configuration API Key Validation Troubleshooting Guide

## Overview

This guide provides troubleshooting procedures for AI configuration and Gemini API key validation issues in the MCP-Security system. It covers common problems, diagnostic steps, and resolution procedures for both development and production environments.

## Quick Reference

### Environment-Specific Behavior

| Environment | Missing Key     | Invalid Key     | Behavior                 |
| ----------- | --------------- | --------------- | ------------------------ |
| Production  | ❌ Throws Error | ❌ Throws Error | Strict validation        |
| Development | ⚠️ Warning      | ⚠️ Warning      | Permissive with warnings |

### Common Error Messages

- `"GEMINI_API_KEY environment variable must be set in production"`
- `"GEMINI_API_KEY must start with "AIzaSy""`
- `"GEMINI_API_KEY must be exactly 39 characters"`
- `"GEMINI_API_KEY must contain only alphanumeric characters after "AIzaSy""`
- `"GEMINI_API_KEY not set - AI features may not work in development"`

## Diagnostic Procedures

### 1. Check Environment Configuration

**Symptoms:** Application fails to start, AI features not working

**Steps:**

1. Verify `NODE_ENV` environment variable:

   ```bash
   echo $NODE_ENV
   ```

   - Should be `production` or `development`

2. Check API key configuration:

   ```bash
   echo $GEMINI_API_KEY | head -c 10  # First 10 chars only for security
   ```

3. Validate key format:

   ```bash
    # Should start with "AIzaSy"
    [[ "$GEMINI_API_KEY" =~ ^AIzaSy ]] && echo "Valid prefix" || echo "Invalid prefix"

    [ ${#GEMINI_API_KEY} -eq 39 ] && echo "Valid length" || echo "Invalid length: ${#GEMINI_API_KEY}"

    KEY_SUFFIX="${GEMINI_API_KEY#AIzaSy}"
   [[ "$KEY_SUFFIX" =~ ^[a-zA-Z0-9]+$ ]] && echo "Valid characters" || echo "Invalid characters"
   ```

### 2. Test AI Service Connectivity

**Symptoms:** AI processing fails, API errors in logs

**Steps:**

1. Verify API key validity with OpenAI:

   ```bash
    curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
   ```

   - Expected: 200 OK with model list
   - Error 401: Invalid API key
   - Error 429: Rate limit exceeded

2. Check API key permissions:
   - Ensure key has access to required models (GPT-3.5-turbo, GPT-4)
   - Verify billing is active on OpenAI account

### 3. Review Application Logs

**Symptoms:** Unexpected behavior, warnings in logs

**Log Locations:**

- Application logs: Check Winston logs for AI-related errors
- Console output: Look for dotenv/config warnings
- Error logs: Check for AI service timeout or connection errors

**Common Log Patterns:**

```
Warning: GEMINI_API_KEY not set - AI features may not work in development
Warning: GEMINI_API_KEY must start with "sk-"
Error: AI service unavailable - invalid API key
```

## Resolution Procedures

### Issue: Missing API Key in Production

**Symptoms:** Application throws startup error

**Resolution:**

1. Set the environment variable:

   ```bash
   export GEMINI_API_KEY="sk-your-actual-api-key-here"
   ```

2. For persistent configuration, add to your deployment environment or `.env` file

3. Restart the application

### Issue: Invalid API Key Format

**Symptoms:** Validation errors on startup

**Resolution:**

1. Verify the API key from OpenAI dashboard
2. Ensure it starts with `sk-`
3. Confirm it's exactly 51 characters
4. Check for special characters (only alphanumeric allowed after `sk-`)

**Example Valid Key:**

```
sk-abcdefghijklmnopqrstuvwxyz12345678901234567890
```

### Issue: AI Service Connection Failures

**Symptoms:** PDF processing works but AI transformation fails

**Resolution:**

1. Check API key validity (see diagnostic steps)
2. Verify network connectivity to OpenAI:

   ```bash
   curl -I https://api.openai.com
   ```

3. Check for rate limiting in application logs
4. Verify API key has sufficient credits/quota

### Issue: Development Environment Warnings

**Symptoms:** Console warnings but application continues

**Resolution:**

1. This is expected behavior in development
2. AI features will be disabled but application continues
3. Set a valid API key to enable AI features:
   ```bash
   export GEMINI_API_KEY="sk-your-development-key"
   ```

## Maintenance Procedures

### API Key Rotation

1. **Obtain new API key** from OpenAI dashboard
2. **Update environment variable** in all environments
3. **Test configuration** with diagnostic procedures
4. **Restart application** to load new key
5. **Monitor logs** for any issues
6. **Revoke old key** from OpenAI dashboard after confirmation

### Environment Setup Verification

**Daily Check Script:**

```bash
#!/bin/bash
# ai-config-check.sh

echo "=== AI Configuration Check ==="

# Check environment
echo "Environment: $NODE_ENV"

# Check API key (masked)
if [ -n "$GEMINI_API_KEY" ]; then
    echo "API Key: Set (length: ${#GEMINI_API_KEY})"
    echo "Prefix: ${GEMINI_API_KEY:0:5}..."
else
    echo "API Key: NOT SET"
fi

# Validate format
if [[ "$GEMINI_API_KEY" =~ ^AIzaSy[a-zA-Z0-9]{33}$ ]]; then
    echo "Format: VALID"
else
    echo "Format: INVALID"
fi

echo "=== Check Complete ==="
```

### Monitoring and Alerts

**Key Metrics to Monitor:**

- API key validation success rate
- AI service response times
- Rate limit hits
- Authentication failures

**Alert Thresholds:**

- API key validation failures > 0 (immediate alert)
- AI service errors > 5% of requests (warning)
- Rate limit exceeded > 10 times/hour (warning)

## Emergency Procedures

### Complete AI Service Outage

1. **Immediate:** Disable AI features via feature flag
2. **Fallback:** Ensure standard PDF processing still works
3. **Communication:** Notify users of temporary AI feature unavailability
4. **Investigation:** Check API key validity and OpenAI service status
5. **Recovery:** Restore API key or implement alternative AI service

### Security Incident Response

1. **Contain:** Immediately rotate compromised API key
2. **Investigate:** Review access logs for unauthorized usage
3. **Monitor:** Watch for unusual API usage patterns
4. **Report:** Follow incident response procedures for security events

## Configuration Reference

### Environment Variables

| Variable         | Required                           | Default       | Description                    |
| ---------------- | ---------------------------------- | ------------- | ------------------------------ |
| `NODE_ENV`       | No                                 | `development` | Environment mode               |
| `GEMINI_API_KEY` | Production: Yes<br>Development: No | -             | Gemini API key for AI features |

### Configuration Files

- `.env` - Local environment variables
- `src/config/aiConfig.js` - AI configuration validation logic
- `docker-compose.yml` - Container environment setup

## Support and Escalation

### Internal Support

- **Dev Team:** For code-related issues
- **DevOps:** For environment and deployment issues
- **Security Team:** For API key security concerns

### External Resources

- **OpenAI Status:** https://status.openai.com
- **OpenAI Documentation:** https://platform.openai.com/docs
- **API Key Management:** https://platform.openai.com/api-keys

## Revision History

| Date       | Version | Changes                       | Author   |
| ---------- | ------- | ----------------------------- | -------- |
| 2025-11-21 | 1.0     | Initial troubleshooting guide | Dev Team |
