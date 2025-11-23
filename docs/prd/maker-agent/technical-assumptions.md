# Technical Assumptions

## Repository Structure: Monorepo

Single repository containing all microagents, voting logic, and orchestration components.

## Service Architecture

Microservices architecture where each microagent runs as an independent service with orchestration layer.

## Testing Requirements

Full Testing Pyramid - Unit tests for individual microagents, integration tests for voting consensus, end-to-end tests for complete task workflows.

## Additional Technical Assumptions and Requests

- Use TypeScript for type safety in microagent interfaces
- Implement Web Workers for parallel microagent execution
- Require Redis or similar for consensus state management
- Support both browser and Node.js execution environments
