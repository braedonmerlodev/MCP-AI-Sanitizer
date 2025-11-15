# Async Processing Migration Guide

## Overview

Story 13.2 introduces asynchronous processing for sanitization endpoints to prevent API timeouts for large files (>10MB) or long-running operations (>5 seconds). This guide helps clients migrate to the new async behavior.

## Changes Summary

### Affected Endpoints

1. **POST /api/documents/upload**
   - Now auto-detects async conditions (file size >10MB)
   - Returns `{taskId: string, status: "processing"}` for async processing
   - Maintains existing sync response format for small files

2. **POST /api/sanitize/json**
   - Added optional `async: boolean` parameter (defaults to false)
   - When `async: true`, returns `{taskId: string, status: "processing"}`
   - Sync behavior unchanged when `async: false` or omitted

3. **GET /api/jobs/{taskId}** (New)
   - Poll for async job status and results
   - Returns job status, result data, or error information

## Migration Steps

### 1. Update Client Code

#### For PDF Uploads

```javascript
// Before (sync only)
const response = await fetch('/api/documents/upload', {
  method: 'POST',
  body: formData,
});
const result = await response.json(); // Direct result

// After (handle async)
const response = await fetch('/api/documents/upload', {
  method: 'POST',
  body: formData,
});
const data = await response.json();

if (data.taskId) {
  // Async processing - poll for results
  const result = await pollJobStatus(data.taskId);
} else {
  // Sync processing - use result directly
  const result = data;
}
```

#### For JSON Sanitization

```javascript
// Before (sync only)
const response = await fetch('/api/sanitize/json', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'large content' }),
});
const result = await response.json();

// After (force async for large content)
const response = await fetch('/api/sanitize/json', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'large content', async: true }),
});
const data = await response.json();

if (data.taskId) {
  const result = await pollJobStatus(data.taskId);
} else {
  const result = data;
}
```

### 2. Implement Polling Logic

```javascript
async function pollJobStatus(taskId, maxAttempts = 30, interval = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`/api/jobs/${taskId}`);
    const status = await response.json();

    if (status.status === 'completed') {
      return status.result;
    } else if (status.status === 'failed') {
      throw new Error(status.error || 'Processing failed');
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('Job polling timeout');
}
```

### 3. Handle Webhook Notifications (Optional)

If webhooks are configured, clients can receive completion notifications instead of polling:

```javascript
// Configure webhook URL in request headers
const response = await fetch('/api/sanitize/json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-URL': 'https://your-app.com/webhooks/sanitization-complete',
  },
  body: JSON.stringify({ content, async: true }),
});
```

## API Versioning

All responses now include API versioning headers:

```
X-API-Version: 1.1
X-Async-Processing: true/false
```

## Backward Compatibility

- Existing synchronous calls work unchanged
- No breaking changes for current clients
- Async behavior is opt-in or auto-detected

## Testing

Test your integration with:

1. Small files (<10MB) - should process synchronously
2. Large files (>10MB) - should process asynchronously
3. Explicit async parameter - should force async processing
4. Error scenarios - handle failed jobs gracefully

## Support

For migration assistance, contact the development team or refer to the updated API documentation.
