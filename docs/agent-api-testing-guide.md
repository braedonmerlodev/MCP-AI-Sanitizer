# 🔬 Agent API Testing Guide - Postman Collection

This comprehensive guide contains all the Postman requests needed to test the APIs that the autonomous security agent depends on. Based on `agent-architecture.md` and `agent-implementation.md`.

## 📋 Setup Instructions

**Base URL**: `http://localhost:3000` (update for production)
**Global Headers**: `Content-Type: application/json`

### Environment Variables

Set these in your Postman environment:

- `base_url`: `http://localhost:3000`
- `trust_token`: (generated from first request)
- `task_id`: (from async responses)
- `api_key`: (optional - for agent authentication if needed)

---

## 1. 🔐 Authentication & Token Generation

### Generate Initial Trust Token

```
Method: POST
URL: {{base_url}}/api/sanitize/json
Headers:
  Content-Type: application/json
Body:
{
  "content": "Sample content for token generation",
  "async": false
}
Expected: 200 with trustToken - SAVE THIS TOKEN for other requests (no existing token required)
```

### Basic Text Sanitization (No Trust Token)

```
Method: POST
URL: {{base_url}}/api/sanitize
Headers:
  Content-Type: application/json
Body:
{
  "data": "Content with <script>alert('xss')</script> and unicode: ñáéíóú"
}
Expected (200):
{
  "sanitizedData": "Content with and unicode: ñáéíóú"
}
```

```

---

## 2. 🧹 Content Sanitization APIs

### Basic Text Sanitization

```

Method: POST
URL: {{base_url}}/api/sanitize
Headers:
Content-Type: application/json
Body:
{
"data": "Content with <script>alert('xss')</script> and unicode: ñáéíóú"
}
Expected (200):
{
"sanitizedData": "Content with and unicode: ñáéíóú"
}

```

### JSON Sanitization (Synchronous)

```

Method: POST
URL: {{base_url}}/api/sanitize/json
Headers:
Content-Type: application/json
x-trust-token: {{trust_token}}
Body:
{
"content": "Malicious content: <script>alert('hacked')</script>",
"async": false
}
Expected (200):
{
"sanitizedContent": "Malicious content: ",
"trustToken": {...},
"metadata": {...}
}

```

### JSON Sanitization (Asynchronous)

```

Method: POST
URL: {{base_url}}/api/sanitize/json
Headers:
Content-Type: application/json
x-trust-token: {{trust_token}}
Body:
{
"content": "Large content for async processing that may take time...",
"async": true
}
Expected (202):
{
"taskId": "1234567890123",
"status": "processing",
"estimatedTime": 5000
}

```

---

## 3. 🔒 Trust Token Validation

### Validate Trust Token

```

Method: POST
URL: {{base_url}}/api/trust-tokens/validate
Headers:
Content-Type: application/json
Body: {{trust_token}}
Expected (200):
{
"valid": true,
"message": "Trust token is valid"
}

```

### Test Invalid Token

```

Method: POST
URL: {{base_url}}/api/trust-tokens/validate
Headers:
Content-Type: application/json
Body:
{
"contentHash": "invalid-hash",
"signature": "invalid-signature"
}
Expected (400):
{
"valid": false,
"error": "Invalid signature"
}

```

---

## 4. 📄 Document Processing APIs

### PDF Upload (Synchronous)

```

Method: POST
URL: {{base_url}}/api/documents/upload?sync=true
Headers:
x-trust-token: {{trust_token}}
Body: form-data
pdf: [Select PDF file]
Expected (200):
{
"message": "PDF uploaded and processed successfully",
"fileName": "filename.pdf",
"size": 12345,
"metadata": {...},
"status": "processed",
"sanitizedContent": "Extracted and sanitized text...",
"trustToken": {...}
}

```

### PDF Upload (Asynchronous)

```

Method: POST
URL: {{base_url}}/api/documents/upload
Headers:
x-trust-token: {{trust_token}}
Body: form-data
pdf: [Select large PDF file]
Expected (202):
{
"taskId": "1234567890123",
"status": "processing",
"estimatedTime": 10000
}

```

### Generate Clean PDF

```

Method: POST
URL: {{base_url}}/api/documents/generate-pdf
Headers:
Content-Type: application/json
x-trust-token: {{trust_token}}
Body:
{
"data": "Clean content for PDF generation",
"trustToken": {{trust_token}},
"metadata": {
"title": "Generated PDF",
"author": "Security Agent"
}
}
Expected (200): [Binary PDF data]

