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

# Mock the imports
with patch.dict('sys.modules', {
    'deepagent': MagicMock(),
    'deepagent.Agent': MockAgent,
    'deepagent.Tool': MockTool,
}):
    from agent.security_agent import SecurityAgent


class TestSecurityAgent:
    """Test the SecurityAgent class"""

    def setup_method(self):
        """Setup for each test"""
        self.llm_config = {
            "model": "gemini-1.5-flash",
            "temperature": 0.1,
            "max_tokens": 2000,
            "api_key": "test_key",
            "base_url": None
        }

    @patch('agent.security_agent.Tool')
    def test_agent_initialization(self, mock_tool_class):
        """Test agent initialization with tools"""
        # Mock the tools that get created
        mock_sanitize_tool = MagicMock()
        mock_sanitize_tool.name = "sanitize_content"

        mock_enhance_tool = MagicMock()
        mock_enhance_tool.name = "ai_pdf_enhancement"

        mock_tool_class.side_effect = [mock_sanitize_tool, mock_enhance_tool]

        agent = SecurityAgent(llm_config=self.llm_config)

        # Verify agent was created and has tools
        assert len(agent.tools) == 2
        assert agent.tools[0].name == "sanitize_content"
        assert agent.tools[1].name == "ai_pdf_enhancement"

    def test_agent_with_valid_config(self):
        """Test agent initialization with valid config"""
        agent = SecurityAgent(llm_config=self.llm_config)
        assert agent.name == "MCP Security Agent"
        assert "security agent" in agent.description.lower()
        assert len(agent.tools) == 2  # Should have 2 tools

    def test_agent_tools_structure(self):
        """Test that tools have correct structure"""
        agent = SecurityAgent(llm_config=self.llm_config)

        tool_names = [tool.name for tool in agent.tools]
        assert "sanitize_content" in tool_names
        assert "ai_pdf_enhancement" in tool_names

        # Check tool descriptions
        for tool in agent.tools:
            assert tool.description
            assert tool.parameters
            assert "type" in tool.parameters
            assert "properties" in tool.parameters

    @patch('agent.security_agent.ChatGoogleGenerativeAI')
    @patch('agent.security_agent.LLMChain')
    def test_ai_pdf_enhancement_functionality(self, mock_chain_class, mock_llm_class):
        """Test the AI PDF enhancement functionality"""
        # Mock LLM components
        mock_llm_instance = MagicMock()
        mock_llm_class.return_value = mock_llm_instance

        mock_chain_instance = MagicMock()
        mock_chain_instance.run.return_value = '{"document_type": "report", "summary": "Test summary"}'
        mock_chain_class.return_value = mock_chain_instance

        agent = SecurityAgent(llm_config=self.llm_config)

        # Find the enhance tool
        enhance_tool = next((tool for tool in agent.tools if tool.name == "ai_pdf_enhancement"), None)
        assert enhance_tool is not None

        # Test the async function
        import asyncio
        result = asyncio.run(enhance_tool.function(
            content="Test PDF content",
            transformation_type="json_schema"
        ))

        assert result["success"] == True
        assert "enhanced_content" in result
        assert "structured_output" in result
        assert isinstance(result["structured_output"], dict)
        assert result["structured_output"]["document_type"] == "report"

    def test_sanitize_content_fallback(self):
        """Test sanitize content fallback when backend is unavailable"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Find the sanitize tool
        sanitize_tool = next((tool for tool in agent.tools if tool.name == "sanitize_content"), None)
        assert sanitize_tool is not None

        # Test the async function (should use fallback)
        import asyncio
        result = asyncio.run(sanitize_tool.function(
            content="Test content",
            classification="general"
        ))

        # Should return mock sanitized content
        assert result["success"] == True
        assert "SANITIZED" in result["sanitized_content"]
        assert result["note"] == "Using mock sanitization - backend unavailable"

    def test_prompt_templates(self):
        """Test that prompt templates are correctly defined"""
        agent = SecurityAgent(llm_config=self.llm_config)

        # Test different transformation types
        transformation_types = ["structure", "summarize", "extract_entities", "json_schema"]

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
        invalid_json = 'not json at all'
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