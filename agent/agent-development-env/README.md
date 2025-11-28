# Agent Development Environment

This directory contains the isolated testing environment for deepagent package development.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agent Dev     │    │   Proxy Service │    │   Production    │    │   Monitoring    │
│   Container     │◄──►│   (Node.js)     │◄──►│   Backend API   │◄──►│   Dashboard     │
│                 │    │                 │    │                 │    │                 │
│ - deepagent pkg │    │ - Request proxy │    │ - Sanitization  │    │ - Performance   │
│ - Agent code    │    │ - Response cache│    │ - GPT processing│    │ - Metrics       │
│ - Test scripts  │    │ - Error handling │    │ - JSON output   │    │ - Alerts        │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- Access to production backend API
- Python environment with deepagent package
- LangSmith and OpenAI API credentials

### Quick Start

1. **Setup environment**:

   ```bash
   cd agent-development-env
   cp .env.example .env
   # Edit .env with your backend URL and other credentials
   ```

2. **Start environment**:

   ```bash
   docker-compose up -d
   ```

3. **Enter development container**:

   ```bash
   docker exec -it agent-dev bash
   ```

4. **Verify deepagent package installation**:

   ```bash
   # Run the comprehensive test script
   python test-setup.py

   # Or test manually
   python -c "from deepagent import Agent, Tool; print('deepagent package ready')"
   ```

## Services

### Agent Development Container

- **Base**: Python 3.11 Slim
- **Tools**: deepagent package, Git, Curl, Python development tools
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
# DEEP_AGENT_API_KEY=your-deep-agent-key  # Not needed when using deepagent package
PROXY_PORT=3001
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600000  # 1 hour in ms
CACHE_TTL=3600000         # 1 hour in ms
LOG_LEVEL=info

# Additional Python environment variables
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=your-langsmith-api-key
LANGCHAIN_PROJECT=mcp-security-agent
OPENAI_API_KEY=your-openai-api-key
```

## Python Dependencies

The `requirements.txt` file contains all necessary Python packages:

- `deepagent`: Core agent framework
- `langsmith`: For agent memory and tracing
- `openai`: For AI processing capabilities
- `requests`: For API communication
- `python-dotenv`: For environment variable management
- Additional development tools (pytest, black, flake8)

To add new dependencies:

1. Edit `requirements.txt`
2. Rebuild the container: `docker-compose up --build agent-dev`

## Development Workflow

### Building Agents

```bash
# In agent-dev container - using deepagent package directly

# Test package import
python -c "from deepagent import Agent, Tool; print('deepagent package ready')"

# Run the comprehensive test script
python test-setup.py

# Run the example agent to test integration
python example-agent.py

# Create and run your custom agent
python -c "
from deepagent import Agent, Tool

class MyAgent(Agent):
    def __init__(self):
        super().__init__(name='My Custom Agent', description='Custom security agent')

agent = MyAgent()
print('Agent created successfully')
"

# Run your agent implementation from the mounted project
python ../agent-implementation/your_agent_file.py
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

**deepagent package issues**:

- Verify Python version: `python --version` (should be 3.8+)
- Check package installation: `pip list | grep deepagent`
- Test imports: `python -c "from deepagent import Agent, Tool"`
- Check environment variables: `python -c "import os; print(os.environ.get('BACKEND_URL'))"`
- Verify backend connectivity: `curl $BACKEND_URL/health`

### Logs and Debugging

```bash
# View all service logs
docker-compose logs

# Follow proxy logs in real-time
docker-compose logs -f proxy

# Enter proxy container for debugging
docker exec -it proxy bash
```

## Performance Monitoring

The system includes comprehensive performance monitoring for PDF processing and system metrics.

### Features

- **Real-time Metrics**: Prometheus metrics for request counts, durations, and success rates
- **System Monitoring**: CPU, memory, and connection tracking
- **Performance Alerts**: Automatic alerting for performance degradation
- **Visual Dashboard**: Streamlit-based monitoring dashboard

### Running the Monitoring Dashboard

```bash
# Start the monitoring dashboard (requires backend running)
python run_monitoring.py

# Dashboard will be available at http://localhost:8501
```

### Metrics Collected

- **PDF Processing**:
  - Request counts by status (success, failed, rate limited, etc.)
  - Processing duration by stage (validation, extraction, sanitization, enhancement)
  - File size distribution
  - Success rates and error tracking

- **Chat System**:
  - Request counts and response times
  - Error rates and performance metrics

- **System Resources**:
  - CPU and memory usage
  - Active WebSocket connections
  - Background task performance

### Alerting

Configure email alerts by setting these environment variables:

```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ALERT_EMAIL=alerts@yourcompany.com
```

Alerts are triggered for:

- PDF processing duration > 30 seconds
- PDF failure rate > 10%
- Chat response time > 10 seconds
- CPU usage > 90%
- Memory usage > 90%
- Too many active connections

### Prometheus Metrics

Metrics are exposed on port 8000 at `/metrics` endpoint for integration with monitoring systems like Grafana.

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
