## Phase 5: Deployment and Operations

### 5.1 Docker Configuration

Use this Dockerfile for production deployment. It uses Python 3.11 to match the development environment and sets the entry point to the agent's main script.

```dockerfile
# Dockerfile.prod
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONPATH=/app
ENV LANGCHAIN_TRACING_V2=true
ENV PYTHONUNBUFFERED=1

# Expose port for health checks (if implementing a health server)
EXPOSE 8000

# Run agent
CMD ["python", "main.py"]
```

### 5.2 Kubernetes Deployment

Updated deployment configuration including LLM-specific environment variables.

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-security-agent
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-security-agent
  template:
    metadata:
      labels:
        app: mcp-security-agent
    spec:
      containers:
        - name: agent
          image: mcp-security-agent:latest
          env:
            # LangSmith Configuration
            - name: LANGCHAIN_API_KEY
              valueFrom:
                secretKeyRef:
                  name: langsmith-secret
                  key: api-key
            - name: LANGCHAIN_PROJECT
              value: "mcp-security-agent-prod"
            
            # Backend Configuration
            - name: BACKEND_API_KEY
              valueFrom:
                secretKeyRef:
                  name: backend-secret
                  key: api-key
            - name: BACKEND_URL
              value: 'https://mcp-security-backend:443'
            
            # LLM Configuration
            - name: AGENT_LLM_MODEL
              value: "gpt-4"
            - name: AGENT_LLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: llm-secret
                  key: api-key
          
          ports:
            - containerPort: 8000
          resources:
            requests:
              memory: '256Mi'
              cpu: '100m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            exec:
              command:
                - python
                - -c
                - "import requests; requests.get('http://localhost:8000/health')"
            initialDelaySeconds: 30
            periodSeconds: 10
```

### 5.3 Monitoring and Logging

Integrate the `AgentMonitor` class into your `main.py` loop or run it as a sidecar service.

```python
# monitoring/agent_monitoring.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time

# Metrics
AGENT_REQUESTS = Counter('agent_requests_total', 'Total agent requests', ['tool', 'status'])
AGENT_LATENCY = Histogram('agent_request_duration_seconds', 'Agent request duration', ['tool'])
BACKEND_REQUESTS = Counter('backend_requests_total', 'Backend API requests', ['endpoint', 'status'])
AGENT_HEALTH = Gauge('agent_health_status', 'Agent health status')

class AgentMonitor:
    def __init__(self, port=8000):
        self.start_time = time.time()
        # Start Prometheus metrics server
        start_http_server(port)

    def record_agent_request(self, tool_name: str, success: bool):
        status = "success" if success else "failure"
        AGENT_REQUESTS.labels(tool=tool_name, status=status).inc()

    def record_backend_request(self, endpoint: str, success: bool):
        status = "success" if success else "failure"
        BACKEND_REQUESTS.labels(endpoint=endpoint, status=status).inc()

    def update_health_status(self, healthy: bool):
        AGENT_HEALTH.set(1 if healthy else 0)
```

**Integration Strategy:**
1. Initialize `AgentMonitor` in `main.py`.
2. Pass the monitor instance to `SecurityAgent` or its tools.
3. Call `record_backend_request` inside `aiohttp` calls in tool classes.
