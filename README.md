# MCP Security: Sanitization API for Agentic AI Systems

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://docker.com)

A robust API service that sanitizes data flows in agentic AI systems, protecting against hidden instructions and malicious content. Features automatic symbol stripping, ANSI escape neutralization, and seamless n8n integration.

**Note:** This repository contains only the backend sanitization API component. To implement a complete agentic AI system, this API needs to be integrated into your AI workflows and connected to language models, orchestration platforms, and data processing pipelines.

## 🚀 Features

- **Symbol Stripping**: Removes zero-width characters and non-printing Unicode symbols
- **Escape Neutralization**: Safely neutralizes ANSI escape sequences without altering valid content
- **Bidirectional Processing**: Sanitizes both input and output data flows
- **n8n Integration**: Dedicated webhook endpoints for transparent automation workflows
- **Production Ready**: Health checks, Docker containerization, and comprehensive testing
- **Security Focused**: Prevents hidden instruction execution in AI systems

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

```bash
# Build and run with Docker
docker build -t mcp-security:latest .
docker run -p 3000:3000 mcp-security:latest

# Check health status
curl http://localhost:3000/health

# Or use Docker Compose (includes n8n for testing)
docker-compose up
```

The Docker container includes a healthcheck that verifies the API is responding correctly.

## 📚 API Documentation

### Endpoints

#### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "OK"
}
```

#### Sanitize Data

```http
POST /api/sanitize
Content-Type: application/json

{
  "data": "input string with hidden characters"
}
```

**Response:**

```json
{
  "sanitizedData": "cleaned output string"
}
```

#### n8n Webhook Integration

```http
POST /api/webhook/n8n
Content-Type: application/json

{
  "data": "data for AI processing"
}
```

**Response:**

```json
{
  "result": "Processed: sanitized data"
}
```

### Sanitization Features

The API automatically handles:

- **Zero-width characters**: `\u200B`, `\u200C`, `\u200D`, `\u200E`, `\u200F`
- **Control characters**: `\u0000` through `\u001F` (except `\t`, `\n`, `\r`)
- **Byte order marks**: `\uFEFF`
- **ANSI escape sequences**: Color codes, cursor movement, formatting
- **Bidirectional text marks**: Left-to-right and right-to-left marks

## 🧪 Testing

### Run Test Suite

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

### Manual Testing with Postman

1. Start the server: `npm start`
2. Use Postman to test endpoints:
   - `GET http://localhost:3000/health`
   - `POST http://localhost:3000/api/sanitize` with JSON body
   - `POST http://localhost:3000/api/webhook/n8n` with JSON body

### Testing with n8n

1. Start services: `docker-compose up`
2. Access n8n at `http://localhost:5678` (admin/admin123)
3. Import the sample workflow: `n8n-workflow-sample.json`
4. Test the webhook integration

## 🏗️ Architecture

### Components

- **ProxySanitizer**: Main entry point handling n8n webhooks
- **SanitizationPipeline**: Orchestrates sanitization steps
- **SymbolStripping**: Removes invisible Unicode characters
- **EscapeNeutralization**: Handles ANSI escape sequences
- **UnicodeNormalization**: Prepares text for processing
- **PatternRedaction**: Removes sensitive patterns

### Data Flow

```
Input Data → Unicode Normalization → Symbol Stripping → Escape Neutralization → Pattern Redaction → Output
```

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

### Build Image

```bash
docker build -t mcp-security:latest .
```

### Run Container

```bash
# Basic run
docker run -p 3000:3000 mcp-security:latest

# With environment variables
docker run -p 3000:3000 -e NODE_ENV=production mcp-security:latest

# Run in background
docker run -d -p 3000:3000 --name mcp-security mcp-security:latest
```

### Docker Compose (with n8n)

```bash
# Start both services
docker-compose up

# Run in background
docker-compose up -d

# View logs
docker-compose logs

# Stop services
docker-compose down
```

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

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/braedonmerlodev/MCP-Security/issues)
- **Discussions**: [GitHub Discussions](https://github.com/braedonmerlodev/MCP-Security/discussions)

## 🔒 Security

This project focuses on security for AI systems. Report security vulnerabilities by creating a GitHub issue with the label "security".

---

## References

So, the response is:

<xai:function_call name="bash">
<parameter name="command">git add README.md
