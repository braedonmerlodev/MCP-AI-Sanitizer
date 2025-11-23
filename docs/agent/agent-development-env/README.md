# Agent Development Environment

This directory contains the isolated testing environment for Deep Agent CLI development.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agent Dev     │    │   Proxy Service │    │   Production    │
│   Container     │◄──►│   (Node.js)     │◄──►│   Backend API   │
│                 │    │                 │    │                 │
│ - Deep Agent CLI│    │ - Request proxy │    │ - Sanitization  │
│ - Agent code    │    │ - Response cache│    │ - GPT processing│
│ - Test scripts  │    │ - Rate limiting │    │ - JSON output   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- Access to production backend API
- Deep Agent CLI credentials

### Quick Start

1. **Clone and setup**:

   ```bash
   cd agent-development-env
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Start environment**:

   ```bash
   docker-compose up -d
   ```

3. **Enter development container**:

   ```bash
   docker exec -it agent-dev bash
   ```

4. **Install and test Deep Agent CLI**:
   ```bash
   deep-agent init
   deep-agent test-connection
   ```

## Services

### Agent Development Container

- **Base**: Node.js 18 Alpine
- **Tools**: Deep Agent CLI, Git, Curl
- **Workspace**: Mounted project directory
- **Port**: 3000 (for local development)

### Proxy Service

- **Purpose**: Safe API access to production backend
- **Features**:
  - Request/response proxying
  - Rate limiting (100 requests/hour)
  - Response caching (1 hour)
  - Request logging (no sensitive data)
  - Error handling and fallbacks

## Environment Variables

```bash
# .env file
BACKEND_URL=https://your-production-backend.com
DEEP_AGENT_API_KEY=your-deep-agent-key
PROXY_PORT=3001
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600000  # 1 hour in ms
CACHE_TTL=3600000         # 1 hour in ms
LOG_LEVEL=info
```

## Development Workflow

### Building Agents

```bash
# In agent-dev container
deep-agent create pdf-processor
deep-agent configure --backend-url http://proxy:3001
deep-agent test pdf-sample.json
```

### Testing Integration

```bash
# Test API through proxy
curl -X POST http://localhost:3001/api/process-pdf \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Monitoring

```bash
# Check proxy logs
docker logs proxy-service

# Check rate limits
curl http://localhost:3001/api/status
```

## Safety Features

- **Rate Limiting**: Prevents API abuse (configurable)
- **Response Caching**: Reduces production load
- **Request Logging**: Debug without exposing data
- **Error Isolation**: Container failures don't affect production
- **Data Masking**: Sensitive content never logged

## Troubleshooting

### Common Issues

**Proxy connection fails**:

- Check BACKEND_URL in .env
- Verify production API is accessible
- Check proxy service logs

**Rate limit exceeded**:

- Increase RATE_LIMIT_REQUESTS in .env
- Wait for rate limit window to reset
- Check proxy logs for usage

**Deep Agent CLI issues**:

- Verify DEEP_AGENT_API_KEY
- Check network connectivity in container
- Run `deep-agent doctor` for diagnostics

### Logs and Debugging

```bash
# View all service logs
docker-compose logs

# Follow proxy logs in real-time
docker-compose logs -f proxy

# Enter proxy container for debugging
docker exec -it proxy bash
```

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (caution: deletes cache)
docker-compose down -v
```

## Security Notes

- Never commit .env files with real credentials
- Use read-only API keys when possible
- Monitor proxy logs for unusual activity
- Rotate credentials regularly
- Keep containers updated
