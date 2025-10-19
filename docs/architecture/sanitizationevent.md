# SanitizationEvent

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
