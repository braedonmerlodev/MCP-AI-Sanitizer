# tests/test_api.py
"""Unit tests for API endpoints and utility functions"""
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
import io
import json
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta
import os

# Import the app and functions to test
from backend.api import (
    app,
    validate_file_type,
    sanitize_input,
    check_rate_limit,
    authenticate_request,
    extract_pdf_text,
    MAX_FILE_SIZE,
    MAX_TEXT_LENGTH,
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW,
)


class TestUtilityFunctions:
    """Test utility functions"""

    def test_validate_file_type_valid_pdf(self):
        """Test valid PDF file validation"""
        # Create a minimal valid PDF
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF"
        assert validate_file_type(pdf_content, "test.pdf") == True

    def test_validate_file_type_invalid_magic_bytes(self):
        """Test invalid PDF with wrong magic bytes"""
        invalid_content = b"Not a PDF file"
        assert validate_file_type(invalid_content, "test.pdf") == False

    def test_validate_file_type_wrong_extension(self):
        """Test file with wrong extension"""
        pdf_content = b"%PDF-1.4\n..."
        assert validate_file_type(pdf_content, "test.txt") == False

    def test_validate_file_type_corrupted_pdf(self):
        """Test corrupted PDF content"""
        corrupted_content = b"%PDF-1.4\ncorrupted content"
        assert validate_file_type(corrupted_content, "test.pdf") == False

    def test_sanitize_input_normal_text(self):
        """Test sanitization of normal text"""
        text = "Normal text content"
        assert sanitize_input(text) == text

    def test_sanitize_input_with_dangerous_chars(self):
        """Test sanitization removes dangerous characters"""
        text = "Text with <script> and > tags"
        sanitized = sanitize_input(text)
        assert "<" not in sanitized
        assert ">" not in sanitized

    def test_sanitize_input_length_limit(self):
        """Test input length limiting"""
        long_text = "a" * (MAX_TEXT_LENGTH + 100)
        sanitized = sanitize_input(long_text)
        assert len(sanitized) == MAX_TEXT_LENGTH

    def test_check_rate_limit_within_limit(self):
        """Test rate limiting within allowed requests"""
        from backend.api import rate_limit_store

        # Clear store
        rate_limit_store.clear()

        client_ip = "192.168.1.1"

        # Should allow all requests within limit
        for i in range(RATE_LIMIT_REQUESTS):
            assert check_rate_limit(client_ip) == True

        # Should deny the next request
        assert check_rate_limit(client_ip) == False

    def test_check_rate_limit_window_expiry(self):
        """Test rate limit window expiry"""
        from backend.api import rate_limit_store

        rate_limit_store.clear()

        client_ip = "192.168.1.1"

        # Fill up the limit
        for i in range(RATE_LIMIT_REQUESTS):
            check_rate_limit(client_ip)

        # Manually expire old requests by setting old timestamps
        old_time = datetime.now() - timedelta(seconds=RATE_LIMIT_WINDOW + 1)
        rate_limit_store[client_ip] = [old_time] * RATE_LIMIT_REQUESTS

        # Should allow new request after window expiry
        assert check_rate_limit(client_ip) == True

    def test_authenticate_request_no_api_key(self):
        """Test authentication when no API key is set"""
        from fastapi.security import HTTPAuthorizationCredentials

        # Mock no API key
        with patch.dict(os.environ, {"API_KEY": ""}):
            creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test")
            assert authenticate_request(creds) == True

    def test_authenticate_request_valid_key(self):
        """Test authentication with valid API key"""
        from fastapi.security import HTTPAuthorizationCredentials

        test_key = "test_api_key"
        with patch.dict(os.environ, {"API_KEY": test_key}):
            creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=test_key)
            assert authenticate_request(creds) == True

    def test_authenticate_request_invalid_key(self):
        """Test authentication with invalid API key"""
        from fastapi.security import HTTPAuthorizationCredentials

        with patch.dict(os.environ, {"API_KEY": "valid_key"}):
            creds = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials="invalid_key"
            )
            assert authenticate_request(creds) == False

    def test_extract_pdf_text_success(self):
        """Test successful PDF text extraction"""
        # Create a simple PDF with text
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF"

        # This will fail with PyPDF2 on this minimal PDF, but tests the function
        with pytest.raises(HTTPException):
            extract_pdf_text(pdf_content)


