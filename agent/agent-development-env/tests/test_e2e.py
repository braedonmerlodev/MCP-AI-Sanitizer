# tests/test_e2e.py
"""End-to-End tests for the complete PDF processing and chat system"""
import pytest
import io
import json
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import os

from backend.api import app


class TestEndToEndUserJourney:
    """E2E tests simulating complete user journeys"""

    def setup_method(self):
        """Setup for each test"""
        self.client = TestClient(app)
        # Clear rate limit store
        from backend.api import rate_limit_store
        rate_limit_store.clear()

    @patch.dict(os.environ, {
        "API_KEY": "test_key",
        "AGENT_LLM_MODEL": "gemini-2.0-flash",
        "GEMINI_API_KEY": "test_gemini_key",
        "ENV": "development"
    })
    @patch('backend.api.check_rate_limit')
    @patch('backend.api.authenticate_request')
    @patch('backend.api.validate_file_type')
    @patch('backend.api.extract_pdf_text')
    @patch('backend.api.get_agent')
    def test_complete_pdf_upload_and_chat_journey(self, mock_get_agent, mock_extract, mock_validate, mock_auth, mock_rate_limit):
        """Test complete user journey: upload PDF, process it, then chat about it"""
        # Setup mocks for consistent behavior
        mock_rate_limit.return_value = True
        mock_auth.return_value = True
        mock_validate.return_value = True
        mock_extract.return_value = """
        Security Assessment Report

        Executive Summary:
        This report details the security assessment of our MCP Security system.
        Key findings include strong encryption implementation and secure API endpoints.

        Technical Details:
        - Encryption: AES-256 with proper key management
        - Authentication: Bearer token with rate limiting
        - Input validation: Comprehensive sanitization of all inputs
        - File processing: Secure PDF text extraction and enhancement

        Recommendations:
        1. Implement regular security audits
        2. Monitor rate limiting effectiveness
        3. Keep dependencies updated
        """

        # Mock the security agent
        mock_agent = MagicMock()

        # Sanitize tool
        mock_sanitize_tool = MagicMock()
        mock_sanitize_tool.name = "sanitize_content"
        mock_sanitize_tool.function = AsyncMock(return_value={
            "success": True,
            "sanitized_content": "Security Assessment Report - Executive Summary: This report details the security assessment of our MCP Security system. Key findings include strong encryption implementation and secure API endpoints. [Content sanitized for security]",
            "processing_time": "0.23s"
        })

        # Enhance tool
        mock_enhance_tool = MagicMock()
        mock_enhance_tool.name = "ai_pdf_enhancement"
        mock_enhance_tool.function = AsyncMock(return_value={
            "success": True,
            "enhanced_content": "Comprehensive security assessment reveals robust implementation with strong encryption (AES-256), secure authentication mechanisms, and comprehensive input validation. The system demonstrates good security practices including rate limiting and secure file processing.",
            "structured_output": {
                "document_type": "security_assessment",
                "security_score": 8.5,
                "key_findings": [
                    "Strong encryption implementation",
                    "Secure API endpoints",
                    "Comprehensive input validation",
                    "Proper rate limiting"
                ],
                "recommendations": [
                    "Regular security audits",
                    "Monitor rate limiting",
                    "Update dependencies"
                ],
                "risk_level": "low",
                "compliance_status": "good"
            },
            "processing_metadata": {
                "processing_time": "3.45s",
                "model_used": "gemini-2.0-flash",
                "tokens_used": 450
            }
        })

        mock_agent.tools = [mock_sanitize_tool, mock_enhance_tool]
        mock_get_agent.return_value = mock_agent

        headers = {"Authorization": "Bearer test_key"}

        # Step 1: Upload and process PDF
        pdf_content = b'%PDF-1.4\n%Mock security report PDF'
        files = {"file": ("security_report.pdf", io.BytesIO(pdf_content), "application/pdf")}

        pdf_response = self.client.post("/api/process-pdf", files=files, headers=headers)
        assert pdf_response.status_code == 200

        pdf_data = pdf_response.json()
        assert pdf_data["success"] == True
        assert "structured_output" in pdf_data
        assert pdf_data["structured_output"]["document_type"] == "security_assessment"

        # Step 2: Chat about the processed document
        with patch('backend.api.LLMChain') as mock_chain_class:
            mock_chain = MagicMock()
            mock_chain.run.return_value = "Based on the security assessment, the system has strong encryption with AES-256, secure API endpoints, and comprehensive input validation. The overall security score is 8.5 out of 10, indicating good security practices."
            mock_chain_class.return_value = mock_chain

            chat_data = {
                "message": "What is the security score and what are the main recommendations?",
                "context": {
                    "processed_data": pdf_data["structured_output"]
                }
            }

            chat_response = self.client.post("/api/chat", json=chat_data, headers=headers)
            assert chat_response.status_code == 200

            chat_result = chat_response.json()
            assert chat_result["success"] == True
            assert "security score" in chat_result["response"].lower()
            assert "recommendations" in chat_result["response"].lower()

    @patch.dict(os.environ, {
        "API_KEY": "test_key",
        "AGENT_LLM_MODEL": "gemini-2.0-flash",
        "GEMINI_API_KEY": "test_gemini_key",
        "ENV": "development"
    })
    @patch('backend.api.check_rate_limit')
    @patch('backend.api.authenticate_request')
    @patch('backend.api.validate_file_type')
    @patch('backend.api.extract_pdf_text')
    @patch('backend.api.get_agent')
    def test_error_recovery_journey(self, mock_get_agent, mock_extract, mock_validate, mock_auth, mock_rate_limit):
        """Test user journey with error recovery"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True
        mock_validate.return_value = True
        mock_extract.return_value = "Valid PDF content for testing"

        # First, simulate enhancement failure
        mock_agent = MagicMock()

        mock_sanitize_tool = MagicMock()
        mock_sanitize_tool.name = "sanitize_content"
        mock_sanitize_tool.function = AsyncMock(return_value={
            "success": True,
            "sanitized_content": "Sanitized content",
            "processing_time": "0.1s"
        })

        mock_enhance_tool = MagicMock()
        mock_enhance_tool.name = "ai_pdf_enhancement"
        mock_enhance_tool.function = AsyncMock(return_value={
            "success": False,
            "error": "AI service temporarily unavailable"
        })

        mock_agent.tools = [mock_sanitize_tool, mock_enhance_tool]
        mock_get_agent.return_value = mock_agent

        headers = {"Authorization": "Bearer test_key"}

        # Upload PDF - should partially succeed
        pdf_content = b'%PDF-1.4\n%test'
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}

        response = self.client.post("/api/process-pdf", files=files, headers=headers)
        assert response.status_code == 200

        data = response.json()
        assert data["success"] == False
        assert data["sanitized_content"] == "Sanitized content"
        assert "AI service temporarily unavailable" in data["error"]

        # User should still be able to chat with partial data
        with patch('backend.api.LLMChain') as mock_chain_class:
            mock_chain = MagicMock()
            mock_chain.run.return_value = "I can see you have processed some content, though the AI enhancement failed. The sanitized content is available for basic analysis."
            mock_chain_class.return_value = mock_chain

            chat_data = {
                "message": "What happened with my document processing?",
                "context": {
                    "processed_data": {
                        "sanitized_content": data["sanitized_content"],
                        "error": data["error"]
                    }
                }
            }

            chat_response = self.client.post("/api/chat", json=chat_data, headers=headers)
            assert chat_response.status_code == 200

            chat_result = chat_response.json()
            assert chat_result["success"] == True

    @patch.dict(os.environ, {
        "API_KEY": "test_key"
    })
    @patch('backend.api.check_rate_limit')
    @patch('backend.api.authenticate_request')
    def test_security_boundary_testing(self, mock_auth, mock_rate_limit):
        """Test security boundaries and error handling"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True

        headers = {"Authorization": "Bearer test_key"}

        # Test various attack vectors
        attack_payloads = [
            # SQL injection attempt
            {"content": "'; DROP TABLE users; --", "classification": "general"},
            # XSS attempt
            {"content": "<script>alert('xss')</script>", "classification": "general"},
            # Path traversal
            {"content": "../../../etc/passwd", "classification": "general"},
            # Very long input
            {"content": "A" * 2000000, "classification": "general"},  # Over 1M limit
        ]

        for payload in attack_payloads:
            if len(payload["content"]) > 1000000:  # Over limit
                response = self.client.post("/api/sanitize/json", json=payload, headers=headers)
                assert response.status_code == 413
            else:
                response = self.client.post("/api/sanitize/json", json=payload, headers=headers)
                assert response.status_code in [200, 422]  # Should handle gracefully

                if response.status_code == 200:
                    data = response.json()
                    # Content should be sanitized
                    assert "<" not in data.get("sanitized_content", "")
                    assert ";" not in data.get("sanitized_content", "")

    @patch.dict(os.environ, {
        "API_KEY": "test_key",
        "AGENT_LLM_MODEL": "gemini-2.0-flash",
        "GEMINI_API_KEY": "test_gemini_key",
        "ENV": "development"
    })
    @patch('backend.api.check_rate_limit')
    @patch('backend.api.authenticate_request')
    @patch('backend.api.get_agent')
    def test_concurrent_processing_simulation(self, mock_get_agent, mock_auth, mock_rate_limit):
        """Test handling multiple concurrent requests"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True

        # Mock async processing with delays
        async def delayed_sanitize(*args, **kwargs):
            await asyncio.sleep(0.1)  # Simulate processing time
            return {
                "success": True,
                "sanitized_content": f"Sanitized: {kwargs.get('content', '')[:50]}...",
                "processing_time": "0.15s"
            }

        mock_agent = MagicMock()
        mock_sanitize_tool = MagicMock()
        mock_sanitize_tool.name = "sanitize_content"
        mock_sanitize_tool.function = AsyncMock(side_effect=delayed_sanitize)
        mock_agent.tools = [mock_sanitize_tool]
        mock_get_agent.return_value = mock_agent

        headers = {"Authorization": "Bearer test_key"}

        # Simulate concurrent requests
        payloads = [
            {"content": f"Content batch {i}", "classification": "general"}
            for i in range(5)
        ]

        responses = []
        for payload in payloads:
            response = self.client.post("/api/sanitize/json", json=payload, headers=headers)
            responses.append(response)

        # All should succeed
        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert "Sanitized:" in data["sanitized_content"]

    def test_health_and_monitoring_journey(self):
        """Test health checks and monitoring endpoints"""
        # Health check should always work
        response = self.client.get("/health")
        assert response.status_code == 200

        health_data = response.json()
        assert health_data["status"] == "healthy"
        assert "timestamp" in health_data
        assert "version" in health_data

        # Test multiple health checks (should not be rate limited)
        for _ in range(10):
            response = self.client.get("/health")
            assert response.status_code == 200


class TestWebSocketE2E:
    """E2E tests for WebSocket functionality"""

    @patch.dict(os.environ, {
        "API_KEY": "",  # No auth for WebSocket in test
        "AGENT_LLM_MODEL": "gemini-2.0-flash",
        "GEMINI_API_KEY": "test_gemini_key"
    })
    @patch('backend.api.get_agent')
    def test_websocket_chat_journey(self, mock_get_agent):
        """Test complete WebSocket chat journey"""
        from fastapi.testclient import TestClient

        # Mock agent for WebSocket
        mock_agent = MagicMock()
        mock_get_agent.return_value = mock_agent

        client = TestClient(app)

        # Mock the LLM chain for streaming
        with patch('backend.api.LLMChain') as mock_chain_class:
            mock_chain = MagicMock()
            mock_chain.run.return_value = "This is a streaming response about your processed document."
            mock_chain_class.return_value = mock_chain

            # Note: WebSocket testing with TestClient is limited
            # In a real E2E test, you'd use a WebSocket client library
            # This test verifies the endpoint exists and basic setup
            with client.websocket_connect("/ws/chat") as websocket:
                # Send a message
                message = {
                    "message": "Tell me about my document",
                    "context": {
                        "processed_data": {"document_type": "test"}
                    }
                }

                websocket.send_json(message)

                # Receive responses (should get typing indicator, chunks, and complete)
                responses = []
                try:
                    while True:
                        data = websocket.receive_json()
                        responses.append(data)
                        if data.get("type") == "complete":
                            break
                except:
                    pass  # WebSocket closed

                # Should have received some responses
                assert len(responses) > 0

                # Check for expected message types
                message_types = {r.get("type") for r in responses}
                assert "typing" in message_types
                assert "complete" in message_types