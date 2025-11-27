## Phase 3: Agent Configuration and Prompts

### 3.1 Agent System Prompt

```python
# config/agent_prompts.py
AGENT_SYSTEM_PROMPT = """
You are an autonomous security agent for the MCP-Security system. Your role is to:

1. MONITOR system health and performance through backend APIs
2. LEARN from security incidents, risk assessments, and audit trails
3. DETECT anomalies and potential threats in real-time
4. ORCHESTRATE automated responses using available backend tools
5. IMPROVE continuously through pattern recognition and feedback

Available Tools:
- sanitize_content: Sanitize potentially malicious content
- ai_pdf_enhancement: Enhance PDF text using AI for better structure and readability
- monitor_system: Check system health and detect anomalies
- learn_from_incidents: Analyze recent security incidents for patterns
- orchestrate_response: Execute automated security response actions
- admin_override_tool: Execute administrative override actions (activate, check status)
- job_management: Check status and retrieve results of asynchronous jobs

Guidelines:
- Always validate actions before execution
- Log all decisions and their reasoning
- Escalate to human operators for high-risk situations
- Learn from both successful and failed responses
- Maintain security as the highest priority

Backend Integration:
- **API Reference**: All endpoints documented in openapi-spec.yaml
- **Async Mode**: You use asynchronous processing for all backend operations
- Use provided API endpoints for all operations
- Respect rate limits and authentication requirements
- Handle API errors gracefully with fallback strategies
- Monitor API performance and report issues

Learning Approach:
- Analyze patterns in risk assessment data
- Identify trends in security incidents
- Adapt response strategies based on effectiveness
- Store learnings in LangSmith for future reference
"""

AGENT_TOOLS_CONFIG = {
    "sanitize_content": {
        "description": "Sanitize content using MCP-Security backend (basic or JSON with trust tokens)",
        "when_to_use": "When processing potentially malicious or untrusted content"
    },
    "monitor_system": {
        "description": "Monitor system health, performance metrics, and detect anomalies",
        "when_to_use": "Regular health checks or when investigating performance issues"
    },
    "learn_from_incidents": {
        "description": "Export and analyze recent security incidents for continuous learning",
        "when_to_use": "After incidents or during scheduled learning sessions"
    },
    "orchestrate_response": {
        "description": "Execute automated security response actions (admin override, N8N workflows)",
        "when_to_use": "When threats are detected and automated response is appropriate"
    },
    "admin_override_tool": {
        "description": "Execute administrative override actions",
        "when_to_use": "When emergency administrative access is required"
    },
    "job_management": {
        "description": "Check status and retrieve results of asynchronous jobs",
        "when_to_use": "When monitoring async sanitization operations"
    }
}
```

### 3.2 Agent Initialization

```python
# main.py
from agent.security_agent import SecurityAgent
from agent.monitoring_tools import MonitoringTools
from agent.response_tools import ResponseTools
from agent.job_tools import JobTools
from config.agent_prompts import AGENT_SYSTEM_PROMPT
import asyncio
import os

async def main():
    # Initialize agent with configurable LLM
    llm_config = {
        "model": os.getenv("AGENT_LLM_MODEL", "gpt-4"),  # Default to GPT-4, can change to gpt-3.5-turbo, claude, etc.
        "temperature": 0.1,  # Low temperature for security decisions
        "max_tokens": 2000,
        "api_key": os.getenv("AGENT_LLM_API_KEY"),
        "base_url": os.getenv("AGENT_LLM_BASE_URL")  # For local models or different providers
    }

    agent = SecurityAgent(llm_config=llm_config)

    try:
        # Add specialized tool sets
        monitoring_tools = MonitoringTools(agent)
        response_tools = ResponseTools(agent)
        job_tools = JobTools(agent)

        agent.add_tools([
            monitoring_tools.create_monitoring_tool(),
            monitoring_tools.create_learning_tool(),
            response_tools.create_orchestration_tool(),
            response_tools.create_admin_tool(),
            job_tools.create_job_management_tool()
        ])

        # Configure agent
        agent.set_system_prompt(AGENT_SYSTEM_PROMPT)

        # Start agent with continuous monitoring
        print(f"Starting MCP Security Agent with {llm_config['model']}...")

        # Example: Start with system health check
        result = await agent.run("Perform initial system health check and report any anomalies")
        print(f"Initial health check: {result}")

        # Example: Start learning session
        result = await agent.run("Analyze recent security incidents and identify patterns")
        print(f"Learning session: {result}")

        # Keep agent running for continuous monitoring
        while True:
            try:
                # Periodic health monitoring
                result = await agent.run("Check system status and respond to any issues")
                print(f"Monitoring cycle: {result}")

                # Learning cycle
                result = await agent.run("Review recent activities and update learning models")
                print(f"Learning cycle: {result}")

                await asyncio.sleep(300)  # 5-minute cycles

            except Exception as e:
                print(f"Agent error: {e}")
                await asyncio.sleep(60)  # Wait before retry
    
    finally:
        # Ensure resources are cleaned up
        await agent.close()

if __name__ == "__main__":
    asyncio.run(main())
```

### 3.3 LLM Configuration Options

**Development vs Production LLMs:**

```bash
# Development (for building/testing agent)
export AGENT_LLM_MODEL="gpt-4"  # High capability for complex reasoning
export AGENT_LLM_API_KEY="your-openai-key"

# Production (for running agent)
export AGENT_LLM_MODEL="gpt-3.5-turbo"  # Cost-effective for routine operations
export AGENT_LLM_API_KEY="your-openai-key"

# Alternative providers
export AGENT_LLM_MODEL="claude-3-sonnet"
export AGENT_LLM_BASE_URL="https://api.anthropic.com"
export AGENT_LLM_API_KEY="your-anthropic-key"

# Local models (via Ollama or similar)
export AGENT_LLM_MODEL="llama2:13b"
export AGENT_LLM_BASE_URL="http://localhost:11434"
export AGENT_LLM_API_KEY=""  # Not needed for local
```

**LLM Selection Strategy:**

| Use Case               | Recommended Model            | Reasoning                              |
| ---------------------- | ---------------------------- | -------------------------------------- |
| **Development**        | GPT-4/Claude-3               | Complex reasoning for agent building   |
| **Production Routine** | GPT-3.5-turbo/Claude-3-Haiku | Cost-effective for standard operations |
| **Security Analysis**  | GPT-4/Claude-3               | High reasoning for threat assessment   |
| **Local/Offline**      | Llama 2/3, Mistral           | Privacy, no API costs                  |
| **Specialized**        | Domain-specific models       | Fine-tuned for security tasks          |
