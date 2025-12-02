#!/usr/bin/env python3
"""
Example agent script to test deepagent package functionality
This demonstrates basic agent creation and tool usage
"""

import os
import requests
from deepagent import Agent, Tool
from typing import Dict, Any


class ExampleSecurityAgent(Agent):
    """Example security agent using deepagent package"""

    def __init__(self):
        # Load backend configuration
        self.backend_url = os.environ.get("BACKEND_URL", "http://localhost:3001")

        super().__init__(
            name="Example MCP Security Agent",
            description="Demonstration agent for MCP-Security backend integration",
            tools=self._initialize_tools(),
        )

    def _initialize_tools(self) -> list[Tool]:
        """Initialize agent tools"""
        return [
            self._create_health_check_tool(),
            self._create_sanitization_tool(),
        ]

    def _create_health_check_tool(self) -> Tool:
        """Tool to check backend health"""

        def check_backend_health() -> Dict[str, Any]:
            """Check if the MCP-Security backend is healthy"""
            try:
                response = requests.get(f"{self.backend_url}/health", timeout=10)
                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "response_time": response.elapsed.total_seconds(),
                        "backend_url": self.backend_url,
                    }
                else:
                    return {
                        "status": "unhealthy",
                        "status_code": response.status_code,
                        "backend_url": self.backend_url,
                    }
            except Exception as e:
                return {
                    "status": "error",
                    "error": str(e),
                    "backend_url": self.backend_url,
                }

        return Tool(
            name="check_backend_health",
            description="Check the health status of the MCP-Security backend",
            function=check_backend_health,
        )

    def _validate_trust_token(self, trust_token: dict) -> bool:
        """Validate trust token signature"""
        try:
            import hashlib
            import os
            from datetime import datetime
            secret = os.getenv("TRUST_TOKEN_SECRET", "default-secret-key")
            signature_data = f"{trust_token['contentHash']}.{trust_token['originalHash']}.{trust_token['sanitizationVersion']}.{','.join(trust_token['rulesApplied'])}.{int(datetime.fromisoformat(trust_token['timestamp'].replace('Z', '+00:00')).timestamp())}"
            expected_signature = hashlib.sha256((signature_data + secret).encode('utf-8')).digest().hex()
            return trust_token['signature'] == expected_signature
        except Exception as e:
            print(f"Trust token validation error: {e}")
            return False

    def _create_sanitization_tool(self) -> Tool:
        """Tool for content sanitization"""

        def sanitize_content(content: str) -> Dict[str, Any]:
            """Sanitize content using the backend API"""
            try:
                payload = {"content": content, "classification": "test"}
                response = requests.post(
                    f"{self.backend_url}/api/sanitize/json", json=payload, timeout=30
                )

                if response.status_code == 200:
                    data = response.json()
                    result = {
                        "success": True,
                        "original_content": content,
                        "sanitized_content": data.get("sanitizedContent"),
                        "processing_time": response.elapsed.total_seconds(),
                    }

                    # Extract and display trust token
                    trust_token = data.get("trustToken")
                    if trust_token:
                        result["trust_token"] = trust_token
                        print("\n🔐 Trust Token Validation:")
                        print(f"✅ Content Hash: {trust_token['contentHash']}")
                        print(f"✅ Signature: {trust_token['signature'][:16]}...")
                        print(f"✅ Valid Until: {trust_token['expiresAt']}")
                        print(f"✅ Rules Applied: {', '.join(trust_token['rulesApplied'])}")

                        # Validate trust token
                        is_valid = self._validate_trust_token(trust_token)
                        if is_valid:
                            print("✅ Trust Token: VALID")
                        else:
                            print("❌ Trust Token: INVALID")
                    else:
                        print("\n❌ No trust token found!")

                    return result
                else:
                    return {
                        "success": False,
                        "error": f"API returned {response.status_code}",
                        "response": response.text,
                    }
            except Exception as e:
                return {"success": False, "error": str(e)}

        return Tool(
            name="sanitize_content",
            description="Sanitize potentially malicious content using MCP-Security backend",
            function=sanitize_content,
            parameters={
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "Content to sanitize"}
                },
                "required": ["content"],
            },
        )


def main():
    """Main function to demonstrate agent usage"""
    print("Creating example security agent...")

    try:
        agent = ExampleSecurityAgent()
        print(f"✓ Agent '{agent.name}' created successfully")
        print(f"  Description: {agent.description}")
        print(f"  Available tools: {len(agent.tools)}")

        # List available tools
        print("\nAvailable tools:")
        for tool in agent.tools:
            print(f"  - {tool.name}: {tool.description}")

        # Test backend connectivity
        print("\nTesting backend connectivity...")
        health_result = agent.tools[0].function()
        print(f"Backend health: {health_result}")

        # Test sanitization if backend is available
        if health_result.get("status") == "healthy":
            print("\nTesting content sanitization...")
            test_content = "Hello <script>alert('test')</script> world"
            sanitize_result = agent.tools[1].function(test_content)
            print(f"Sanitization result: {sanitize_result}")

        print("\n🎉 Agent setup and testing completed successfully!")

    except Exception as e:
        print(f"✗ Error creating or running agent: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
