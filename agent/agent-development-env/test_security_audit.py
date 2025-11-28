#!/usr/bin/env python3
"""
Security audit test script for the PDF processing backend API.
Tests the security improvements implemented.
"""

import requests
import json
import os
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:3000"  # Adjust if different
API_KEY = os.getenv("API_KEY", "test-key")


def test_file_size_limit():
    """Test file size limit enforcement"""
    print("Testing file size limit...")

    # Create a large file (>10MB)
    large_content = b"A" * (11 * 1024 * 1024)  # 11MB

    files = {"file": ("large.pdf", large_content, "application/pdf")}
    headers = {"Authorization": f"Bearer {API_KEY}"}

    try:
        response = requests.post(
            f"{BASE_URL}/api/process-pdf", files=files, headers=headers
        )
        if response.status_code == 413:
            print("✓ File size limit enforced correctly")
        else:
            print(f"✗ Expected 413, got {response.status_code}")
    except Exception as e:
        print(f"✗ Error testing file size: {e}")


def test_invalid_file_type():
    """Test invalid file type rejection"""
    print("Testing invalid file type...")

    # Create a fake PDF (doesn't start with %PDF-)
    fake_pdf = b"This is not a PDF file"

    files = {"file": ("fake.pdf", fake_pdf, "application/pdf")}
    headers = {"Authorization": f"Bearer {API_KEY}"}

    try:
        response = requests.post(
            f"{BASE_URL}/api/process-pdf", files=files, headers=headers
        )
        if response.status_code == 400:
            print("✓ Invalid file type rejected")
        else:
            print(f"✗ Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"✗ Error testing file type: {e}")


def test_rate_limiting():
    """Test rate limiting"""
    print("Testing rate limiting...")

    headers = {"Authorization": f"Bearer {API_KEY}"}

    # Make many requests quickly
    for i in range(110):  # More than the 100 limit
        try:
            response = requests.post(
                f"{BASE_URL}/api/sanitize/json",
                json={"content": f"test {i}", "classification": "general"},
                headers=headers,
            )
            if response.status_code == 429:
                print("✓ Rate limiting working")
                break
        except Exception as e:
            print(f"✗ Error testing rate limit: {e}")
            break
    else:
        print("✗ Rate limiting not triggered")


def test_authentication():
    """Test authentication requirement"""
    print("Testing authentication...")

    # Test without API key
    try:
        response = requests.post(
            f"{BASE_URL}/api/sanitize/json",
            json={"content": "test", "classification": "general"},
        )
        if response.status_code == 401:
            print("✓ Authentication required")
        else:
            print(f"✗ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"✗ Error testing auth: {e}")


def test_input_validation():
    """Test input validation and sanitization"""
    print("Testing input validation...")

    headers = {"Authorization": f"Bearer {API_KEY}"}

    # Test oversized input
    large_input = "A" * (1000001)  # MAX_TEXT_LENGTH + 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/sanitize/json",
            json={"content": large_input, "classification": "general"},
            headers=headers,
        )
        if response.status_code == 413:
            print("✓ Input size validation working")
        else:
            print(f"✗ Expected 413, got {response.status_code}")
    except Exception as e:
        print(f"✗ Error testing input validation: {e}")


def test_security_headers():
    """Test security headers"""
    print("Testing security headers...")

    try:
        response = requests.get(f"{BASE_URL}/health")
        headers = response.headers

        security_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection",
            "Strict-Transport-Security",
            "Content-Security-Policy",
        ]

        missing = []
        for header in security_headers:
            if header not in headers:
                missing.append(header)

        if not missing:
            print("✓ Security headers present")
        else:
            print(f"✗ Missing security headers: {missing}")

    except Exception as e:
        print(f"✗ Error testing security headers: {e}")


if __name__ == "__main__":
    print("Running security audit tests...\n")

    # Note: These tests assume the server is running
    # In a real scenario, you'd start the server first

    test_file_size_limit()
    test_invalid_file_type()
    test_rate_limiting()
    test_authentication()
    test_input_validation()
    test_security_headers()

    print("\nSecurity audit complete.")
