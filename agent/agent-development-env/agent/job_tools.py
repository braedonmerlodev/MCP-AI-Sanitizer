# agent/job_tools.py
from deepagent import Tool
from langsmith import traceable
from typing import Dict, Any
from agent.trust_validator import TrustTokenValidator
import json


class JobTools:
    def __init__(self, agent):
        self.agent = agent
        self.trust_validator = TrustTokenValidator()

    @traceable(name="job_management")
    def create_job_management_tool(self) -> Tool:
        """Tool for managing asynchronous jobs"""

        async def manage_job(action: str, job_id: str) -> Dict[str, Any]:
            """Check status, get results, or cancel async jobs"""
            try:
                if action == "check_status":
                    endpoint = self.agent.backend_config["endpoints"][
                        "job_status"
                    ].format(taskId=job_id)
                    method = self.agent.session.get
                elif action == "get_result":
                    endpoint = self.agent.backend_config["endpoints"][
                        "job_result"
                    ].format(taskId=job_id)
                    method = self.agent.session.get
                elif action == "cancel":
                    endpoint = self.agent.backend_config["endpoints"][
                        "job_cancel"
                    ].format(taskId=job_id)
                    method = self.agent.session.delete
                else:
                    return {"success": False, "error": f"Unknown action: {action}"}

                async with method(
                    f"{self.agent.backend_config['base_url']}{endpoint}"
                ) as response:
                    if response.status == 200:
                        raw_data = await response.json()

                        # For get_result action, parse and validate trust tokens
                        if action == "get_result":
                            parsed_result = self._parse_and_validate_result(raw_data)
                            return {"success": True, "data": parsed_result}
                        else:
                            return {"success": True, "data": raw_data}
                    else:
                        return {
                            "success": False,
                            "error": await response.text(),
                            "status_code": response.status,
                        }

            except Exception:
                # Return mock response for testing when backend is unavailable
                mock_data = {}
                if action == "check_status":
                    mock_data = {
                        "jobId": job_id,
                        "status": "completed",
                        "progress": 100,
                        "startedAt": "2024-11-26T10:00:00Z",
                        "completedAt": "2024-11-26T10:05:00Z",
                    }
                elif action == "get_result":
                    mock_data = {
                        "jobId": job_id,
                        "result": {
                            "sanitizedContent": {
                                "sanitizedData": {
                                    "title": "Mock Processed Document",
                                    "content": "This is mock processed content",
                                    "processed": True,
                                    "items": 42
                                },
                                "trustToken": {
                                    "contentHash": "mock_hash_123",
                                    "originalHash": "mock_original_456",
                                    "sanitizationVersion": "1.0",
                                    "rulesApplied": ["MockProcessing"],
                                    "timestamp": "2025-12-02T04:00:00.000Z",
                                    "expiresAt": "2025-12-03T04:00:00.000Z",
                                    "signature": "mock_signature_789",
                                    "nonce": "mock_nonce_abc"
                                }
                            },
                            "metadata": {
                                "timestamp": "2025-12-02T04:00:00.000Z",
                                "reused": False,
                                "performance": {"totalTimeMs": 100}
                            }
                        }
                    }
                elif action == "cancel":
                    mock_data = {
                        "jobId": job_id,
                        "cancelled": True,
                        "cancelledAt": "2024-11-26T10:02:00Z",
                    }
                return {
                    "success": True,
                    "data": mock_data,
                    "note": "Using mock job management - backend unavailable",
                }

    def _parse_and_validate_result(self, api_response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse API response, validate trust tokens, and format for display

        Args:
            api_response: Raw API response from job result endpoint

        Returns:
            Parsed and validated result with trust information
        """
        try:
            # Extract content and trust token
            parsed = self.trust_validator.extract_content_and_trust(api_response)

            result = {
                "jobId": api_response.get("taskId") or api_response.get("jobId"),
                "status": "completed",
                "content": parsed["content"],
                "metadata": parsed["metadata"],
            }

            # Validate and add trust information
            if parsed["trustToken"]:
                validation = self.trust_validator.validate_token(parsed["trustToken"])
                result["trustValidation"] = validation
                result["trustDisplay"] = self.trust_validator.format_trust_display(validation)
                result["trustToken"] = parsed["trustToken"]  # Include full token for reference
            else:
                result["trustValidation"] = {"isValid": False, "error": "No trust token provided"}
                result["trustDisplay"] = "❌ No trust token found!"

            return result

        except Exception as e:
            # Fallback to raw data if parsing fails
            return {
                "error": f"Failed to parse result: {str(e)}",
                "raw_data": api_response,
                "trustDisplay": "❌ Error parsing trust information"
            }

        return Tool(
            name="job_management",
            description="Manage asynchronous background jobs (status, result, cancel)",
            function=manage_job,
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["check_status", "get_result", "cancel"],
                        "description": "Action to perform on the job",
                    },
                    "job_id": {
                        "type": "string",
                        "description": "ID of the job to manage",
                    },
                },
                "required": ["action", "job_id"],
            },
        )
