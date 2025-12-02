# MCP AI Sanitizer API Documentation

## Overview

The MCP AI Sanitizer provides a comprehensive REST API for content sanitization, document processing, and trust token management. This API is specifically designed to support autonomous security agents with both synchronous and asynchronous processing modes.

## Quick Start for Agents

### Authentication

Agents can authenticate using:

- **X-Agent-Key header**: `X-Agent-Key: agent-security-123`
- **X-API-Key header**: `X-API-Key: agent-monitor-456`
- **User-Agent string**: `User-Agent: BMad-Agent/1.0`

### Synchronous Mode (Recommended for Agents)

Agents automatically use synchronous processing. For manual override:

```bash
curl -X POST "https://api.mcp-sanitizer.com/api/sanitize/json?sync=true" \
  -H "X-Agent-Key: agent-security-123" \
  -H "Content-Type: application/json" \
  -d '{"content": "Content to sanitize"}'
```

### Key Endpoints for Agents

#### Content Sanitization

- **POST** `/api/sanitize/json` - Sanitize content with trust tokens
- **POST** `/api/sanitize` - Basic text sanitization

#### Document Processing

- **POST** `/api/documents/upload` - Upload and sanitize PDFs
- **POST** `/api/documents/generate-pdf` - Generate clean PDFs

#### Trust Token Management

- **POST** `/api/trust-tokens/validate` - Validate trust tokens

##### Trust Token Validation

Validates a trust token for authenticity, expiration, and content integrity.

**Request:**

```json
{
  "contentHash": "a1b2c3d4...",
  "originalHash": "e5f6g7h8...",
  "sanitizationVersion": "1.0",
  "rulesApplied": ["unicode-normalization", "symbol-stripping"],
  "timestamp": "2024-01-01T12:00:00Z",
  "expiresAt": "2024-01-02T12:00:00Z",
  "signature": "hmac-sha256-signature..."
}
```

**Response (Valid):**

```json
{
  "valid": true,
  "message": "Trust token is valid"
}
```

**Response (Invalid):**

```json
{
  "valid": false,
  "message": "Trust token has expired"
}
```

**Error Codes:**

- `400` - Invalid token format
- `401` - Authentication required
- `403` - Invalid signature

##### JSON Output Schema Changes

The `/api/sanitize/json` endpoint now includes trust tokens in the response for cryptographic validation.

**Response Schema:**

```json
{
  "sanitizedData": "Cleaned content string",
  "trustToken": {
    "contentHash": "sha256-hash-of-sanitized-content",
    "originalHash": "sha256-hash-of-original-content",
    "sanitizationVersion": "1.0",
    "rulesApplied": ["unicode-normalization", "symbol-stripping", "escape-neutralization"],
    "timestamp": "2024-01-01T12:00:00.000Z",
    "expiresAt": "2024-01-02T12:00:00.000Z",
    "signature": "hmac-sha256-signature-for-verification"
  },
  "metadata": {
    "originalLength": 1000,
    "sanitizedLength": 950,
    "processingTimeMs": 45
  }
}
```

**Validation Rules:**

- `contentHash`: SHA-256 of sanitized content
- `originalHash`: SHA-256 of original content
- `rulesApplied`: Array of sanitization rules used
- `signature`: HMAC-SHA256 using TRUST_TOKEN_SECRET
- `expiresAt`: Token valid for 24 hours from creation

#### Async Job Management (when needed)

- **GET** `/api/jobs/{taskId}/status` - Check job progress
- **GET** `/api/jobs/{taskId}/result` - Get completed results

## OpenAPI Specification

The complete API specification is available in `openapi-spec.yaml` and includes:

- Detailed endpoint documentation
- Request/response schemas
- Authentication requirements
- Example requests and responses
- Error handling specifications

## Agent Integration Features

### Automatic Sync Mode

Agents are automatically detected and routed to synchronous processing for <100ms response times.

### Trust Token Reuse

Content that has already been sanitized can be reused without re-processing, significantly improving performance.

### Comprehensive Monitoring

Built-in audit logging and performance metrics for all operations.

## Development

### Viewing the API Documentation

```bash
# Using Swagger UI
npx swagger-ui-dist

# Or use any OpenAPI viewer
# The spec follows OpenAPI 3.0.3 standard
```

### Generating Client SDKs

```bash
# Generate TypeScript client
npx openapi-typescript-codegen --input openapi-spec.yaml --output ./client

# Generate Python client
npx openapi-generator-cli generate -i openapi-spec.yaml -g python -o ./python-client
```

## Support

For API integration questions or issues, refer to the OpenAPI specification or contact the development team.
