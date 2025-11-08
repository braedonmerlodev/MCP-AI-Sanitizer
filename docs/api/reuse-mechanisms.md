# Trust Token Reuse Mechanisms API

## Overview

The JSON Sanitization API supports trust token reuse mechanisms that allow clients to avoid redundant sanitization operations for content that has already been processed. This feature provides significant performance improvements while maintaining security guarantees.

## Key Benefits

- **Performance**: Up to 50% reduction in processing time for repeated requests
- **Security**: Cryptographic validation ensures content integrity
- **Efficiency**: Reduced server load and improved response times
- **Compatibility**: Optional feature that doesn't break existing API contracts

## API Endpoint

### POST /api/sanitize/json

Enhanced JSON sanitization endpoint with trust token reuse support.

## Request Format

```json
{
  "content": "string", // Required: The content to sanitize
  "classification": "string", // Optional: Content classification (llm, api, etc.)
  "trustToken": {
    // Optional: Trust token for reuse
    "contentHash": "string", // SHA256 hash of sanitized content
    "originalHash": "string", // SHA256 hash of original content
    "sanitizationVersion": "string", // Version of sanitization rules used
    "rulesApplied": ["string"], // Array of sanitization rules applied
    "timestamp": "string", // ISO 8601 timestamp of sanitization
    "expiresAt": "string", // ISO 8601 expiration timestamp
    "signature": "string" // HMAC-SHA256 signature for tamper prevention
  }
}
```

## Response Format

### Successful Sanitization (New Content)

```json
{
  "sanitizedContent": "string", // The sanitized content
  "trustToken": {
    // Generated trust token for future reuse
    "contentHash": "string",
    "originalHash": "string",
    "sanitizationVersion": "string",
    "rulesApplied": ["string"],
    "timestamp": "string",
    "expiresAt": "string",
    "signature": "string"
  },
  "metadata": {
    "originalLength": 1234, // Original content length
    "sanitizedLength": 1234, // Sanitized content length
    "timestamp": "2025-11-08T22:20:52.834Z",
    "reused": false, // Indicates if reuse occurred
    "performance": {
      "totalTimeMs": 25.5 // Total processing time
    }
  }
}
```

### Successful Reuse

```json
{
  "sanitizedContent": "string", // Previously sanitized content
  "trustToken": {
    // Original trust token
    "contentHash": "string",
    "originalHash": "string",
    "sanitizationVersion": "string",
    "rulesApplied": ["string"],
    "timestamp": "string",
    "expiresAt": "string",
    "signature": "string"
  },
  "metadata": {
    "originalLength": 1234,
    "sanitizedLength": 1234,
    "timestamp": "2025-11-08T22:20:52.834Z",
    "reused": true, // Indicates successful reuse
    "performance": {
      "totalTimeMs": 2.1, // Much faster processing
      "tokenValidationTimeMs": 1.8,
      "timeSavedMs": 23.4 // Estimated time saved
    }
  }
}
```

## Usage Examples

### Basic Sanitization (No Reuse)

```javascript
const response = await fetch('/api/sanitize/json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: '{"message": "Hello <script>alert(\\"xss\\")</script> World"}',
    classification: 'llm',
  }),
});

const result = await response.json();
// result.trustToken can be saved for future reuse
```

### Content Reuse

```javascript
// First request - get trust token
const firstResponse = await fetch('/api/sanitize/json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: '{"data": "some content to sanitize"}',
  }),
});

const firstResult = await firstResponse.json();
const trustToken = firstResult.trustToken;

// Second request - reuse the trust token
const reuseResponse = await fetch('/api/sanitize/json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: '{"data": "some content to sanitize"}', // Same content
    trustToken: trustToken,
  }),
});

const reuseResult = await reuseResponse.json();
// reuseResult.metadata.reused will be true
// Processing will be ~50% faster
```

### Error Handling

