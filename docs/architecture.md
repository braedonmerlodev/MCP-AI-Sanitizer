# Obfuscation-Aware Sanitizer Agent Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for Obfuscation-Aware Sanitizer Agent, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template or Existing Project

N/A - Greenfield project

### Change Log

| Date       | Version | Description                   | Author          |
| ---------- | ------- | ----------------------------- | --------------- |
| 2025-11-26 | v1.0    | Initial architecture document | Architect Agent |

## High Level Architecture

### Technical Summary

The Obfuscation-Aware Sanitizer Agent is a proxy-based security layer for agentic AI systems, providing real-time sanitization of data flows to prevent manipulation and data exfiltration. The architecture consists of a Node.js backend implementing the sanitization pipeline, a React frontend for monitoring and chat-based interaction with the autonomous agent, and integration with DeepAgent CLI and LangSmith for autonomous learning. It achieves PRD goals by neutralizing obfuscation techniques (Unicode homoglyphs, zero-width characters, ANSI escape codes), validating data provenance, enabling bidirectional sanitization, and supporting adaptive security responses with ≥90% threat neutralization rate and <100ms latency.

### Platform and Infrastructure Choice

**Platform:** AWS  
**Key Services:** Lambda (serverless functions), API Gateway (API management), S3 (file storage), CloudWatch (monitoring), RDS PostgreSQL (database), ElastiCache Redis (caching), Cognito (authentication if needed)  
**Deployment Host and Regions:** AWS us-east-1 (primary), us-west-2 (backup)

### Repository Structure

**Structure:** Monorepo  
**Monorepo Tool:** npm workspaces  
**Package Organization:** apps/api (backend), apps/web (frontend), packages/shared (common types/utilities)

### High Level Architecture Diagram

```mermaid
graph TD
    A[User] --> B[Frontend Chat UI]
    B --> C[AWS API Gateway]
    C --> D[Sanitizer Lambda Functions]
    D --> E[MCP Server]
    D --> F[LLM Provider]
    D --> G[LangSmith Graph DB]
    H[DeepAgent CLI] --> D
    D --> I[RDS PostgreSQL]
    D --> J[ElastiCache Redis]
    D --> K[S3 Storage]
    L[CloudWatch] --> D
```

### Architectural Patterns

- **Proxy Pattern:** Intermediary sanitization layer between MCP servers and LLMs - _Rationale:_ Enables transparent security without disrupting AI workflows
- **Repository Pattern:** Abstract data access for logs and configurations - _Rationale:_ Enables testing and future database migration flexibility
- **Event-Driven Architecture:** Asynchronous processing for autonomous agent responses - _Rationale:_ Supports real-time monitoring and adaptive security
- **API Gateway Pattern:** Single entry point for all API calls - _Rationale:_ Centralized auth, rate limiting, and monitoring

## Tech Stack

### Technology Stack Table

| Category             | Technology       | Version | Purpose          | Rationale                             |
| -------------------- | ---------------- | ------- | ---------------- | ------------------------------------- |
| Frontend Language    | TypeScript       | 5.0     | Type safety      | Modern development with strong typing |
| Frontend Framework   | React            | 18      | UI components    | Popular, component-based, performant  |
| UI Component Library | Material-UI      | 5.0     | Consistent UI    | Comprehensive design system           |
| State Management     | Redux Toolkit    | 1.9     | State management | Predictable, scalable state           |
| Backend Language     | Node.js          | 18      | Runtime          | Fast, scalable, large ecosystem       |
| Backend Framework    | Express          | 4.18    | API framework    | Lightweight, flexible                 |
| API Style            | REST             | -       | API design       | Simple, standard, n8n-compatible      |
| Database             | PostgreSQL       | 15      | Data storage     | Relational for audit logs             |
| Cache                | Redis            | 7       | Caching          | Fast in-memory for trust tokens       |
| File Storage         | S3               | -       | File storage     | Scalable for logs and exports         |
| Authentication       | JWT              | -       | Auth             | Stateless, secure                     |
| Frontend Testing     | Jest + RTL       | -       | Unit testing     | Comprehensive component testing       |
| Backend Testing      | Jest + Supertest | -       | API testing      | Integration testing                   |
| E2E Testing          | Playwright       | -       | E2E testing      | Reliable browser automation           |
| Build Tool           | Vite             | -       | Frontend build   | Fast development and production       |
| Bundler              | esbuild          | -       | Bundling         | High performance                      |
| IaC Tool             | AWS CDK          | -       | Infrastructure   | Code as infrastructure                |
| CI/CD                | GitHub Actions   | -       | Automation       | Integrated with GitHub                |
| Monitoring           | CloudWatch       | -       | Monitoring       | AWS native, comprehensive             |
| Logging              | Winston          | -       | Logging          | Structured, configurable              |
| CSS Framework        | Tailwind CSS     | -       | Styling          | Utility-first, consistent             |

