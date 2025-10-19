# Components

## ProxySanitizer

**Responsibility:** Acts as the main entry point, intercepting requests from clients (e.g., n8n), routing them through the sanitization pipeline, validating provenance, and forwarding to LLMs/MCP servers.

**Key Interfaces:**

- /sanitize (POST) - Receives input data for sanitization
- /health (GET) - Health check endpoint

**Dependencies:** SanitizationPipeline, ProvenanceValidator, AuditLogger

**Technology Stack:** Node.js with Express.js for API handling, integrated with Azure Functions for deployment
