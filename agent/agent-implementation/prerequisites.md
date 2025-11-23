## Prerequisites

### System Requirements

- **Python 3.8+** for agent development
- **Node.js 18+** (existing backend requirement)
- **Docker** for containerization
- **Kubernetes** cluster for production deployment
- **LangSmith API access** and credentials

### Backend Requirements

- MCP-Security backend deployed and accessible
- All API endpoints functional (verified via health check)
- Database with audit logs and risk assessment data
- Admin access for initial agent configuration
- **API Documentation**: Complete OpenAPI 3.0.3 specification available at [openapi-spec.yaml](../openapi-spec.yaml)

### Agent-Ready API Verification

The backend APIs have been verified against the agent-ready checklist for optimal LLM integration:

#### ✅ **Intent-Based Endpoints**: All endpoints are smart, encapsulating business logic without requiring orchestration.

#### ✅ **Comprehensive OpenAPI Schema**: Descriptions are natural language, agent-aware (e.g., "Agents automatically use synchronous mode").

#### ✅ **Asynchronous Task Support**: Full async support via job management endpoints and 202 responses for long-running tasks.

#### ✅ **Agent-Aware Security**: Uses trust tokens and API keys for per-user authentication.

#### ✅ **Bi-Directional AI Processing**: Complete AI intelligence for both inbound (PDF) and outbound (JSON) traffic flows.

#### ✅ **Semantic, Context-Rich Responses**: All active endpoints provide rich context with metadata, performance metrics, and AI processing information.

**MVP Impact**: All core endpoints are fully agent-ready with bi-directional AI processing. The deprecated `/api/sanitize` endpoint has been removed for cleaner API surface.

### AI Enhancement Dependencies

**Requirements for Bi-Directional AI Processing:**

- **Langchain**: `pip install langchain openai`
- **OpenAI API Access**: GPT-3.5-turbo or GPT-4 API key
- **Enhanced Backend APIs**: Bi-directional AI processing (PDF upload + JSON sanitization)
- **Security Validation**: Double sanitization pipeline (pre and post AI processing)
- **Automatic AI for PDFs**: AI processing enabled by default for all PDF uploads
- **Optional AI for JSON**: Configurable AI enhancement for JSON responses

**Agent AI Capabilities**:

- **Bi-directional AI processing**: Intelligent transformation for both inbound and outbound traffic
- **Automatic PDF enhancement**: All PDF uploads get AI processing by default
- **Flexible JSON processing**: Optional AI enhancement for JSON responses (structure/summarize/analyze)
- Text transformation using Langchain pipelines
- GPT-powered content structuring and summarization
- JSON schema generation from unstructured text
- Quality validation of AI-generated outputs
- Context-aware content understanding and transformation

### AI Processing Usage Guide

#### PDF Upload with Automatic AI Enhancement

```python
# AI processing is enabled by default - no parameters needed
response = requests.post(
    f"{backend_url}/api/documents/upload",
    files={"pdf": open("document.pdf", "rb")},
    headers={"Authorization": f"Bearer {api_key}"}
)
# Returns: Intelligent structured JSON from AI processing
```

#### JSON Sanitization with Optional AI Enhancement

```python
# Basic sanitization (no AI)
response = requests.post(
    f"{backend_url}/api/sanitize/json",
    json={"content": "raw json data"},
    headers={"Authorization": f"Bearer {api_key}"}
)

# AI-enhanced sanitization
response = requests.post(
    f"{backend_url}/api/sanitize/json",
    json={
        "content": "raw json data",
        "ai_transform": true,
        "ai_transform_type": "structure"  # or "summarize" or "analyze"
    },
    headers={"Authorization": f"Bearer {api_key}"}
)
```

#### AI Transform Types

- **`structure`**: Convert unstructured data to structured JSON schema
- **`summarize`**: Generate intelligent summaries of content
- **`analyze`**: Provide detailed content analysis and insights

### Development Environment

```bash
# Install Python dependencies
pip install deepagent-cli langsmith openai requests python-dotenv

# Install Node.js dependencies (if needed for testing)
npm install -g @modelcontextprotocol/sdk
```
