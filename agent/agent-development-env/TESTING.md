# Testing Documentation

This document describes the comprehensive test suite for the MCP Security PDF processing pipeline.

## Test Structure

### Unit Tests (`tests/test_api.py`)

- **Utility Functions**: Tests for `validate_file_type`, `sanitize_input`, `check_rate_limit`, `extract_pdf_text`
- **API Endpoints**: Tests for all FastAPI endpoints including error handling and validation
- **Coverage**: 80%+ coverage of backend API functionality

### Integration Tests (`tests/test_integration.py`)

- **PDF Processing Flow**: End-to-end testing of PDF upload, extraction, sanitization, and enhancement
- **Security Features**: Rate limiting, CORS, authentication across multiple requests
- **Error Recovery**: Testing resilience when individual components fail
- **Concurrent Processing**: Testing multiple simultaneous requests

### End-to-End Tests (`tests/test_e2e.py`)

- **User Journeys**: Complete user workflows from PDF upload through chat interaction
- **WebSocket Testing**: Real-time chat functionality testing
- **Security Boundary Testing**: Input validation and attack vector testing
- **Monitoring**: Health checks and system monitoring

### Security Agent Tests (`tests/test_security_agent.py`)

- **Agent Initialization**: Tool loading and configuration
- **AI Enhancement**: LLM integration and prompt processing
- **Content Sanitization**: Security filtering functionality
- **Error Handling**: Fallback mechanisms and validation

## Test Coverage Goals

- **Backend API**: 80%+ line coverage
- **Security Agent**: 80%+ functionality coverage
- **Error Scenarios**: Comprehensive error handling coverage
- **Security Features**: All security mechanisms tested

## Running Tests

### Prerequisites

```bash
pip install -r requirements.txt
```

### Run All Tests

```bash
python run_tests.py
```

### Run Specific Test Suites

```bash
# Unit tests only
pytest tests/test_api.py -v

# Integration tests only
pytest tests/test_integration.py -v

# E2E tests only
pytest tests/test_e2e.py -v

# Security agent tests
pytest tests/test_security_agent.py -v
```

### Run with Coverage

```bash
# Full coverage report
pytest --cov=backend --cov=agent --cov-report=html --cov-report=term-missing

# View HTML coverage report
open htmlcov/index.html
```

## Test Configuration

### pytest.ini

- Coverage requirements: 80% minimum
- Async test support enabled
- HTML and XML coverage reports
- Verbose output with failure details

### Environment Variables for Testing

```bash
# API Configuration
API_KEY=test_key
GEMINI_API_KEY=test_gemini_key
AGENT_LLM_MODEL=gemini-2.0-flash

# Development mode
ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Mock Strategy

### External Dependencies

- **DeepAgent**: Mocked to avoid complex setup in CI/CD
- **Google Gemini API**: Mocked LLM responses for consistent testing
- **File I/O**: Mocked PDF reading for performance
- **WebSocket**: Simulated for E2E testing

### Test Data

- **PDF Content**: Minimal valid PDF structures for testing
- **Security Payloads**: XSS, SQL injection, and other attack vectors
- **AI Responses**: Structured JSON responses for enhancement testing

## CI/CD Integration

Tests are designed to run in automated environments:

- No external API calls (all mocked)
- Fast execution (< 30 seconds for full suite)
- Deterministic results
- Comprehensive error reporting

## Test Categories

### Smoke Tests

- Basic import and initialization
- Health check endpoints
- Minimal functionality verification

### Regression Tests

- Previously fixed bugs
- API contract compliance
- Security vulnerability patches

### Performance Tests

- Rate limiting effectiveness
- Concurrent request handling
- Memory usage monitoring

### Security Tests

- Input sanitization
- Authentication/authorization
- File upload validation
- CORS and CSP headers