## Data Models

### SanitizationLog

**Purpose:** Track all sanitization actions for audit and compliance

**Key Attributes:**

- id: string - Unique identifier
- timestamp: Date - When action occurred
- action: string - Type of sanitization (normalize, strip, neutralize, redact)
- inputHash: string - SHA-256 hash of input
- outputHash: string - SHA-256 hash of output
- rulesApplied: string[] - List of rules used
- provenance: object - Data origin validation
- metadata: object - Additional context

**TypeScript Interface:**

```typescript
interface SanitizationLog {
  id: string;
  timestamp: Date;
  action: string;
  inputHash: string;
  outputHash: string;
  rulesApplied: string[];
  provenance: {
    source: string;
    validated: boolean;
  };
  metadata: Record<string, any>;
}
```

**Relationships:**

- Belongs to TrustToken (optional, for reuse tracking)

### TrustToken

**Purpose:** Enable efficient content reuse while maintaining security

**Key Attributes:**

- id: string - Token identifier
- contentHash: string - SHA-256 of sanitized content
- signature: string - RSA/ECDSA signature
- expiration: Date - Token validity period
- rulesVersion: string - Sanitization rules version
- metadata: object - Additional token data

**TypeScript Interface:**

```typescript
interface TrustToken {
  id: string;
  contentHash: string;
  signature: string;
  expiration: Date;
  rulesVersion: string;
  metadata: Record<string, any>;
}
```

**Relationships:**

- Has many SanitizationLog (for validation history)

### AgentMemory

**Purpose:** Persistent learning data for the autonomous agent

**Key Attributes:**

- id: string - Memory entry ID
- pattern: string - Detected pattern
- confidence: number - Detection confidence
- actions: string[] - Recommended responses
- lastUpdated: Date - Last modification
- source: string - Learning source (manual/user feedback)

**TypeScript Interface:**

```typescript
interface AgentMemory {
  id: string;
  pattern: string;
  confidence: number;
  actions: string[];
  lastUpdated: Date;
  source: string;
}
```

**Relationships:**

- Stored in LangSmith graph database

## API Specification

### REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Obfuscation-Aware Sanitizer Agent API
  version: 1.0.0
  description: API for sanitizing data flows in agentic AI systems
servers:
  - url: https://api.sanitizer.example.com/v1
    description: Production server
paths:
  /sanitize:
    post:
      summary: Sanitize input data
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: string
                direction:
                  type: string
                  enum: [input, output]
      responses:
        '200':
          description: Sanitized data
          content:
            application/json:
              schema:
                type: object
                properties:
                  sanitizedData:
                    type: string
                  trustToken:
                    type: string
                  logId:
                    type: string
  /trust-token/validate:
    post:
      summary: Validate trust token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                token:
                  type: string
      responses:
        '200':
          description: Token validation result
  /agent/chat:
    post:
      summary: Chat with autonomous agent
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
      responses:
        '200':
          description: Agent response
