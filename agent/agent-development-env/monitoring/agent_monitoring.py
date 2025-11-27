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