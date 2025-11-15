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