```

## Components

### Sanitizer Service

**Responsibility:** Core sanitization pipeline implementation

**Key Interfaces:**

- sanitize(data, direction) -> sanitizedData, token
- validateToken(token) -> boolean

**Dependencies:** Database (logs), Cache (tokens), LangSmith (agent)

**Technology Stack:** Node.js, Express, Unicode libraries

### Agent Service

**Responsibility:** Autonomous security monitoring and learning

**Key Interfaces:**

- monitorUsage(stats) -> alerts
- learnFromIncident(incident) -> updatedPatterns
- orchestrateResponse(alert) -> actions

**Dependencies:** DeepAgent CLI, LangSmith, Sanitizer Service

**Technology Stack:** Node.js, DeepAgent CLI, LangSmith SDK

### Frontend Chat App

**Responsibility:** User interface for interacting with the agent and monitoring sanitization

**Key Interfaces:**

- sendMessage(message) -> response
- viewLogs(filters) -> logs
- configureRules(config) -> success

**Dependencies:** API Gateway, Auth service

**Technology Stack:** React, TypeScript, Material-UI

### Component Diagrams

```mermaid
graph TD
    subgraph "Frontend Layer"
        A[Chat UI] --> B[API Client]
    end
    subgraph "API Layer"
        B --> C[API Gateway]
        C --> D[Auth Middleware]
        D --> E[Sanitizer Controller]
        D --> F[Agent Controller]
    end
    subgraph "Service Layer"
        E --> G[Sanitizer Service]
        F --> H[Agent Service]
    end
    subgraph "Data Layer"
        G --> I[(PostgreSQL)]
        H --> J[(LangSmith)]
        G --> K[(Redis)]
    end
```

## External APIs

### LangSmith API

- **Purpose:** Graph database for agent memory and learning
- **Documentation:** https://docs.smith.langchain.com/
- **Base URL(s):** https://api.smith.langchain.com
- **Authentication:** API key
- **Rate Limits:** 1000 requests/minute
- **Key Endpoints Used:**
  - `POST /memory/store` - Store agent memory
  - `GET /memory/query` - Query patterns

**Integration Notes:** Used for persistent agent learning across sessions

### DeepAgent CLI Integration

- **Purpose:** Framework for autonomous agent development
- **Documentation:** Internal DeepAgent docs
- **Base URL(s):** Local CLI interface
- **Authentication:** CLI auth
- **Rate Limits:** N/A
- **Key Endpoints Used:**
  - CLI commands for agent orchestration

**Integration Notes:** Runs as background process, integrated via Node.js child_process

## Core Workflows

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Gateway
    participant S as Sanitizer
    participant M as MCP Server
    participant L as LLM
    participant Ag as Agent

    U->>F: Send chat message
    F->>A: POST /agent/chat
    A->>S: Validate & sanitize input
    S->>Ag: Check for threats
    Ag->>S: OK or alert
    S->>M: Forward sanitized request
    M->>L: Process request
    L->>M: Return response
    M->>S: Response to sanitize
    S->>S: Sanitize output
    S->>A: Return sanitized response
    A->>F: Response to user
    S->>Ag: Log for learning
```

## Database Schema

```sql
-- Sanitization Logs
CREATE TABLE sanitization_logs (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    action VARCHAR(50) NOT NULL,
    input_hash VARCHAR(64) NOT NULL,
    output_hash VARCHAR(64) NOT NULL,
    rules_applied TEXT[],
    provenance JSONB,
    metadata JSONB
);

-- Trust Tokens
CREATE TABLE trust_tokens (
    id UUID PRIMARY KEY,
    content_hash VARCHAR(64) NOT NULL,
    signature TEXT NOT NULL,
    expiration TIMESTAMP NOT NULL,
    rules_version VARCHAR(20) NOT NULL,
    metadata JSONB
);

-- Indexes
CREATE INDEX idx_logs_timestamp ON sanitization_logs(timestamp);
CREATE INDEX idx_tokens_hash ON trust_tokens(content_hash);
```

## Frontend Architecture

### Component Architecture

**Component Organization:**

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   └── MessageInput.tsx
│   ├── monitoring/
│   │   ├── LogsViewer.tsx
│   │   └── MetricsDashboard.tsx
│   └── shared/
│       ├── Button.tsx
│       └── Modal.tsx
├── pages/
│   ├── Chat.tsx
│   ├── Dashboard.tsx
│   └── Settings.tsx
├── hooks/
│   ├── useChat.ts
│   └── useAuth.ts
├── services/
│   ├── apiClient.ts
│   └── agentService.ts
├── stores/
│   ├── chatSlice.ts
│   └── authSlice.ts
├── styles/
│   └── globals.css
└── utils/
    └── formatters.ts
```

**Component Template:**

```typescript
import React from 'react';
import { useSelector } from 'react-redux';

