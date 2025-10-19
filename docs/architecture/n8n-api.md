# n8n API

- **Purpose:** Enable seamless integration with n8n for calling agentic AI systems through the sanitizer proxy.
- **Documentation:** https://docs.n8n.io/
- **Base URL(s):** N/A (webhook-based integration)
- **Authentication:** API key or webhook token
- **Rate Limits:** N/A (depends on n8n instance)

**Key Endpoints Used:**

- POST /webhook/n8n - Receives data from n8n for sanitization and forwards to LLMs

**Integration Notes:** Sanitization applied transparently; responses returned to n8n workflow.

## Architectural and Design Patterns

- **Proxy Pattern:** Intercepts requests between clients and services for sanitization - _Rationale:_ Enables transparent security without modifying LLMs/MCP, aligning with PRD's in-line proxy requirement.
- **Pipeline Pattern:** Processes data through sequential sanitization steps - _Rationale:_ Ensures modular, testable stages for obfuscation handling, supporting MVP's multi-layered approach.
- **Repository Pattern:** Abstracts data access for logs and audits - _Rationale:_ Enables future database migration and testing flexibility, fitting PRD's audit logging needs.
