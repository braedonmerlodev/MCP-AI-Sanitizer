# main.py
from agent.security_agent import SecurityAgent
from agent.monitoring_tools import MonitoringTools
from agent.response_tools import ResponseTools
from agent.job_tools import JobTools
from config.agent_prompts import AGENT_SYSTEM_PROMPT
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


async def main():
    # Initialize agent with configurable LLM
    llm_config = {
        "model": os.getenv("AGENT_LLM_MODEL", "gemini-2.0-flash"),  # Default to Gemini
        "temperature": 0.1,  # Low temperature for security decisions
        "max_tokens": 2000,
        "api_key": os.getenv("GEMINI_API_KEY"),
        "base_url": os.getenv(
            "AGENT_LLM_BASE_URL"
        ),  # For local models or different providers
    }

    agent = SecurityAgent(llm_config=llm_config)

    try:
        # Add specialized tool sets
        monitoring_tools = MonitoringTools(agent)
        response_tools = ResponseTools(agent)
        job_tools = JobTools(agent)

        agent.add_tools(
            [
                monitoring_tools.create_monitoring_tool(),
                monitoring_tools.create_learning_tool(),
                response_tools.create_orchestration_tool(),
                response_tools.create_admin_tool(),
                job_tools.create_job_management_tool(),
            ]
        )

        # Configure agent
        agent.set_system_prompt(AGENT_SYSTEM_PROMPT)

        # Start agent with continuous monitoring
        print(f"Starting MCP Security Agent with {llm_config['model']}...")

        # Example: Start with system health check
        result = await agent.run(
            "Perform initial system health check and report any anomalies"
        )
        print(f"Initial health check: {result}")

        # Example: Start learning session
        result = await agent.run(
            "Analyze recent security incidents and identify patterns"
        )
        print(f"Learning session: {result}")

        # Keep agent running for continuous monitoring
        while True:
            try:
                # Periodic health monitoring
                result = await agent.run(
                    "Check system status and respond to any issues"
                )
                print(f"Monitoring cycle: {result}")

                # Learning cycle
                result = await agent.run(
                    "Review recent activities and update learning models"
                )
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