```

---

## 5. ⚙️ Async Job Management

### Check Job Status

```

Method: GET
URL: {{base_url}}/api/jobs/{{task_id}}/status
Headers: (none)
Expected (200):
{
"taskId": "1234567890123",
"status": "processing|completed|failed|cancelled",
"progress": 75,
"message": "Processing...",
"createdAt": "2025-11-16T00:00:00.000Z",
"updatedAt": "2025-11-16T00:00:00.000Z"
}

```

### Get Job Result

```

Method: GET
URL: {{base_url}}/api/jobs/{{task_id}}/result
Headers: (none)
Expected (200):
{
"taskId": "1234567890123",
"status": "completed",
"result": {
"sanitizedContent": "...",
"trustToken": {...},
"metadata": {...}
},
"completedAt": "2025-11-16T00:00:00.000Z"
}

```

### Cancel Job

```

Method: DELETE
URL: {{base_url}}/api/jobs/{{task_id}}
Headers: (none)
Expected (200):
{
"taskId": "1234567890123",
"status": "cancelled",
"message": "Job cancelled successfully"
}

```

---

## 6. 📊 Monitoring & Learning APIs

### Get System Statistics

```

Method: GET
URL: {{base_url}}/api/monitoring/reuse-stats
Headers:
x-trust-token: {{trust_token}}
Expected (200):
{
"timestamp": "2025-11-16T00:00:00.000Z",
"summary": {
"totalRequests": 150,
"cacheHits": 120,
"cacheMisses": 30,
"sanitizationOperations": 45,
"validationFailures": 3
},
"performance": {
"cacheHitRate": "80.00%",
"failureRate": "2.00%",
"averageValidationTimeMs": "15.50",
"averageSanitizationTimeMs": "25.30",
"averageTimeSavedPerRequestMs": "10.20",
"totalTimeSavedMs": 1530
},
"health": {
"validationSuccessRate": "98.00%",
"lastUpdated": "2025-11-16T00:00:00.000Z",
"status": "healthy"
}
}

```

### Export Training Data

```

Method: POST
URL: {{base_url}}/api/export/training-data
Headers:
x-trust-token: {{trust_token}}
Body:
{
"format": "json"
}
Expected (200): [Binary file - JSON/CSV/Parquet]

```

---

## 7. 🩺 Health & Security Tests

### Health Check

```

Method: GET
URL: {{base_url}}/health
Headers: (none)
Expected (200):
{
"status": "healthy",
"timestamp": "2025-11-16T00:00:00.000Z"
}

```

### Security Test - Invalid Request Body

```

Method: GET
URL: {{base_url}}/health
Headers: (none)
Body:
{
"data": "Malicious content that should be rejected"
}
Expected (400):
{
"error": "Request validation failed",
"details": [
{
"field": "data",
"message": "\"data\" is not allowed"
}
]
}

```

---

## 🧪 Testing Workflow

### Phase 1: Basic Functionality

1. Health check ✅
2. Generate trust token ✅
3. Basic sanitization ✅
4. Trust token validation ✅

### Phase 2: Async Operations

5. Async sanitization (submit) ✅
6. Poll job status ✅
7. Get job result ✅
8. Cancel job ✅

### Phase 3: Document Processing

9. PDF upload (sync) ✅
10. PDF upload (async) ✅
11. PDF generation ✅

### Phase 4: Monitoring

12. System statistics ✅
13. Training data export ✅

### Phase 5: Security Validation

14. Invalid requests rejected ✅
15. Malicious content blocked ✅

---

## 📊 Success Criteria

- [ ] All APIs return expected status codes
- [ ] Trust tokens work correctly
- [ ] Async workflows complete successfully
- [ ] Invalid requests are rejected (400/403)
- [ ] No malicious content is echoed back
- [ ] Binary responses work (PDFs, exports)
- [ ] Monitoring data is accessible

## 🚨 Critical Checks

1. **Security**: Invalid requests return 400, not the malicious content
2. **Async**: Jobs progress from processing → completed
3. **Tokens**: Valid tokens accepted, invalid rejected
4. **Files**: PDF upload and generation work
5. **Monitoring**: Statistics accessible with API key

---

_Generated for MCP-Security Agent API Testing - Version 1.0_</content>
<parameter name="filePath">docs/agent-api-testing-guide.md
```