interface ChatWindowProps {
  onSendMessage: (message: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ onSendMessage }) => {
  const messages = useSelector((state) => state.chat.messages);

  return (
    <div className="chat-window">
      {/* Component implementation */}
    </div>
  );
};
```

### State Management Architecture

**State Structure:**

```typescript
interface RootState {
  chat: {
    messages: Message[];
    isTyping: boolean;
  };
  auth: {
    user: User | null;
    token: string | null;
  };
  monitoring: {
    logs: SanitizationLog[];
    metrics: Metrics;
  };
}
```

**State Management Patterns:**

- Actions for async operations (thunks)
- Selectors for computed state
- Immutable updates

### Routing Architecture

**Route Organization:**

```
/ - Dashboard
/chat - Chat interface
/monitoring - Logs and metrics
/settings - Configuration
```

**Protected Route Pattern:**

```typescript
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};
```

### Frontend Services Layer

**API Client Setup:**

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

**Service Example:**

```typescript
import apiClient from './apiClient';

export const agentService = {
  async sendMessage(message: string): Promise<string> {
    const response = await apiClient.post('/agent/chat', { message });
    return response.data.response;
  },

  async getLogs(filters: LogFilters): Promise<SanitizationLog[]> {
    const response = await apiClient.get('/logs', { params: filters });
    return response.data.logs;
  },
};
```

## Backend Architecture

### Service Architecture

**Function Organization (Serverless):**

```
src/
├── functions/
│   ├── sanitize/
│   │   ├── index.ts
│   │   └── handler.ts
│   ├── validate-token/
│   │   ├── index.ts
│   │   └── handler.ts
│   └── agent-chat/
│       ├── index.ts
│       └── handler.ts
├── services/
│   ├── sanitizer.ts
│   ├── agent.ts
│   └── database.ts
├── middleware/
│   ├── auth.ts
│   ├── cors.ts
│   └── rateLimit.ts
└── utils/
    ├── crypto.ts
    └── validation.ts
