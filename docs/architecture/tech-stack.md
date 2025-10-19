# Tech Stack

## Cloud Infrastructure

- **Provider:** Azure
- **Key Services:** Azure Functions for hosting the proxy, Blob Storage for log storage, Application Insights for monitoring, Azure AD for security
- **Deployment Regions:** eastus

## Technology Stack Table

| Category         | Technology     | Version | Purpose                               | Rationale                                                                                     |
| ---------------- | -------------- | ------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Language         | Node.js        | 20.11.0 | Primary development language          | LTS version for stability, excellent ecosystem for API development and sanitization libraries |
| Runtime          | Node.js        | 20.11.0 | JavaScript runtime                    | Matches language choice, proven for high-throughput proxy applications                        |
| Framework        | Express.js     | 4.18.2  | Backend framework for API endpoints   | Lightweight, middleware-friendly for proxy implementation, aligns with PRD's API needs        |
| Database         | SQLite         | 3.43.0  | Embedded database for logs and audits | Simple for MVP, no external setup required, sufficient for audit logging                      |
| Containerization | Docker         | 24.0.7  | Container platform                    | Enables easy deployment and isolation, as per PRD technical assumptions                       |
| IaC              | Azure Bicep    | 0.22.6  | Infrastructure as Code                | Declarative Azure resource management, integrates with Node.js                                |
| Logging          | Winston        | 3.11.0  | Logging library                       | Structured logging for audits, supports PRD's security and compliance needs                   |
| Validation       | Joi            | 17.11.0 | Input validation                      | Schema-based validation for API security, prevents injection attacks                          |
| Testing          | Jest           | 29.7.0  | Unit testing framework                | Mature, integrates well with Node.js for PRD's unit + integration testing                     |
| CI/CD            | GitHub Actions | N/A     | Pipeline automation                   | Free for open source, simple setup for MVP deployment                                         |
