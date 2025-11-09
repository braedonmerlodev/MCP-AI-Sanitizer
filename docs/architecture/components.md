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

## AuditLogger

**Responsibility:** Provides comprehensive audit logging for all data integrity operations, with specialized support for high-risk case logging optimized for AI/ML training.

**Key Interfaces:**

- logOperation(operation, details, context) - Logs general data integrity operations
- logValidation(validationResult, context) - Logs validation outcomes
- logRiskAssessmentDecision(decisionType, riskLevel, assessmentParameters, context) - Logs risk assessment decisions
- logHighRiskCase(metadata, mlFields) - Logs high-level risk cases with ML-optimized fields (threat patterns, confidence scores, mitigation actions, feature vectors, training labels, anomaly scores)
- logUnknownRiskCase(metadata, mlFields) - Logs unknown risk cases with ML-optimized fields for HITL review
- logRawDataAccess(resourceId, accessType, context) - Logs access to raw data (security-critical)
- getAuditEntries(filters) - Retrieves audit entries with filtering
- getAuditStats() - Returns audit statistics

**ML-Optimized Fields for High-Risk Cases:**

- threatPatternId: string - Identifier for detected threat pattern
- confidenceScore: float (0-1) - Confidence level of risk assessment
- mitigationActions: array - Recommended actions (e.g., ['block', 'alert'])
- featureVector: object - Structured risk indicators for ML consumption
- trainingLabels: object - Labels for supervised learning
- anomalyScore: float - Anomaly detection score
- detectionTimestamp: ISO string - When the risk was detected
- riskCategory: enum ('high' | 'unknown') - Risk category

**Dependencies:** Winston for logging, DataIntegrityValidator for validation context

**Technology Stack:** Node.js with Winston logging library, async processing for performance