```

**Function Template:**

```typescript
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');

    // Business logic here

    return {
      statusCode: 200,
      body: JSON.stringify({ result }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### Database Architecture

**Schema Design:**

```sql
-- As above
```

**Data Access Layer:**

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export class SanitizationLogRepository {
  async create(log: SanitizationLog): Promise<void> {
    const query = `
      INSERT INTO sanitization_logs (id, timestamp, action, input_hash, output_hash, rules_applied, provenance, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await pool.query(query, [
      log.id,
      log.timestamp,
      log.action,
      log.inputHash,
      log.outputHash,
      log.rulesApplied,
      JSON.stringify(log.provenance),
      JSON.stringify(log.metadata),
    ]);
  }

  async findById(id: string): Promise<SanitizationLog | null> {
    const result = await pool.query('SELECT * FROM sanitization_logs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
}
```

### Auth Architecture

**Auth Flow:**

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Gateway
    participant L as Lambda

    U->>F: Login
    F->>A: POST /auth/login
    A->>L: Validate credentials
    L->>L: Generate JWT
    L->>A: Return token
    A->>F: Token to frontend
    F->>F: Store token
    Note over F: Subsequent requests include token
```

**Middleware/Guards:**

```typescript
import jwt from 'jsonwebtoken';

export const authMiddleware = (event: APIGatewayEvent) => {
  const token = event.headers.Authorization?.replace('Bearer ', '');

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
};
```

## Unified Project Structure

```
obfuscation-aware-sanitizer/
├── .github/
│   └── workflows/
│       ├── ci.yaml
│       └── deploy.yaml
├── apps/
│   ├── web/
│   │   ├── src/           # Frontend source
│   │   ├── public/        # Static assets
│   │   ├── tests/         # Frontend tests
│   │   └── package.json
│   └── api/
│       ├── src/           # Backend source
│       ├── tests/         # Backend tests
│       └── package.json
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/     # Shared TypeScript types
│   │   │   ├── constants/ # Shared constants
│   │   │   └── utils/     # Shared utilities
│   │   └── package.json
│   ├── ui/
│   │   ├── src/           # Shared UI components
│   │   └── package.json
│   └── config/
│       ├── eslint/
│       ├── typescript/
│       └── jest/
├── infrastructure/
│   └── cdk/               # AWS CDK definitions
├── scripts/
├── docs/
│   ├── prd.md
│   ├── front-end-spec.md  # Note: This file was not found during architecture creation
│   └── architecture.md
├── .env.example
├── package.json
├── nx.json               # Monorepo configuration
└── README.md
```

## Development Workflow

### Local Development Setup

**Prerequisites:**

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install Docker for local DB
sudo apt-get install docker.io
```

**Initial Setup:**

```bash
# Clone repo
git clone <repo-url>
cd obfuscation-aware-sanitizer

# Install dependencies
npm install

# Set up local environment
cp .env.example .env.local
# Edit .env.local with your values

# Start local databases
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
docker run -d --name redis -p 6379:6379 redis:7

# Run database migrations
npm run db:migrate
```

**Development Commands:**

```bash
# Start all services
npm run dev

# Start frontend only
npm run dev:web

# Start backend only
npm run dev:api

# Run tests
npm run test

# Run linting
npm run lint

# Build for production
npm run build
```

### Environment Configuration

**Required Environment Variables:**

```bash
# Frontend (.env.local)
REACT_APP_API_URL=https://api.sanitizer.example.com/v1
REACT_APP_WS_URL=wss://ws.sanitizer.example.com

# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/sanitizer
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
LANGSMITH_API_KEY=your-key
DEEPAGENT_API_KEY=your-key
AWS_REGION=us-east-1

# Shared
NODE_ENV=development
LOG_LEVEL=debug
```

## Deployment Architecture

### Deployment Strategy

**Frontend Deployment:**

- **Platform:** AWS S3 + CloudFront
- **Build Command:** npm run build
- **Output Directory:** dist
- **CDN/Edge:** CloudFront with Lambda@Edge for auth

**Backend Deployment:**

- **Platform:** AWS Lambda + API Gateway
- **Build Command:** npm run build:api
- **Deployment Method:** AWS CDK
- **Scaling:** Automatic based on traffic

### CI/CD Pipeline

```yaml
name: CI/CD
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test
      - run: npm run build
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run deploy
```

### Environments

| Environment | Frontend URL                          | Backend URL                               | Purpose                |
| ----------- | ------------------------------------- | ----------------------------------------- | ---------------------- |
| Development | http://localhost:3000                 | http://localhost:3001                     | Local development      |
| Staging     | https://staging.sanitizer.example.com | https://api-staging.sanitizer.example.com | Pre-production testing |
| Production  | https://sanitizer.example.com         | https://api.sanitizer.example.com         | Live environment       |

## Security and Performance

### Security Requirements

**Frontend Security:**

- CSP Headers: strict CSP allowing only trusted sources
- XSS Prevention: React's built-in XSS protection + input sanitization
- Secure Storage: HttpOnly cookies for tokens, encrypted localStorage for non-sensitive data

**Backend Security:**

- Input Validation: Joi/Zod schemas for all inputs
- Rate Limiting: AWS WAF with custom rules
- CORS Policy: Restrict to allowed origins

**Authentication Security:**

- Token Storage: HttpOnly, Secure, SameSite cookies
- Session Management: JWT with short expiration, refresh tokens
- Password Policy: Minimum 12 chars, complexity requirements

### Performance Optimization

**Frontend Performance:**

- Bundle Size Target: <500KB gzipped
- Loading Strategy: Code splitting, lazy loading
- Caching Strategy: Service Worker for static assets

**Backend Performance:**

- Response Time Target: <100ms for sanitization
- Database Optimization: Connection pooling, query optimization
- Caching Strategy: Redis for trust tokens, CDN for static content

## Testing Strategy

### Testing Pyramid

```
     E2E Tests (Playwright)
    /        \
   /          \
Integration Tests (Jest + Supertest)
 /            \
Frontend Unit  Backend Unit
 (Jest + RTL)  (Jest)
```

### Test Organization

**Frontend Tests:**

```
apps/web/src/
├── __tests__/
│   ├── components/
│   │   ├── ChatWindow.test.tsx
│   │   └── MessageList.test.tsx
│   ├── hooks/
│   │   └── useChat.test.ts
│   └── services/
│       └── apiClient.test.ts
```

**Backend Tests:**

```
apps/api/src/
├── __tests__/
│   ├── functions/
│   │   ├── sanitize.test.ts
│   │   └── validate-token.test.ts
│   ├── services/
│   │   └── sanitizer.test.ts
│   └── utils/
│       └── crypto.test.ts
```

**E2E Tests:**

```
tests/
├── e2e/
│   ├── chat-flow.spec.ts
│   └── monitoring.spec.ts
```

### Test Examples

**Frontend Component Test:**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatWindow } from './ChatWindow';

test('sends message on form submit', () => {
  const mockOnSend = jest.fn();
  render(<ChatWindow onSendMessage={mockOnSend} />);

  const input = screen.getByRole('textbox');
  const button = screen.getByRole('button');

  fireEvent.change(input, { target: { value: 'Hello' } });
  fireEvent.click(button);

  expect(mockOnSend).toHaveCalledWith('Hello');
});
```

**Backend API Test:**

```typescript
import request from 'supertest';
import app from '../app';

describe('POST /sanitize', () => {
  it('sanitizes input data', async () => {
    const response = await request(app)
      .post('/sanitize')
      .send({ data: 'test\u200Bdata', direction: 'input' })
      .expect(200);

    expect(response.body.sanitizedData).toBe('testdata');
  });
});
```

**E2E Test:**

```typescript
import { test, expect } from '@playwright/test';

test('chat interaction', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="message-input"]', 'Hello agent');
  await page.click('[data-testid="send-button"]');
  await expect(page.locator('[data-testid="response"]')).toBeVisible();
});
```

## Coding Standards

### Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared and import from there
- **API Calls:** Never make direct HTTP calls - use the service layer
- **Environment Variables:** Access only through config objects, never process.env directly
- **Error Handling:** All API routes must use the standard error handler
- **State Updates:** Never mutate state directly - use proper state management patterns
- **Security First:** All inputs must be validated and sanitized before processing

### Naming Conventions

| Element         | Frontend             | Backend    | Example             |
| --------------- | -------------------- | ---------- | ------------------- |
| Components      | PascalCase           | -          | `ChatWindow.tsx`    |
| Hooks           | camelCase with 'use' | -          | `useChat.ts`        |
| API Routes      | -                    | kebab-case | `/api/agent-chat`   |
| Database Tables | -                    | snake_case | `sanitization_logs` |
| Functions       | camelCase            | camelCase  | `sanitizeData`      |

## Error Handling Strategy

### Error Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Gateway
    participant L as Lambda
    participant DB as Database

    U->>F: Action triggers error
    F->>A: Request
    A->>L: Process
    L->>L: Error occurs
    L->>L: Log error
    L->>A: Error response
    A->>F: Error to frontend
    F->>F: Show user-friendly message
    L->>DB: Store error details
```

### Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Frontend Error Handling

```typescript
import { useState } from 'react';

export const useApiCall = () => {
  const [error, setError] = useState<string | null>(null);

  const makeCall = async (apiCall: () => Promise<any>) => {
    try {
      setError(null);
      return await apiCall();
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'An error occurred';
      setError(message);
      throw err;
    }
  };

  return { makeCall, error };
};
```

### Backend Error Handling

```typescript
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

export const errorHandler = (error: any): APIGatewayProxyResult => {
  console.error('Error:', error);

  return {
    statusCode: error.statusCode || 500,
    body: JSON.stringify({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId: 'generated-id', // From event
      },
    }),
  };
};
```

## Monitoring and Observability

### Monitoring Stack

- **Frontend Monitoring:** Sentry for error tracking, performance monitoring
- **Backend Monitoring:** CloudWatch metrics, X-Ray tracing
- **Error Tracking:** Winston logging with CloudWatch Logs
- **Performance Monitoring:** Custom metrics for sanitization latency

### Key Metrics

**Frontend Metrics:**

- Core Web Vitals (LCP, FID, CLS)
- JavaScript errors
- API response times
- User interactions (chat messages sent)

**Backend Metrics:**

- Request rate per endpoint
- Error rate by type
- Response time percentiles
- Database query performance
- Sanitization throughput

## Checklist Results Report

Architecture document created successfully. Note: The UI/UX Specification file (docs/front-end-spec.md) was not found in the repository. The architecture assumes a chat-based interface for interacting with the autonomous agent based on PRD requirements for user notifications and agent orchestration. If the spec exists elsewhere or needs to be created, please provide it for refinement.