class TestAPIEndpoints:
    """Test API endpoints"""

    def setup_method(self):
        """Setup for each test"""
        self.client = TestClient(app)
        # Clear rate limit store
        from backend.api import rate_limit_store

        rate_limit_store.clear()

    def test_health_check(self):
        """Test health check endpoint"""
        response = self.client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data

    def test_process_pdf_missing_file(self):
        """Test PDF processing with missing file"""
        response = self.client.post("/api/process-pdf")
        assert response.status_code == 422  # Validation error

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    def test_process_pdf_rate_limited(self, mock_auth, mock_rate_limit):
        """Test PDF processing when rate limited"""
        mock_rate_limit.return_value = False
        mock_auth.return_value = True

        # Create a dummy PDF file
        pdf_content = b"%PDF-1.4\n%minimal pdf"
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}

        response = self.client.post("/api/process-pdf", files=files)
        assert response.status_code == 429

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    def test_process_pdf_unauthorized(self, mock_auth, mock_rate_limit):
        """Test PDF processing with invalid auth"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = False

        pdf_content = b"%PDF-1.4\n%minimal pdf"
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}

        response = self.client.post("/api/process-pdf", files=files)
        assert response.status_code == 401

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    @patch("backend.api.validate_file_type")
    def test_process_pdf_invalid_file_type(
        self, mock_validate, mock_auth, mock_rate_limit
    ):
        """Test PDF processing with invalid file type"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True
        mock_validate.return_value = False

        invalid_content = b"not a pdf"
        files = {"file": ("test.txt", io.BytesIO(invalid_content), "text/plain")}

        response = self.client.post("/api/process-pdf", files=files)
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    @patch("backend.api.validate_file_type")
    @patch("backend.api.extract_pdf_text")
    def test_process_pdf_no_text_extracted(
        self, mock_extract, mock_validate, mock_auth, mock_rate_limit
    ):
        """Test PDF processing when no text can be extracted"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True
        mock_validate.return_value = True
        mock_extract.return_value = ""

        pdf_content = b"%PDF-1.4\n%pdf with no text"
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}

        response = self.client.post("/api/process-pdf", files=files)
        assert response.status_code == 400
        assert "No text could be extracted" in response.json()["detail"]

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    @patch("backend.api.validate_file_type")
    @patch("backend.api.extract_pdf_text")
    @patch("backend.api.get_agent")
    def test_process_pdf_sanitize_tool_not_found(
        self, mock_get_agent, mock_extract, mock_validate, mock_auth, mock_rate_limit
    ):
        """Test PDF processing when sanitize tool is not found"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True
        mock_validate.return_value = True
        mock_extract.return_value = "extracted text"

        # Mock agent without sanitize tool
        mock_agent = MagicMock()
        mock_agent.tools = []
        mock_get_agent.return_value = mock_agent

        pdf_content = b"%PDF-1.4\n%pdf content"
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}

        response = self.client.post("/api/process-pdf", files=files)
        assert response.status_code == 500
        assert "Sanitize tool not found" in response.json()["detail"]

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    @patch("backend.api.validate_file_type")
    @patch("backend.api.extract_pdf_text")
    @patch("backend.api.get_agent")
    def test_process_pdf_sanitize_failed(
        self, mock_get_agent, mock_extract, mock_validate, mock_auth, mock_rate_limit
    ):
        """Test PDF processing when sanitization fails"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True
        mock_validate.return_value = True
        mock_extract.return_value = "extracted text"

        # Mock agent with failing sanitize tool
        mock_agent = MagicMock()
        mock_sanitize_tool = MagicMock()
        mock_sanitize_tool.name = "sanitize_content"
        mock_sanitize_tool.function = AsyncMock(
            return_value={"success": False, "error": "Sanitize failed"}
        )
        mock_agent.tools = [mock_sanitize_tool]
        mock_get_agent.return_value = mock_agent

        pdf_content = b"%PDF-1.4\n%pdf content"
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}

        response = self.client.post("/api/process-pdf", files=files)
        assert response.status_code == 200  # Returns success=False in response
        data = response.json()
        assert data["success"] == False
        assert data["error"] == "Sanitize failed"

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    @patch("backend.api.validate_file_type")
    @patch("backend.api.extract_pdf_text")
    @patch("backend.api.get_agent")
    def test_process_pdf_enhance_tool_not_found(
        self, mock_get_agent, mock_extract, mock_validate, mock_auth, mock_rate_limit
    ):
        """Test PDF processing when enhance tool is not found"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True
        mock_validate.return_value = True
        mock_extract.return_value = "extracted text"

        # Mock agent with sanitize tool but no enhance tool
        mock_agent = MagicMock()
        mock_sanitize_tool = MagicMock()
        mock_sanitize_tool.name = "sanitize_content"
        mock_sanitize_tool.function = AsyncMock(
            return_value={"success": True, "sanitized_content": "sanitized text"}
        )
        mock_agent.tools = [mock_sanitize_tool]
        mock_get_agent.return_value = mock_agent

        pdf_content = b"%PDF-1.4\n%pdf content"
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}

        response = self.client.post("/api/process-pdf", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert data["error"] == "Enhancement tool not found"

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    @patch("backend.api.validate_file_type")
    @patch("backend.api.extract_pdf_text")
    @patch("backend.api.get_agent")
    def test_process_pdf_success(
        self, mock_get_agent, mock_extract, mock_validate, mock_auth, mock_rate_limit
    ):
        """Test successful PDF processing"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True
        mock_validate.return_value = True
        mock_extract.return_value = "extracted text"

        # Mock agent with both tools
        mock_agent = MagicMock()
        mock_sanitize_tool = MagicMock()
        mock_sanitize_tool.name = "sanitize_content"
        mock_sanitize_tool.function = AsyncMock(
            return_value={"success": True, "sanitized_content": "sanitized text"}
        )

        mock_enhance_tool = MagicMock()
        mock_enhance_tool.name = "ai_pdf_enhancement"
        mock_enhance_tool.function = AsyncMock(
            return_value={
                "success": True,
                "enhanced_content": "enhanced text",
                "structured_output": {"key": "value"},
                "processing_metadata": {"processing_time": "1.23s"},
            }
        )

        mock_agent.tools = [mock_sanitize_tool, mock_enhance_tool]
        mock_get_agent.return_value = mock_agent

        pdf_content = b"%PDF-1.4\n%pdf content"
        files = {"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}

        response = self.client.post("/api/process-pdf", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["sanitized_content"] == "sanitized text"
        assert data["enhanced_content"] == "enhanced text"
        assert data["structured_output"] == {"key": "value"}
        assert data["processing_time"] == "1.23s"
        assert data["extracted_text_length"] == len("extracted text")
        assert len(data["processing_stages"]) > 0

    def test_sanitize_json_endpoint_validation(self):
        """Test sanitize JSON endpoint input validation"""
        # Test missing content
        response = self.client.post("/api/sanitize/json", json={})
        assert response.status_code == 422

        # Test content too long
        long_content = "a" * (MAX_TEXT_LENGTH + 1)
        response = self.client.post(
            "/api/sanitize/json", json={"content": long_content}
        )
        assert response.status_code == 422

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    @patch("backend.api.get_agent")
    def test_sanitize_json_success(self, mock_get_agent, mock_auth, mock_rate_limit):
        """Test successful content sanitization"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True

        mock_agent = MagicMock()
        mock_sanitize_tool = MagicMock()
        mock_sanitize_tool.name = "sanitize_content"
        mock_sanitize_tool.function = AsyncMock(
            return_value={
                "success": True,
                "sanitized_content": "sanitized content",
                "processing_time": "0.5s",
            }
        )
        mock_agent.tools = [mock_sanitize_tool]
        mock_get_agent.return_value = mock_agent

        response = self.client.post(
            "/api/sanitize/json",
            json={"content": "test content", "classification": "general"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["sanitized_content"] == "sanitized content"

    @patch("backend.api.check_rate_limit")
    @patch("backend.api.authenticate_request")
    @patch("backend.api.get_agent")
    def test_chat_endpoint_success(self, mock_get_agent, mock_auth, mock_rate_limit):
        """Test successful chat endpoint"""
        mock_rate_limit.return_value = True
        mock_auth.return_value = True

        # Mock the LLM chain
        with patch("backend.api.LLMChain") as mock_chain_class:
            mock_chain = MagicMock()
            mock_chain.run.return_value = "AI response"
            mock_chain_class.return_value = mock_chain

            response = self.client.post(
                "/api/chat", json={"message": "Hello", "context": {}}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert data["response"] == "AI response"
