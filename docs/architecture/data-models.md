# Data Models

## SanitizationEvent

**Purpose:** Represents each sanitization action performed by the proxy, enabling audit logging and provenance tracking for compliance and debugging.

**Key Attributes:**

- id: string - Unique identifier for the event
- timestamp: datetime - When the sanitization occurred
- requestId: string - Correlation ID linking input and output
- inputData: string - Original data before sanitization
- outputData: string - Data after sanitization
- actionsTaken: array - List of sanitization steps applied (e.g., normalization, stripping)
- provenanceValidated: boolean - Whether provenance check passed
- error: string - Any error message if sanitization failed

**Relationships:**

- None for MVP (self-contained for logging)

## ValidationResult

**Purpose:** Records the outcome of data integrity validation checks performed on processed content.

**Key Attributes:**

- id: string - Unique identifier for the validation result
- timestamp: datetime - When validation was performed
- dataId: string - Reference to the sanitized data record
- validationType: string - Type of validation (schema, referential, atomic)
- status: enum - PASS, FAIL, WARNING
- details: object - Specific validation details (errors, warnings, metadata)
- hashReference: string - Cryptographic hash linking to raw data

**Relationships:**

- References SanitizationEvent via dataId

## ErrorQueue

**Purpose:** Stores records that failed validation for manual review and error routing.

**Key Attributes:**

- id: string - Unique identifier for the error record
- timestamp: datetime - When the error was queued
- dataId: string - Reference to the problematic data
- errorType: string - Category of error (schema, referential, null_value)
- errorDetails: object - Detailed error information
- retryCount: integer - Number of retry attempts
- status: enum - QUEUED, PROCESSING, RESOLVED, ABANDONED

**Relationships:**

- References ValidationResult via dataId

## AuditLog

**Purpose:** Comprehensive audit trail for all data integrity operations and access.

**Key Attributes:**

- id: string - Unique identifier for the audit entry
- timestamp: datetime - When the audited action occurred
- userId: string - Identifier of the user/system performing the action
- action: string - Type of action (validate, access_raw, modify)
- resourceId: string - ID of the resource affected
- details: object - Additional context about the action
- ipAddress: string - IP address of the requestor
- userAgent: string - User agent string

**Relationships:**

- Can reference multiple data models via resourceId

## HashReference

**Purpose:** Cryptographic linkage between sanitized and raw data for integrity verification.

**Key Attributes:**

- id: string - Unique identifier for the hash reference
- dataId: string - Reference to the sanitized data record
- rawDataHash: string - SHA-256 hash of the original raw data
- sanitizedDataHash: string - SHA-256 hash of the sanitized data
- timestamp: datetime - When the hash was generated
- algorithm: string - Hash algorithm used (default: SHA-256)

**Relationships:**

- Stored alongside processed data for lineage tracking
