# System Integration Analysis

## Overview

The Obfuscation-Aware Sanitizer Agent API provides comprehensive data sanitization and trust token management for AI agentic systems. The system integrates multiple components to ensure secure, validated data processing.

## Key Integration Points

### 1. Data Sanitization Pipeline

- **Primary Endpoint**: `/api/sanitize/json`
- **Function**: Sanitizes JSON content with trust token generation
- **Dependencies**:
  - Joi for input validation
  - Custom sanitization logic
  - Trust token generator
- **Integration**: Accepts content, validates, sanitizes, generates cryptographic trust token

### 2. Document Processing

- **Primary Endpoint**: `/documents/upload`
- **Function**: Upload and process PDF documents
- **Dependencies**:
  - PDF parsing libraries
  - File validation
  - Sanitization pipeline
- **Integration**: Handles multipart uploads, processes PDFs, returns sanitized content with trust tokens

### 3. Trust Token Validation

- **Primary Endpoint**: `/api/trust-tokens/validate`
- **Function**: Validates trust tokens for authenticity
- **Dependencies**:
  - Cryptographic verification
  - Token parsing
  - Expiration checking
- **Integration**: Verifies HMAC signatures, checks timestamps, confirms content integrity

### 4. n8n Webhook Integration

- **Primary Endpoint**: `/webhook/n8n`
- **Function**: Handles n8n webhook with automatic sanitization
- **Dependencies**:
  - n8n workflow triggers
  - Automatic sanitization
  - Response formatting
- **Integration**: Receives data from n8n, processes through sanitization pipeline, returns results

### 5. Training Data Export

- **Primary Endpoint**: `/api/export/training-data`
- **Function**: Exports high-fidelity training data
- **Dependencies**:
  - Database access
  - Data filtering
  - Multiple format support (JSON, CSV, Parquet)
- **Integration**: Authenticates via trust token, filters data, exports in requested format

## System Dependencies

### Core Framework

- **Express.js 4.18.2**: Web framework for API endpoints
- **Node.js 20.11.0+**: Runtime environment

### Security & Validation

- **Joi 17.11.0**: Input validation and schema enforcement
- **Helmet.js**: Security headers
- **Rate limiting**: 100 requests per minute per IP

### Data Management

- **SQLite 3.43.0**: Embedded database for logs and audits
- **SQLCipher**: Encryption at rest
- **Winston 3.11.0**: Structured logging

### External Integrations

- **Azure Blob Storage**: Log storage
- **Azure Application Insights**: Monitoring
- **Azure Key Vault**: Secrets management
- **Azure AD**: Authentication

## Data Flow Architecture

### Input Processing Flow

1. Request received at API endpoint
2. Input validation via Joi schemas
3. Rate limiting check
4. Content sanitization
5. Trust token generation
6. Response formatting
7. Logging and audit trail

### Trust Token Flow

1. Original content hashed (SHA-256)
2. Sanitized content processed
3. Trust token created with:
   - Content hash
   - Original hash
   - Sanitization version
   - Applied rules
   - Timestamp and expiration
   - HMAC signature
4. Token returned with sanitized data

### Error Handling Flow

1. Validation failures → 400 Bad Request
2. Rate limit exceeded → 429 Too Many Requests
3. Server errors → 500 Internal Server Error
4. All errors logged with Winston

## Integration Diagrams

### High-Level System Flow

```
Client Request → API Endpoint → Validation → Sanitization → Trust Token → Response
                      ↓
                Logging/Audit
```

### Trust Token Validation Flow

```
Validate Request → Parse Token → Verify Signature → Check Expiration → Confirm Hashes → Valid/Invalid Response
```

## Critical Integration Points

- All endpoints require proper input validation
- Trust tokens must be validated before processing sensitive operations
- Logging must capture all sanitization activities
- Rate limiting prevents abuse
- HTTPS enforcement for all communications
