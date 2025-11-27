# config/backend_config.py
BACKEND_CONFIG = {
    "base_url": "https://your-mcp-security-backend.com",
    "api_key": "your-backend-api-key",
    "endpoints": {
        "sanitize": "/api/sanitize/json",  # Bi-directional AI processing available
        "validate_token": "/api/trust-tokens/validate",
        "upload_document": "/api/documents/upload",  # AI processing enabled by default
        "generate_pdf": "/api/documents/generate-pdf",
        "n8n_webhook": "/api/webhook/n8n",
        "export_data": "/api/export/training-data",
        "monitoring": "/api/monitoring/reuse-stats",
        "health": "/health",
        "admin_override_activate": "/api/admin/override/activate",
        "admin_override_deactivate": "/api/admin/override/{overrideId}",
        "admin_override_status": "/api/admin/override/status",
        "job_status": "/api/jobs/{taskId}/status",
        "job_result": "/api/jobs/{taskId}/result",
        "job_cancel": "/api/jobs/{taskId}"
    },
    "rate_limits": {
        "sanitize": 100,  # requests per minute (bi-directional AI processing)
        "upload_document": 25,  # lower for AI processing (resource intensive)
        "monitoring": 60,
        "export": 10,
        "job_status": 120  # higher for status checks
    }
}