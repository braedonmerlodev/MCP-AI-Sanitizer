# Components

## ProxySanitizer

**Responsibility:** Acts as the main entry point, intercepting requests from clients (e.g., n8n), routing them through the sanitization pipeline, validating provenance, and forwarding to LLMs/MCP servers.

**Key Interfaces:**

- /sanitize (POST) - Receives input data for sanitization
- /health (GET) - Health check endpoint

**Dependencies:** SanitizationPipeline, ProvenanceValidator, AuditLogger, DataIntegrityValidator

**Technology Stack:** Node.js with Express.js for API handling, integrated with Azure Functions for deployment

## DataIntegrityValidator

**Responsibility:** Provides comprehensive data integrity validation for all processed content, ensuring strict quality, auditability, and security standards in the sanitized data layer.

**Key Interfaces:**

- validateData(data) - Performs schema validation, referential integrity checks, and null value validation
- generateHash(data) - Creates cryptographic hash references for data lineage
- queueError(record) - Routes invalid records to error queue for manual review
- auditAccess(resourceId, action) - Logs all access to raw data and audit operations

**Sub-components:**

- SchemaValidator - Handles type/format checking and validation rules
- ReferentialChecker - Enforces referential integrity constraints
- CryptographicHasher - Manages hash generation and verification
- ErrorRouter - Handles error queuing and routing logic
- AuditLogger - Records all integrity-related operations

**Dependencies:** SanitizationPipeline (for validation hooks), TrustTokenSystem (for cryptographic lineage)

**Technology Stack:** Node.js with validation libraries (Joi), cryptographic modules (crypto), database access for audit logs
