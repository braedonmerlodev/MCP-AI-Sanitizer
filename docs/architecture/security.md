# Security

## Input Validation

- **Validation Library:** Joi 17.11.0
- **Validation Location:** At API boundary before processing
- **Required Rules:**
  - All external inputs MUST be validated
  - Validation at API boundary before processing
  - Whitelist approach preferred over blacklist

## Authentication & Authorization

- **Auth Method:** API key authentication for n8n integrations
- **Session Management:** Stateless with API keys
- **Required Patterns:**
  - API key in header for all requests
  - No user sessions for backend-only app

## Secrets Management

- **Development:** Environment variables in .env
- **Production:** Azure Key Vault for secure storage
- **Code Requirements:**
  - NEVER hardcode secrets
  - Access via configuration service only
  - No secrets in logs or error messages

## API Security

- **Rate Limiting:** 100 requests per minute per IP
- **CORS Policy:** Disabled for backend API
- **Security Headers:** Helmet.js for standard headers
- **HTTPS Enforcement:** Required for all endpoints

## Data Protection

- **Encryption at Rest:** SQLite with SQLCipher for sensitive logs
- **Encryption in Transit:** TLS 1.3 for all communications
- **PII Handling:** Redact in logs and responses
- **Logging Restrictions:** No sensitive data in logs

## Dependency Security

- **Scanning Tool:** Snyk for vulnerability scanning
- **Update Policy:** Weekly dependency updates
- **Approval Process:** Automated PR for security fixes

## Security Testing

- **SAST Tool:** ESLint-security plugin for static analysis
- **DAST Tool:** OWASP ZAP for dynamic scanning
- **Penetration Testing:** Not for MVP
