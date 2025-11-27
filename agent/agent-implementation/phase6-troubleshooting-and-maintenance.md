## Phase 6: Troubleshooting and Maintenance

### 6.1 Common Issues

**API Connection Issues (Async/Aiohttp):**

- **Symptom**: `ClientConnectorError` or `TimeoutError` in logs.
- **Diagnosis**:
  - Check if the backend URL is reachable from the container.
  - Verify `aiohttp` session is not closed prematurely.
  - Ensure SSL certificates are valid if using HTTPS.
- **Action**:
  ```bash
  # Test connectivity from inside container
  docker exec -it mcp-security-agent curl -v https://your-backend/health
  ```

**Job Management Issues (JobTools):**

- **Symptom**: Jobs stuck in `pending` or `processing` state.
- **Diagnosis**:
  - Use `job_management` tool with `action="check_status"` to verify backend state.
  - Check backend logs for worker failures.
- **Action**:
  - Cancel stuck jobs using `action="cancel"`.
  - Restart backend worker service if queue is stalled.

**Admin Override Failures (ResponseTools):**

- **Symptom**: `403 Forbidden` or `401 Unauthorized` when activating override.
- **Diagnosis**:
  - Verify the `BACKEND_API_KEY` has administrative privileges.
  - Check if the override duration exceeds allowed limits.
- **Action**:
  - Rotate API key if suspected compromise.
  - Check backend audit logs for denial reason.

**Performance Issues:**

- **Symptom**: High latency in `sanitize_content` or `ai_pdf_enhancement`.
- **Diagnosis**:
  - Monitor `agent_request_duration_seconds` metric.
  - Check if `gpt-4` is being used for high-volume, low-complexity tasks (switch to `gpt-3.5-turbo`).
- **Action**:
  - Implement request batching.
  - Scale up agent replicas in Kubernetes.

### 6.2 Maintenance Tasks

**Daily:**

- Monitor `agent_health_status` metric (should be 1).
- Review `agent_requests_total` for spike in failures.
- Check for "critical" threat alerts in the last 24h.

**Weekly:**

- **Async Session Cleanup**: Verify no resource leaks (file descriptors, unclosed sessions).
- **Tool Verification**: Run a manual test of `admin_override` and `job_management` tools to ensure end-to-end functionality.
- **Prompt Tuning**: Review LangSmith traces for `ai_pdf_enhancement` to improve extraction accuracy.

**Monthly:**

- **Dependency Updates**: Update `requirements.txt` (especially `deepagent`, `langchain`, `aiohttp`).
- **Security Audit**: Rotate `AGENT_LLM_API_KEY` and `BACKEND_API_KEY`.
- **Disaster Recovery Drill**: Simulate a backend outage and verify agent's graceful degradation.
