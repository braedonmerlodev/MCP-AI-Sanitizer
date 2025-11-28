#!/usr/bin/env python3
"""
Test script to verify deepagent package installation and basic functionality
Run this in the agent-dev container to ensure everything is working
"""

import sys
import os
from pathlib import Path


def test_imports():
    """Test that all required packages can be imported"""
    try:
        from deepagent import Agent, Tool

        print("✓ deepagent package imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Failed to import deepagent: {e}")
        return False


def test_langsmith():
    """Test LangSmith configuration"""
    try:
        import langsmith

        print("✓ langsmith package imported successfully")

        # Check environment variables
        tracing = os.environ.get("LANGCHAIN_TRACING_V2")
        endpoint = os.environ.get("LANGCHAIN_ENDPOINT")
        api_key = os.environ.get("LANGCHAIN_API_KEY")

        if tracing and endpoint and api_key:
            print("✓ LangSmith environment variables configured")
            return True
        else:
            print("⚠ LangSmith environment variables not fully configured")
            return False
    except ImportError as e:
        print(f"✗ Failed to import langsmith: {e}")
        return False


def test_openai():
    """Test OpenAI configuration"""
    try:
        import openai

        print("✓ openai package imported successfully")

        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            print("✓ OpenAI API key configured")
            return True
        else:
            print("⚠ OpenAI API key not configured")
            return False
    except ImportError as e:
        print(f"✗ Failed to import openai: {e}")
        return False


def test_backend_config():
    """Test backend configuration"""
    try:
        # Try to import from the mounted project
        sys.path.append("/app")
        from config.backend_config import BACKEND_CONFIG

        print("✓ Backend configuration loaded successfully")

        backend_url = os.environ.get("BACKEND_URL")
        if backend_url:
            print("✓ Backend URL configured")
            return True
        else:
            print("⚠ Backend URL not configured")
            return False
    except ImportError as e:
        print(f"⚠ Backend config not found (expected if not mounted): {e}")
        return False


def main():
    """Run all tests"""
    print("Testing deepagent package setup...\n")

    tests = [
        ("Package Imports", test_imports),
        ("LangSmith Setup", test_langsmith),
        ("OpenAI Setup", test_openai),
        ("Backend Config", test_backend_config),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"Testing {test_name}:")
        if test_func():
            passed += 1
        print()

    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! deepagent package is ready to use.")
        return 0
    else:
        print("⚠️  Some tests failed. Check configuration and try again.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
