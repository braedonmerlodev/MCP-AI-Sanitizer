# deepagent.py (Mock for local development)
import asyncio
from typing import List, Callable, Dict, Any, Optional

class Tool:
    def __init__(self, name: str, description: str, function: Callable, parameters: Optional[Dict] = None):
        self.name = name
        self.description = description
        self.function = function
        self.parameters = parameters or {}

class Agent:
    def __init__(self, name: str, description: str, tools: List[Tool]):
        self.name = name
        self.description = description
        self.tools = tools
        self.system_prompt = ""

    def add_tools(self, tools: List[Tool]):
        self.tools.extend(tools)

    def set_system_prompt(self, prompt: str):
        self.system_prompt = prompt

    async def run(self, input_text: str) -> str:
        """
        Mock run method that simulates agent execution.
        In a real scenario, this would call the LLM.
        """
        print(f"\n[DeepAgent Mock] 🤖 Processing input: '{input_text}'")
        print(f"[DeepAgent Mock] 🛠️  Available Tools: {[t.name for t in self.tools]}")
        
        # Simple heuristic to trigger tools for testing
        response = f"Processed: {input_text}"
        
        if "health" in input_text.lower():
            # Find monitor tool
            for tool in self.tools:
                if tool.name == "monitor_system":
                    print(f"[DeepAgent Mock] ⚡ Executing tool: {tool.name}")
                    result = await tool.function()
                    response = f"Health Check Result: {result}"
                    
        elif "analyze" in input_text.lower() or "incident" in input_text.lower():
             for tool in self.tools:
                if tool.name == "learn_from_incidents":
                    print(f"[DeepAgent Mock] ⚡ Executing tool: {tool.name}")
                    result = await tool.function()
                    response = f"Learning Result: {result}"

        return response
