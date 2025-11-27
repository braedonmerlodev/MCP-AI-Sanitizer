# agent/job_tools.py
from deepagent import Tool
from langsmith import traceable
from typing import Dict, Any

class JobTools:
    def __init__(self, agent):
        self.agent = agent

    @traceable(name="job_management")
    def create_job_management_tool(self) -> Tool:
        """Tool for managing asynchronous jobs"""
        async def manage_job(action: str, job_id: str) -> Dict[str, Any]:
            """Check status, get results, or cancel async jobs"""
            try:
                if action == "check_status":
                    endpoint = self.agent.backend_config['endpoints']['job_status'].format(taskId=job_id)
                    method = self.agent.session.get
                elif action == "get_result":
                    endpoint = self.agent.backend_config['endpoints']['job_result'].format(taskId=job_id)
                    method = self.agent.session.get
                elif action == "cancel":
                    endpoint = self.agent.backend_config['endpoints']['job_cancel'].format(taskId=job_id)
                    method = self.agent.session.delete
                else:
                    return {"success": False, "error": f"Unknown action: {action}"}

                async with method(f"{self.agent.backend_config['base_url']}{endpoint}") as response:
                    if response.status == 200:
                        return {
                            "success": True,
                            "data": await response.json()
                        }
                    else:
                        return {
                            "success": False,
                            "error": await response.text(),
                            "status_code": response.status
                        }

            except Exception as e:
                return {"success": False, "error": str(e)}

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
                        "description": "Action to perform on the job"
                    },
                    "job_id": {
                        "type": "string",
                        "description": "ID of the job to manage"
                    }
                },
                "required": ["action", "job_id"]
            }
        )