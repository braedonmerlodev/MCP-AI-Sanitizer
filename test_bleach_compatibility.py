#!/usr/bin/env python3
"""
Test script to verify bleach sanitization backward compatibility
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'agent', 'agent-development-env'))

from backend.api import sanitize_input

def test_bleach_sanitization():
    """Test that bleach sanitization maintains expected behavior"""

    test_cases = [
        # Basic text should remain unchanged
        ("Hello world", "Hello world"),

        # HTML tags should be removed
        ("<script>alert('xss')</script>Hello", "Hello"),
        ("<b>Bold</b> text", "Bold text"),

        # JavaScript URLs should be removed
        ("javascript:alert('xss')", ""),

        # Event handlers should be removed
        ("<img src='x' onerror='alert(1)'>", ""),

        # Zero-width characters should be removed
        ("Hello\u200Bworld", "Helloworld"),

        # Control characters should be removed
        ("Hello\x00world", "Helloworld"),

        # Complex XSS attempts
        ("<script>alert('xss')</script><img src=x onerror=alert('xss')>", ""),
        ("<iframe src='javascript:alert(1)'></iframe>", ""),

        # Unicode normalization should work
        ("café", "café"),  # NFC normalized

        # Length limiting should work
        ("x" * 1000000 + "y", "x" * 1000000),  # Should be truncated
    ]

    print("Testing bleach sanitization backward compatibility...")
    passed = 0
    failed = 0

    for i, (input_text, expected) in enumerate(test_cases):
        result = sanitize_input(input_text)
        if result == expected:
            print(f"✓ Test {i+1}: PASSED")
            passed += 1
        else:
            print(f"✗ Test {i+1}: FAILED")
            print(f"  Input: {repr(input_text)}")
            print(f"  Expected: {repr(expected)}")
            print(f"  Got: {repr(result)}")
            failed += 1

    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0

if __name__ == "__main__":
    success = test_bleach_sanitization()
    sys.exit(0 if success else 1)