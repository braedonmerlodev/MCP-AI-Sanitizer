# Technical Assumptions

## Repository Structure

Monorepo: Organize the sanitizer agent, API endpoints, and integration modules under a single repository for simplicity in the prototype.

## Service Architecture

Proxy-based architecture where the sanitizer acts as an intermediary layer between MCP servers and LLMs, with modular components for each sanitization step (e.g., normalization, stripping, validation).

## Testing Requirements

Unit + Integration: Include unit tests for individual sanitization functions and integration tests for end-to-end data flows, ensuring comprehensive coverage without full e2e for MVP.

## Additional Technical Assumptions and Requests

- Backend language: Node.js or Python for API endpoints and sanitization pipeline, leveraging libraries for Unicode normalization and pattern matching.
- Hosting: Cloud-based (e.g., AWS or GCP) for scalability, with containerization (Docker) for easy deployment.
- Security: Built-in features like encrypted data handling and audit logging; no external dependencies that could introduce vulnerabilities.
- Performance: Low-latency processing to avoid disrupting AI response times.
