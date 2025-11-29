# tests/test_security_agent.py
"""Tests for the SecurityAgent class"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import json


# Mock the deepagent import since it may not be available in test environment
class MockTool:
    def __init__(self, name, description, function, parameters=None):
        self.name = name
        self.description = description
        self.function = function
        self.parameters = parameters or {}


class MockAgent:
    def __init__(self, name=None, description=None, tools=None):
        self.name = name
        self.description = description
        self.tools = tools or []


# Mock classes for langchain
class MockPromptTemplate:
    def __init__(self, template, input_variables):
        self.template = template
        self.input_variables = input_variables


class MockLLMChain:
    def __init__(self, llm, prompt):
        self.llm = llm
        self.prompt = prompt

    def run(self, **kwargs):
        return '{"document_type": "report", "summary": "Test summary"}'


class MockChatGoogleGenerativeAI:
    def __init__(self, **kwargs):
        pass


# Mock classes for testing
class MockClientSession:
    def __init__(self, **kwargs):
        pass

    async def close(self):
        pass

    def post(self, url, **kwargs):
        return MockResponse()


class MockResponse:
    def __init__(self):
        self.status = 200

    async def json(self):
        return {"sanitizedData": "mocked sanitized content"}

    async def text(self):
        return "error message"


# Mock the deepagent module
deepagent_mock = MagicMock()
deepagent_mock.Agent = MockAgent
deepagent_mock.Tool = MockTool

# Mock langchain modules for testing
langchain_prompts_mock = MagicMock()
langchain_prompts_mock.PromptTemplate = MockPromptTemplate

langchain_chains_mock = MagicMock()
langchain_chains_mock.LLMChain = MockLLMChain

langchain_google_genai_mock = MagicMock()
langchain_google_genai_mock.ChatGoogleGenerativeAI = MockChatGoogleGenerativeAI

aiohttp_mock = MagicMock()
aiohttp_mock.ClientSession = MockClientSession

with patch.dict(
    "sys.modules",
    {
        "deepagent": deepagent_mock,
        "langchain.prompts": langchain_prompts_mock,
        "langchain.chains": langchain_chains_mock,
        "langchain_google_genai": langchain_google_genai_mock,
        "aiohttp": aiohttp_mock,
    },
):
    from agent.security_agent import SecurityAgent


class TestSecurityAgent:
    """Test the SecurityAgent class"""

    def setup_method(self):
        """Setup for each test"""
        self.llm_config = {
            "model": "gemini-2.0-flash",
            "temperature": 0.1,
            "max_tokens": 2000,
            "api_key": "test_key",
            "base_url": None,
        }

    def test_agent_initialization(self):
        """Test agent initialization with tools"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Verify agent was created and has tools
        assert len(agent.tools) == 3
        tool_names = [tool.name for tool in agent.tools]
        assert "sanitize_content" in tool_names
        assert "ai_pdf_enhancement" in tool_names
        assert "chat_response" in tool_names

    def test_agent_with_valid_config(self):
        """Test agent initialization with valid config"""
        agent = SecurityAgent(llm_config=self.llm_config)
        assert agent.name == "MCP Security Agent"
        assert "security agent" in agent.description.lower()
        assert len(agent.tools) == 3  # Should have 3 tools

    def test_agent_tools_structure(self):
        """Test that tools have correct structure"""
        agent = SecurityAgent(llm_config=self.llm_config)

        tool_names = [tool.name for tool in agent.tools]
        assert "sanitize_content" in tool_names
        assert "ai_pdf_enhancement" in tool_names
        assert "chat_response" in tool_names

        # Check tool descriptions
        for tool in agent.tools:
            assert tool.description
            assert tool.parameters
            assert "type" in tool.parameters
            assert "properties" in tool.parameters

    def test_ai_pdf_enhancement_functionality(self):
        """Test the AI PDF enhancement functionality"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Find the enhance tool
        enhance_tool = next(
            (tool for tool in agent.tools if tool.name == "ai_pdf_enhancement"), None
        )
        assert enhance_tool is not None

        # Test the async function
        import asyncio

        result = asyncio.run(
            enhance_tool.function(
                content="Test PDF content", transformation_type="json_schema"
            )
        )

        assert result["success"] == True
        assert "enhanced_content" in result
        assert "structured_output" in result
        assert isinstance(result["structured_output"], dict)
        # Check for mock results
        if "note" in result and "mock" in result["note"]:
            assert result["structured_output"]["document_type"] == "report"
        else:
            assert result["structured_output"]["document_type"] == "report"

    def test_sanitize_content_functionality(self):
        """Test sanitize content functionality"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Find the sanitize tool
        sanitize_tool = next(
            (tool for tool in agent.tools if tool.name == "sanitize_content"), None
        )
        assert sanitize_tool is not None

        # Test the async function
        import asyncio

        # Test general classification
        result = asyncio.run(
            sanitize_tool.function(content="<script>alert('xss')</script>Test content", classification="general")
        )

        assert result["success"] == True
        assert "<script>" not in result["sanitized_content"]
        assert "Test content" in result["sanitized_content"]
        assert result["classification"] == "general"

        # Test API classification
        result = asyncio.run(
            sanitize_tool.function(content="<>&'Test", classification="api")
        )

        assert result["success"] == True
        assert "<>&'" not in result["sanitized_content"]
        assert "Test" in result["sanitized_content"]

    def test_prompt_templates(self):
        """Test that prompt templates are correctly defined"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Test different transformation types
        transformation_types = [
            "structure",
            "summarize",
            "extract_entities",
            "json_schema",
        ]

        for ttype in transformation_types:
            prompt = agent._get_pdf_enhancement_prompt(ttype)
            assert prompt is not None
            assert "{text}" in prompt.template

    def test_output_validation(self):
        """Test AI output validation"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Test valid JSON
        valid_json = '{"key": "value", "number": 42}'
        result = agent._validate_ai_output(valid_json, "json_schema")
        assert result["key"] == "value"
        assert result["number"] == 42

        # Test invalid JSON fallback
        invalid_json = "not json at all"
        result = agent._validate_ai_output(invalid_json, "json_schema")
        assert "validation_error" in result
        assert result["enhanced_text"] == invalid_json

    def test_confidence_calculation(self):
        """Test confidence score calculation"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Test structured output
        structured = {"key": "value", "data": [1, 2, 3]}
        confidence = agent._calculate_confidence(structured)
        assert confidence == 0.8

        # Test empty output
        empty = {}
        confidence = agent._calculate_confidence(empty)
        assert confidence == 0.5

    def test_session_property(self):
        """Test lazy session initialization"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Session should be None initially
        assert agent._session is None

        # Accessing session property should initialize it
        session = agent.session
        assert session is not None
        assert agent._session is not None

    def test_close_method(self):
        """Test session cleanup"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Initialize session
        _ = agent.session
        assert agent._session is not None

        # Close should clean up
        import asyncio

        asyncio.run(agent.close())
        assert agent._session is None
