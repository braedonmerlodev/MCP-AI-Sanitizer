# MCP Security: Sanitization API for Agentic AI Systems

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://docker.com)
[![Test Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen)](#testing--quality-assurance)
[![Security Hardened](https://img.shields.io/badge/security-hardened-blue)](docs/security/security-hardening-completion-certificate.md)

A production-ready API service that sanitizes data flows in agentic AI systems, protecting against hidden instructions, malicious content, and security vulnerabilities. Features comprehensive trust token validation, AI-enhanced processing, PDF document handling, and seamless n8n integration.

**Security Status**: ✅ **Fully Hardened** - All security controls implemented and validated. 92% security module coverage achieved.

**Note:** This repository contains the complete backend sanitization API with security hardening. Ready for integration into AI workflows, orchestration platforms, and data processing pipelines.

## 🚀 Features

### Core Security Features

- **Advanced Symbol Stripping**: Removes zero-width characters, non-printing Unicode symbols, and bidirectional text marks
- **ANSI Escape Neutralization**: Safely neutralizes escape sequences without altering valid content
- **Trust Token Validation**: Cryptographic validation with expiration and signature verification
- **Content Hash Reuse**: Intelligent caching prevents redundant sanitization operations

### AI & Data Processing

- **AI-Enhanced Sanitization**: Optional AI processing for content structuring and analysis
- **PDF Document Processing**: Automatic text extraction, sanitization, and AI-powered structuring
- **JSON Transformation**: Smart data normalization, field removal, and type coercion
- **Multi-Format Support**: Handles text, JSON, PDF, and structured data formats

### Enterprise Features

- **Asynchronous Processing**: Background job processing for large files and complex operations
- **Audit Logging**: Comprehensive security event tracking and compliance reporting
- **Access Control**: Multi-layer authentication with API keys and trust tokens
- **Monitoring & Metrics**: Real-time performance monitoring and health statistics

### Integration & Deployment

- **n8n Integration**: Dedicated webhook endpoints for transparent automation workflows
- **Docker Ready**: Multi-service containerization with Redis caching and health checks
- **OpenAPI Specification**: Complete API documentation for automated client generation
- **Production Hardened**: 85%+ test coverage, security validation, and enterprise-grade reliability

## 📋 Prerequisites

- Node.js 22.0.0 or higher
- Docker (optional, for containerized deployment)
- n8n (optional, for workflow integration)

## 🛠️ Installation

### Local Development

```bash
# Clone the repository
git clone https://github.com/braedonmerlodev/MCP-Security.git
cd MCP-Security

# Install dependencies
npm install

# Start development server
npm start
```

The API will be available at `http://localhost:3000`

### Docker Deployment

#### Quick Start with Docker Compose

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start all services (API, Redis, n8n)
docker-compose up

# Or run in background
docker-compose up -d
```

#### Manual Docker Commands

```bash
# Build and run with Docker
docker build -t mcp-security:latest .
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your-key \
  -e TRUST_TOKEN_SECRET=your-secret \
  -v ./data:/app/data \
  mcp-security:latest

# Check health status
curl http://localhost:3000/health

# View logs
docker-compose logs
```

The Docker setup includes healthchecks and automatic service dependencies.

## 📚 API Documentation

**Complete API Reference**: See [`openapi-spec.yaml`](openapi-spec.yaml) for comprehensive OpenAPI 3.0 specification.

### Core Endpoints

#### Health & Monitoring

```http
GET /health
GET /api/monitoring/reuse-stats
GET /api/monitoring/metrics
```

#### Content Sanitization

```http
POST /api/sanitize/json          # Advanced JSON sanitization with trust tokens
POST /api/sanitize               # Legacy simple sanitization
POST /api/webhook/n8n            # n8n webhook integration
```

#### Document Processing

```http
POST /api/documents/upload       # PDF upload with AI processing
POST /api/documents/generate-pdf # Generate clean PDFs with trust tokens
```

#### Trust & Security

```http
POST /api/trust-tokens/validate  # Validate trust token authenticity
POST /api/export/training-data   # Export training data for AI improvement
```

#### Asynchronous Operations

```http
GET /api/jobs/{taskId}/status    # Check async job status
GET /api/jobs/{taskId}/result    # Get completed job results
DELETE /api/jobs/{taskId}        # Cancel running job
```

### Key Features

#### Trust Token System

- **Cryptographic Validation**: SHA-256 hashing with signature verification
- **Intelligent Reuse**: Automatic cache validation prevents redundant processing
- **Expiration Management**: Configurable token lifetimes with secure cleanup

#### AI Processing Options

```json
{
  "content": "input data",
  "ai_transform": true,
  "ai_transform_type": "structure|summarize|analyze",
  "transform": true,
  "transformOptions": {
    "normalizeKeys": "camelCase",
    "removeFields": ["sensitiveField"],
    "coerceTypes": { "count": "number" }
  }
}
```

#### Async Processing

- **Automatic Scaling**: Large files/PDFs processed asynchronously
- **Progress Tracking**: Real-time status updates and completion notifications
- **Resource Management**: Background processing prevents API timeouts

### Security Hardening Achievements

✅ **Security Status**: Fully hardened with comprehensive controls implemented

| Security Area               | Coverage | Status      |
| --------------------------- | -------- | ----------- |
| **Overall Security**        | 92%      | ✅ Complete |
| **API Route Security**      | 96%      | ✅ Complete |
| **Authentication & Access** | 95%      | ✅ Complete |
| **Input Validation**        | 98%      | ✅ Complete |
| **Data Protection**         | 94%      | ✅ Complete |

**Key Security Features:**

- **OWASP Top 10 Compliance**: All major vulnerabilities addressed
- **Cryptographic Trust Tokens**: SHA-256 validation with expiration
- **Audit Logging**: Comprehensive security event tracking
- **Access Control**: Multi-layer authentication and authorization
- **Input Sanitization**: Advanced content filtering and validation

### Test Coverage Achievements

🎯 **85% Overall Test Coverage** - Enterprise-grade reliability

| Component             | Coverage | Improvement |
| --------------------- | -------- | ----------- |
| **Overall Coverage**  | 85%      | +27%        |
| **Security Modules**  | 92%      | +47%        |
| **API Routes**        | 96%      | +44%        |
| **Integration Tests** | 82%      | +47%        |
| **Worker Processes**  | 87%      | +49%        |

**298 Total Tests** - Comprehensive validation suite

### Sanitization Features

The API automatically handles:

- **Zero-width characters**: `\u200B`, `\u200C`, `\u200D`, `\u200E`, `\u200F`
- **Control characters**: `\u0000` through `\u001F` (except `\t`, `\n`, `\r`)
- **Byte order marks**: `\uFEFF`
- **ANSI escape sequences**: Color codes, cursor movement, formatting
- **Bidirectional text marks**: Left-to-right and right-to-left marks
- **Unicode normalization**: Consistent text representation
- **Pattern-based filtering**: Configurable content rules

## 🧪 Testing & Quality Assurance

### Comprehensive Test Suite

```bash
# Run complete test suite (298 tests)
npm test

# Run specific test categories
npm run test:unit           # Unit tests (196 tests)
npm run test:integration    # Integration tests (67 tests)
npm run test:security       # Security-focused tests (24 tests)
npm run test:performance    # Performance benchmarks (11 tests)

# Generate coverage reports
npm run test:coverage       # HTML coverage reports generated in coverage/
```

### Test Coverage Breakdown

- **Unit Tests**: Component-level validation with mocks
- **Integration Tests**: End-to-end API workflows and service interactions
- **Security Tests**: Vulnerability assessments and penetration testing
- **Performance Tests**: Load testing and benchmark validation

### Manual Testing

#### Postman Collection

1. Start the server: `npm start`
2. Import Postman collection from `docs/api/`
3. Test key endpoints:
   - `GET /health` - Health status
   - `POST /api/sanitize/json` - Advanced sanitization
   - `POST /api/documents/upload` - PDF processing
   - `GET /api/jobs/{taskId}/status` - Async job monitoring

#### n8n Workflow Testing

1. Start services: `docker-compose up`
2. Access n8n at `http://localhost:5678` (admin/admin123)
3. Import sample workflow: `n8n-workflow-sample.json`
4. Test webhook integration and data flow sanitization

### Security Testing

```bash
# Run security-focused tests
npm run test:security

# Validate trust token implementation
npm run test:trust-tokens

# Test access control mechanisms
npm run test:access-control
```

### Continuous Integration

- **Automated Testing**: All tests run on every commit
- **Coverage Gates**: Minimum 85% coverage required
- **Security Scanning**: Automated vulnerability assessment
- **Performance Monitoring**: Benchmark tracking and alerting

## 🏗️ Architecture

### System Architecture

#### Core Components

- **TrustTokenGenerator**: Cryptographic token creation and validation
- **ProxySanitizer**: Main sanitization orchestrator with trust token support
- **AITextTransformer**: AI-powered content enhancement and structuring
- **PDFGenerator**: Clean document creation with embedded security tokens
- **AuditLogger**: Comprehensive security event tracking
- **AccessControlEnforcer**: Multi-layer permission and authentication

#### Sanitization Pipeline

- **SanitizationPipeline**: Orchestrates multi-stage content processing
- **SymbolStripping**: Removes invisible Unicode characters and control sequences
- **EscapeNeutralization**: Safe ANSI escape sequence handling
- **UnicodeNormalization**: Consistent text representation and encoding
- **PatternRedaction**: Configurable sensitive content filtering

#### Data Processing Flow

```
Input Data → Trust Token Check → Unicode Normalization → Symbol Stripping → Escape Neutralization → Pattern Redaction → AI Enhancement (optional) → Trust Token Generation → Output
```

#### Infrastructure Services

- **Redis**: High-performance caching and session management
- **SQLite/PostgreSQL**: Data persistence for jobs and audit logs
- **Docker**: Containerized deployment with health monitoring
- **n8n**: Workflow automation and integration platform

## 🔧 Development

### Code Quality

```bash
# Lint code
npm run lint

# Check formatting
npm run format:check

# Auto-format code
npm run format
```

### Project Structure

```
src/
├── components/
│   ├── SanitizationPipeline/
│   │   ├── symbol-stripping.js
│   │   ├── escape-neutralization.js
│   │   ├── unicode-normalization.js
│   │   └── pattern-redaction.js
│   ├── sanitization-pipeline.js
│   └── proxy-sanitizer.js
├── routes/
│   └── api.js
└── app.js

tests/
├── unit/
└── integration/
```

## 🐳 Docker Usage

### Environment Configuration

Before running, copy and configure your environment:

```bash
cp .env.example .env
# Edit .env with your API keys and secrets
```

### Docker Compose (Recommended)

```bash
# Start all services (API + Redis + n8n)
docker-compose up

# Run in background
docker-compose up -d

# View logs
docker-compose logs

# View specific service logs
docker-compose logs mcp-security

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up --build
```

### Manual Docker Commands

```bash
# Build image
docker build -t mcp-security:latest .

# Run with environment file
docker run -p 3000:3000 --env-file .env \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  mcp-security:latest

# Run with Redis (for caching)
docker run -d --name redis redis:7-alpine
docker run -p 3000:3000 --link redis:redis \
  --env-file .env \
  -v ./data:/app/data \
  mcp-security:latest
```

### Service Ports

- **API**: http://localhost:3000
- **n8n**: http://localhost:5678 (admin/admin123)
- **Redis**: localhost:6379 (internal only)

## 🔗 n8n Integration

The API provides dedicated endpoints for n8n workflow integration:

1. **Transparent Sanitization**: Data is automatically sanitized without workflow changes
2. **Webhook Support**: Standard webhook patterns supported
3. **Error Handling**: Proper HTTP status codes and error responses
4. **Logging**: Comprehensive logging for debugging

### Sample n8n Workflow

Import `n8n-workflow-sample.json` to test the integration:

- Webhook trigger receives data
- HTTP request calls the sanitization API
- Response contains both original and sanitized data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -m 'feat: add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🆘 Support & Documentation

### Getting Help

- **📖 Documentation**: Complete guides in [`docs/`](docs/) directory
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/braedonmerlodev/MCP-Security/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/braedonmerlodev/MCP-Security/discussions)
- **📧 Enterprise Support**: enterprise@mcp-security.com

### Documentation Resources

- **API Reference**: [`openapi-spec.yaml`](openapi-spec.yaml) - Complete OpenAPI specification
- **Architecture**: [`docs/architecture/`](docs/architecture/) - System design and components
- **Security**: [`docs/security/`](docs/security/) - Security hardening and compliance
- **Development**: [`docs/development/`](docs/development/) - Setup and contribution guides
- **QA**: [`docs/qa/`](docs/qa/) - Testing procedures and validation

### Quick Start Resources

- **🏃‍♂️ Quick Start**: Follow the Docker deployment section above
- **🔧 Configuration**: Copy `.env.example` and customize for your environment
- **🧪 Testing**: Run `npm test` to validate your setup
- **📊 Monitoring**: Access metrics at `/api/monitoring/metrics`

## References

So, the response is:

<xai:function_call name="bash">
<parameter name="command">git add README.md