```javascript
try {
  const response = await fetch('/api/sanitize/json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'invalid json content',
      trustToken: invalidToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Sanitization failed:', error.error);
  } else {
    const result = await response.json();
    // Handle successful response
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## Trust Token Validation

### GET /api/trust-tokens/validate

Endpoint to validate trust tokens independently.

**Request:**

```json
{
  "contentHash": "string",
  "originalHash": "string",
  "sanitizationVersion": "string",
  "rulesApplied": ["string"],
  "timestamp": "string",
  "expiresAt": "string",
  "signature": "string"
}
```

**Response:**

```json
{
  "valid": true,
  "message": "Trust token is valid"
}
```

## Monitoring and Statistics

### GET /api/monitoring/reuse-stats

Access comprehensive reuse mechanism statistics (requires strict access control).

**Response:**

```json
{
  "timestamp": "2025-11-08T22:20:52.834Z",
  "summary": {
    "totalRequests": 1000,
    "cacheHits": 750,
    "cacheMisses": 250,
    "sanitizationOperations": 250,
    "validationFailures": 5
  },
  "performance": {
    "cacheHitRate": "75.00%",
    "failureRate": "0.50%",
    "averageValidationTimeMs": "1.25",
    "averageSanitizationTimeMs": "25.50",
    "averageTimeSavedPerRequestMs": "22.50",
    "totalTimeSavedMs": 16875
  },
  "health": {
    "validationSuccessRate": "99.50%",
    "lastUpdated": "2025-11-08T22:20:52.834Z",
    "status": "healthy"
  }
}
```

## Security Considerations

### Trust Token Security

- **Cryptographic Validation**: All trust tokens are validated using HMAC-SHA256 signatures
- **Expiration**: Tokens expire after 1 hour by default
- **Tamper Prevention**: Any modification to token contents invalidates the signature
- **Content Verification**: Content hash ensures the reused content matches the original

### Best Practices

1. **Token Storage**: Store trust tokens securely and associate them with specific content
2. **Expiration Handling**: Implement token refresh logic for expired tokens
3. **Error Handling**: Always handle validation failures gracefully
4. **Performance Monitoring**: Monitor cache hit rates and performance improvements

### Security Headers

The API includes security headers for trust token responses:

```
X-Trust-Token-Status: embedded|validated
X-PDF-Validation: quality_score (for PDF generation)
```

## Performance Characteristics

### Expected Performance Improvements

- **Cache Hit Rate**: 70-90% for typical workloads
- **Time Savings**: 40-60% reduction in response time for cache hits
- **Throughput**: 2-3x improvement for high-frequency repeated requests

### Benchmarks

Based on internal testing with various content sizes:

| Content Size     | Avg Sanitization Time | Avg Reuse Time | Time Saved |
| ---------------- | --------------------- | -------------- | ---------- |
| Small (< 1KB)    | 5-10ms                | 1-2ms          | 80-85%     |
| Medium (1-10KB)  | 15-25ms               | 2-4ms          | 75-85%     |
| Large (10-100KB) | 50-100ms              | 5-10ms         | 85-90%     |

## Error Codes

### HTTP Status Codes

- `200`: Success (sanitization completed or reuse successful)
- `400`: Bad Request (invalid input parameters)
- `403`: Forbidden (access denied, trust token required)
- `500`: Internal Server Error (sanitization failed)

### Common Error Messages

- `"Trust token required"`: Access validation middleware requires trust token header
- `"Invalid trust token"`: Token validation failed
- `"content_hash_mismatch"`: Provided content doesn't match token hash
- `"Sanitization failed"`: General sanitization error

## Migration Guide

### For Existing Clients

The reuse mechanism is **optional** and backward compatible:

1. **No Changes Required**: Existing clients continue to work without modification
2. **Opt-in Reuse**: Add `trustToken` parameter to enable reuse benefits
3. **Token Management**: Implement token storage and retrieval logic

### Implementation Steps

1. **Initial Request**: Make sanitization request without trust token
2. **Store Token**: Save the returned `trustToken` with the content
3. **Reuse Requests**: Include stored token in subsequent requests for same content
4. **Handle Expiry**: Refresh tokens when they expire (410 status)

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Ensure trust token header is provided if middleware is active
2. **Reuse Not Working**: Verify content hash matches exactly
3. **Performance Not Improved**: Check if content is actually being reused (metadata.reused)

### Debug Information

Enable debug logging to see reuse decisions:

```javascript
// Check metadata.reused flag
if (result.metadata.reused) {
  console.log('Content reused, saved', result.metadata.performance.timeSavedMs, 'ms');
} else {
  console.log('Content sanitized normally');
}
```

## Version History

- **v1.0.0**: Initial implementation with basic reuse functionality
- **v1.1.0**: Enhanced performance monitoring and statistics
- **v1.2.0**: Improved security validations and audit logging
