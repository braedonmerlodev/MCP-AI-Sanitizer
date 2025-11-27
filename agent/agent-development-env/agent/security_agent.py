# agent/security_agent.py
import os
from deepagent import Agent, Tool
from langsmith import traceable
from config.backend_config import BACKEND_CONFIG
import aiohttp
import json
from typing import Dict, Any

class SecurityAgent(Agent):
    def __init__(self, llm_config: Dict[str, Any] = None):
        super().__init__(
            name="MCP Security Agent",
            description="Autonomous security agent for MCP-Security backend",
            tools=self._initialize_tools()
        )
        self.backend_config = BACKEND_CONFIG
        self.llm_config = llm_config
        self.session = aiohttp.ClientSession(headers={
            "Authorization": f"Bearer {self.backend_config['api_key']}",
            "Content-Type": "application/json"
        })

    def _initialize_tools(self) -> list[Tool]:
        """Initialize core intrinsic tools"""
        return [
            self._create_sanitization_tool(),
            self._create_ai_pdf_tool()
        ]

    async def close(self):
        """Close the aiohttp session"""
        if self.session:
            await self.session.close()

    @traceable(name="ai_pdf_enhancement")
    def _create_ai_pdf_tool(self) -> Tool:
        """Tool for AI-powered PDF text enhancement"""
        def enhance_pdf_text(content: str, transformation_type: str = "structure") -> Dict[str, Any]:
            """Enhance PDF text using Langchain and Gemini models"""
            try:
                from langchain.chains import LLMChain
                from langchain.prompts import PromptTemplate
                from langchain_google_genai import ChatGoogleGenerativeAI

                # Initialize Langchain components
                api_key = self.llm_config.get("api_key") if self.llm_config else None
                llm = ChatGoogleGenerativeAI(
                    temperature=0.1, 
                    model="gemini-1.5-flash",
                    google_api_key=api_key
                )
                prompt = self._get_pdf_enhancement_prompt(transformation_type)

                chain = LLMChain(llm=llm, prompt=prompt)

                # Process content through AI pipeline
                enhanced_content = chain.run(text=content)

                # Validate and structure output
                structured_output = self._validate_ai_output(enhanced_content, transformation_type)

                return {
                    "success": True,
                    "original_content": content,
                    "enhanced_content": enhanced_content,
                    "structured_output": structured_output,
                    "transformation_type": transformation_type,
                    "processing_metadata": {
                        "model_used": "gemini-1.5-flash",
                        "processing_time": "calculated",
                        "confidence_score": self._calculate_confidence(structured_output)
                    }
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"AI enhancement failed: {str(e)}",
                    "fallback_content": content  # Return original if AI fails
                }

        return Tool(
            name="ai_pdf_enhancement",
            description="Enhance PDF text using AI for better structure and readability",
            function=enhance_pdf_text,
            parameters={
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "Raw PDF text to enhance"},
                    "transformation_type": {
                        "type": "string",
                        "enum": ["structure", "summarize", "extract_entities", "json_schema"],
                        "description": "Type of AI transformation to apply"
                    }
                },
                "required": ["content"]
            }
        )

    def _get_pdf_enhancement_prompt(self, transformation_type: str) -> Any:
        """Get appropriate prompt template for transformation type"""
        from langchain.prompts import PromptTemplate
        prompts = {
            "structure": """
            Transform the following raw PDF text into well-structured, readable content.
            Improve formatting, fix any OCR errors, and organize the content logically.
            Maintain all important information while making it more readable:

            Raw text: {text}

            Structured output:
            """,
            "summarize": """
            Create a concise summary of the following PDF content, highlighting key points and main ideas:

            Content: {text}

            Summary:
            """,
            "extract_entities": """
            Extract and categorize key entities from the following text (people, organizations, dates, locations, etc.):

            Text: {text}

            Extracted entities:
            """,
            "json_schema": """
            Convert the following text into a structured JSON format with appropriate keys and values.
            Identify logical sections and create a hierarchical JSON structure:

            Text: {text}

            JSON output:
            """
        }
        return PromptTemplate(template=prompts[transformation_type], input_variables=["text"])

    def _validate_ai_output(self, output: str, transformation_type: str) -> Dict[str, Any]:
        """Validate and structure AI output"""
        try:
            if transformation_type == "json_schema":
                # Parse JSON output
                return json.loads(output)
            else:
                # Return structured text
                return {"enhanced_text": output, "word_count": len(output.split())}
        except json.JSONDecodeError:
            # Fallback for invalid JSON
            return {"enhanced_text": output, "validation_error": "Invalid JSON structure"}

    def _calculate_confidence(self, structured_output: Dict) -> float:
        """Calculate confidence score for AI output"""
        # Simple confidence calculation based on output structure
        if isinstance(structured_output, dict) and len(structured_output) > 0:
            return 0.8  # High confidence for structured output
        return 0.5  # Medium confidence for text-only output

    @traceable(name="sanitize_content")
    def _create_sanitization_tool(self) -> Tool:
        """Tool for content sanitization"""
        async def sanitize_content(content: str, classification: str = "general") -> Dict[str, Any]:
            """Sanitize content using backend API"""
            payload = {
                "data": content,
                "classification": classification
            }

            try:
                async with self.session.post(
                    f"{self.backend_config['base_url']}{self.backend_config['endpoints']['sanitize']}",
                    json=payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "success": True,
                            "sanitized_content": data.get("sanitizedData"),
                            "processing_time": "calculated"
                        }
                    else:
                        text = await response.text()
                        return {
                            "success": False,
                            "error": text,
                            "status_code": response.status
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
                    "content": {"type": "string", "description": "Content to sanitize"},
                    "classification": {"type": "string", "description": "Content classification (general, llm, api)"}
                },
                "required": ["content"]
            }
        )