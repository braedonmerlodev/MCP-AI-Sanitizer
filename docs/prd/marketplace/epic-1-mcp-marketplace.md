# MCP Marketplace & External Integration Epic

## Epic Overview

**Epic Title:** MCP Marketplace & External Integration

**Epic Goal:** Extend the current PDF sanitization application to connect with external Model Context Protocol (MCP) servers, allowing users to select and utilize external AI models for data processing.

**Business Value:**

- **Extensibility:** Users can leverage a wide range of external AI models and tools via the MCP standard.
- **Flexibility:** Users can switch between different MCP providers based on their specific needs (cost, performance, specialization).
- **Enhanced Processing:** Enables more sophisticated text transformation and sanitization capabilities provided by external servers.

**Success Criteria:**

- Users can view a list of available MCP servers in a "Marketplace" or "Connections" UI.
- Users can authenticate and connect to a chosen MCP service.
- Users can select an "active" MCP server for the data pipeline.
- The backend `ProxySanitizer` successfully forwards sanitized text to the selected MCP server.
- The response from the MCP server is received, sanitized, and stored as the final JSON output.
- The entire flow (PDF Upload -> MCP Processing -> Result) works without errors.

## Epic Stories

### Story 1.1: MCP Marketplace Frontend Interface

**As a** user,
**I want to** access a "Marketplace" or "Connections" interface,
**so that** I can view and manage my connections to external MCP servers.

**Acceptance Criteria:**
1.1: Create a new route/page in the frontend for "Marketplace" or "Connections".
1.2: Display a list of available MCP servers fetched from the Smithery Registry API.
1.3: Provide a "Connect" button for each server to handle authorization/authentication.
1.4: Allow the user to select one "active" MCP server to be used for data routing.
1.5: Persist the selection and connection details (securely).
1.6: Implement search functionality to filter servers by name or description.

**Priority:** High
**Estimate:** 8-12 hours
**Dependencies:** None

### Story 1.2: Backend MCP Configuration API

**As a** developer,
**I want to** implement API endpoints to store and retrieve MCP server configurations,
**so that** the frontend can save user preferences and the backend can access connection details.

**Acceptance Criteria:**
1.1: Design a data model (or config structure) to store MCP server details (URL, name, auth tokens, active status).
1.2: Create API endpoints to `GET` available/configured servers.
1.3: Create API endpoints to `POST/PUT` server configuration (connect/update).
1.4: Create API endpoint to `POST` the active server selection.
1.5: Ensure sensitive data (auth tokens) are stored securely (encrypted or environment variable references).
1.6: Implement a proxy endpoint to fetch the server list from Smithery Registry API (`https://registry.smithery.ai/servers`) to avoid CORS issues on the frontend.

**Priority:** High
**Estimate:** 4-6 hours
**Dependencies:** None

### Story 1.3: Implement Real MCP Integration in ProxySanitizer

**As a** backend developer,
**I want to** replace the mock `forwardToLLM` method in `src/components/proxy-sanitizer.js` with real MCP client logic using the Smithery connection flow,
**so that** data is actually sent to the external server.

**Acceptance Criteria:**
1.1: Modify `src/components/proxy-sanitizer.js`.
1.2: Implement `forwardToLLM(data)` to retrieve the currently active MCP server config.
1.3: Construct a valid HTTP/RPC request to the MCP server using the `sanitizedData`.
1.4: Handle network errors and timeouts gracefully.
1.5: Receive the response and return it for the next stage of the pipeline.
1.6: Implement the Smithery authentication flow (OAuth provider) as described in their documentation.

**Priority:** Critical
**Estimate:** 8-12 hours
**Dependencies:** Story 1.2

### Story 1.4: End-to-End Data Flow Integration

**As a** QA engineer,
**I want to** verify the complete data flow from PDF upload to final JSON storage using an external MCP server,
**so that** I can ensure the system works as expected.

**Acceptance Criteria:**
1.1: Verify PDF upload triggers the `queueManager` and `jobWorker`.
1.2: Verify `ProxySanitizer` cleans the inbound text.
1.3: Verify `forwardToLLM` sends the cleaned text to the _selected_ MCP server.
1.4: Verify the response is received and passed through outbound sanitization (`handleN8nWebhook` or `AITextTransformer`).
1.5: Verify the final JSON is stored correctly.
1.6: Test with both a mock MCP server and a real connection if available.

**Priority:** High
**Estimate:** 6-8 hours
**Dependencies:** Story 1.1, Story 1.3

## Epic Dependencies

- **Blocks:** None
- **Depends on:** Existing PDF upload and sanitization pipeline.
- **Risks:** External MCP server availability/latency might affect job processing times. Security of auth tokens.

## Definition of Done

- "Marketplace" UI is functional and allows server selection.
- Backend correctly stores and retrieves MCP config.
- `ProxySanitizer` successfully communicates with external MCP servers.
- End-to-end flow is verified with tests.
- Code is reviewed and merged.

## Epic Timeline

**Estimated Total Effort:** 26-38 hours
**Suggested Sprint:** 1-2 weeks
**Priority:** High
