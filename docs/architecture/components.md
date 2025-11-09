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
- logEscalationDecision(escalationData, context) - Logs HITL escalation decisions with trigger conditions and rationale
  - logHumanIntervention(outcomeData, metrics) - Logs human intervention outcomes with effectiveness metrics
  - logHighFidelityDataCollection(inputDataHash, processingSteps, decisionOutcome, contextMetadata, context) - Logs comprehensive data collection for AI training with structured features and validation
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

**HITL Escalation Fields:**

- escalationId: string - Unique identifier for the escalation event
- humanDecision: object - Human review decision details (decision, rationale, humanId)
- resolutionTime: number - Time taken for human resolution in milliseconds
- effectivenessScore: float (0-1) - Effectiveness score of the HITL intervention
- triggerConditions: array - Conditions that triggered the escalation
- decisionRationale: string - Rationale for escalation decision

**High-Fidelity Data Collection Fields for AI Training:**

- inputDataHash: string - SHA256 hash of input data for traceability without storing sensitive data
- processingSteps: array - List of processing steps applied (e.g., ['unicode_normalization', 'symbol_stripping'])
- decisionOutcome: object - Final decision with reasoning {decision: 'sanitized'|'bypass', reasoning: string, riskScore: float}
- featureVector: object - Structured features for ML models {inputLength, outputLength, processingTime, processingStepsCount, riskScore, decision, hasProcessingSteps}
- contextMetadata: object - Additional context {inputLength, outputLength, processingTime}

**Dependencies:** Winston for logging, DataIntegrityValidator for validation context

**Technology Stack:** Node.js with Winston logging library, async processing for performance
