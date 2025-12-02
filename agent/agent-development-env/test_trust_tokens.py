#!/usr/bin/env python3
"""
Test script for trust token validation functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.trust_validator import TrustTokenValidator
import json


def test_trust_token_validation():
    """Test trust token validation with mock data"""

    print("🧪 Testing Trust Token Validation")
    print("=" * 50)

    # Initialize validator
    validator = TrustTokenValidator(secret_key="test_secret_key")

    # Test valid trust token
    valid_token = {
        "contentHash": "abc123",
        "originalHash": "def456",
        "sanitizationVersion": "1.0",
        "rulesApplied": ["UnicodeNormalization", "SymbolStripping"],
        "timestamp": "2025-12-02T04:00:00.000Z",
        "expiresAt": "2025-12-03T04:00:00.000Z",
        "signature": "placeholder_signature",  # Would be valid HMAC in real scenario
        "nonce": "test_nonce"
    }

    print("1. Testing valid trust token structure...")
    validation = validator.validate_token(valid_token)
    print(f"   Result: {validation}")
    print(f"   Display: {validator.format_trust_display(validation)}")

    # Test missing fields
    print("\n2. Testing invalid trust token (missing fields)...")
    invalid_token = {"contentHash": "abc123"}  # Missing required fields
    validation = validator.validate_token(invalid_token)
    print(f"   Result: {validation}")
    print(f"   Display: {validator.format_trust_display(validation)}")

    # Test response parsing
    print("\n3. Testing API response parsing...")
    mock_response = {
        "taskId": "test_job_123",
        "status": "completed",
        "result": {
            "sanitizedContent": {
                "sanitizedData": {"title": "Test Document", "content": "Test content"},
                "trustToken": valid_token
            },
            "metadata": {"processingTime": 100}
        }
    }

    parsed = validator.extract_content_and_trust(mock_response)
    print(f"   Parsed content: {parsed['content']}")
    print(f"   Has trust token: {parsed['trustToken'] is not None}")

    print("\n✅ Trust token validation tests completed!")


def test_job_tools_integration():
    """Test job tools integration with trust tokens"""

    print("\n🔧 Testing Job Tools Integration")
    print("=" * 50)

    # Mock agent for testing
    class MockAgent:
        def __init__(self):
            self.backend_config = {
                "base_url": "http://localhost:3001",
                "endpoints": {
                    "job_result": "/api/jobs/{taskId}/result"
                }
            }

    # Test the parsing function
    try:
        from agent.job_tools import JobTools

        agent = MockAgent()
        job_tools = JobTools(agent)

        # Test with mock data that includes trust tokens
        mock_api_response = {
            "taskId": "test_job_123",
            "result": {
                "sanitizedContent": {
                    "sanitizedData": {"title": "Test", "content": "Mock content"},
                    "trustToken": {
                        "contentHash": "test_hash",
                        "originalHash": "orig_hash",
                        "sanitizationVersion": "1.0",
                        "rulesApplied": ["TestRule"],
                        "timestamp": "2025-12-02T04:00:00.000Z",
                        "expiresAt": "2025-12-03T04:00:00.000Z",
                        "signature": "test_sig",
                        "nonce": "test_nonce"
                    }
                }
            }
        }

        parsed_result = job_tools._parse_and_validate_result(mock_api_response)
        print("   Parsed result structure:")
        print(f"   - Has content: {'content' in parsed_result}")
        print(f"   - Has trust validation: {'trustValidation' in parsed_result}")
        print(f"   - Has trust display: {'trustDisplay' in parsed_result}")
        print(f"   - Trust display: {parsed_result.get('trustDisplay', 'N/A')}")

        print("\n✅ Job tools integration test completed!")

    except Exception as e:
        print(f"❌ Job tools test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_trust_token_validation()
    test_job_tools_integration()

    print("\n🎉 All trust token tests completed!")
    print("\nNext steps:")
    print("1. Set TRUST_TOKEN_SECRET environment variable for signature validation")
    print("2. Test with real API responses from the Node.js backend")
    print("3. Integrate trust token display into the main agent workflow")