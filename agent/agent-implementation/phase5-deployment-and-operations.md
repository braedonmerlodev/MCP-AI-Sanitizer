## Phase 5: Deployment and Operations

### 5.1 Docker Configuration

```dockerfile
# Dockerfile
FROM python:3.9-slim

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

# Expose port for health checks
EXPOSE 8000

# Run agent
CMD ["python", "main.py"]
```

### 5.2 Kubernetes Deployment

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
            - name: LANGCHAIN_API_KEY
              valueFrom:
                secretKeyRef:
                  name: langsmith-secret
                  key: api-key
            - name: BACKEND_API_KEY
              valueFrom:
                secretKeyRef:
                  name: backend-secret
                  key: api-key
            - name: BACKEND_URL
              value: 'https://mcp-security-backend:443'
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
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### 5.3 Monitoring and Logging

```python
# monitoring/agent_monitoring.py
from prometheus_client import Counter, Histogram, Gauge
import time

# Metrics
AGENT_REQUESTS = Counter('agent_requests_total', 'Total agent requests', ['tool', 'status'])
AGENT_LATENCY = Histogram('agent_request_duration_seconds', 'Agent request duration', ['tool'])
BACKEND_REQUESTS = Counter('backend_requests_total', 'Backend API requests', ['endpoint', 'status'])
AGENT_HEALTH = Gauge('agent_health_status', 'Agent health status')

class AgentMonitor:
    def __init__(self):
        self.start_time = time.time()

    def record_agent_request(self, tool_name: str, success: bool):
        status = "success" if success else "failure"
        AGENT_REQUESTS.labels(tool=tool_name, status=status).inc()

    def record_backend_request(self, endpoint: str, success: bool):
        status = "success" if success else "failure"
        BACKEND_REQUESTS.labels(endpoint=endpoint, status=status).inc()

    def update_health_status(self, healthy: bool):
        AGENT_HEALTH.set(1 if healthy else 0)

    def get_metrics(self):
        return {
            "uptime_seconds": time.time() - self.start_time,
            "total_requests": sum(AGENT_REQUESTS._metrics.values()),
            "health_status": AGENT_HEALTH._value
        }
```
