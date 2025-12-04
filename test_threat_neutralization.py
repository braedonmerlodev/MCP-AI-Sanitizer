#!/usr/bin/env python3
"""
Threat neutralization verification for bleach sanitization
Tests various XSS attack vectors to verify ≥90% neutralization rate (NFR1)
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'agent', 'agent-development-env'))

from backend.api import sanitize_input

# Original implementation for comparison
import re
import unicodedata

def old_sanitize_input(text):
    """Original sanitization logic for comparison"""
    # Ensure it's a string
    if not isinstance(text, str):
        text = str(text or '')

    # 1. Unicode normalization
    text = unicodedata.normalize('NFC', text)

    # 2. Symbol stripping - remove zero-width and control characters
    zero_width_chars = '\u200B\u200C\u200D\u200E\u200F\u2028\u2029\uFEFF'
    control_chars = ''.join(chr(i) for i in range(0, 32)) + ''.join(chr(i) for i in range(127, 160))
    text = re.sub(f'[{re.escape(zero_width_chars + control_chars)}]', '', text)

    # 3. Escape neutralization - remove ANSI escape sequences
    text = re.sub(r'\x1B\[[0-9;]*[A-Za-z]', '', text)

    # 4. Pattern redaction
    # Remove script tags and content
    text = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', text, flags=re.IGNORECASE)
    # Remove HTML tags
    text = re.sub(r'<[^>]*>', '', text)
    # Remove javascript:
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    # Remove event handlers
    text = re.sub(r'on\w+\s*=', '', text, flags=re.IGNORECASE)
    # Remove data URLs
    text = re.sub(r'data:\s*text\/html[^,]+,', '', text, flags=re.IGNORECASE)

    # Remove specific bad characters and symbols
    text = re.sub(r'[`©®™€£¥§¶†‡‹›Øß²³´]', '', text)

    # Remove potential XSS keywords
    text = re.sub(r'\b(alert|img|src|javascript|script|onerror|onload)\b', '', text, flags=re.IGNORECASE)

    # Limit length
    return text[:1000000]

def is_threat_neutralized(original, sanitized):
    """
    Check if a threat has been properly neutralized
    A threat is neutralized if dangerous content is removed or made safe
    """
    # Check for common XSS indicators that should be neutralized
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',  # Script tags with content
        r'javascript:',  # JavaScript URLs
        r'on\w+\s*=',  # Event handlers
        r'<iframe[^>]*src\s*=',  # Iframes with src
        r'<object[^>]*>',  # Object tags
        r'<embed[^>]*>',  # Embed tags
        r'data:\s*text/html',  # Data URLs with HTML
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, sanitized, re.IGNORECASE | re.DOTALL):
            return False

    # Check for dangerous keywords that should be removed
    dangerous_keywords = ['alert', 'eval', 'document.cookie', 'window.location']
    sanitized_lower = sanitized.lower()
    for keyword in dangerous_keywords:
        if keyword in sanitized_lower and keyword in original.lower():
            return False

    return True

def test_threat_neutralization():
    """Test threat neutralization rate for various XSS vectors"""

    # Comprehensive XSS test vectors
    xss_test_cases = [
        # Basic script injection
        ("<script>alert('xss')</script>", "Basic script tag"),
        ("<script src='evil.js'></script>", "Script with src"),
        ("<script>var x=1; alert(x);</script>", "Script with code"),

        # Event handler attacks
        ("<img src=x onerror=alert(1)>", "Image onerror"),
        ("<div onclick='alert(1)'>Click me</div>", "Div onclick"),
        ("<a href='#' onmouseover=alert(1)>Hover</a>", "Link onmouseover"),

        # JavaScript URL attacks
        ("<a href='javascript:alert(1)'>Click</a>", "JavaScript URL"),
        ("<iframe src='javascript:alert(1)'></iframe>", "Iframe JavaScript"),

        # Data URL attacks
        ("<iframe src='data:text/html,<script>alert(1)</script>'></iframe>", "Data URL script"),
        ("<object data='data:text/html,<script>alert(1)</script>'></object>", "Object data URL"),

        # Complex attacks
        ("<svg onload=alert(1)>", "SVG onload"),
        ("<math><mtext><script>alert(1)</script></mtext></math>", "MathML script"),
        ("<!--<img src=x onerror=alert(1)>-->", "Comment evasion"),

        # Encoded attacks
        ("<script>alert(String.fromCharCode(88,83,83))</script>", "Encoded alert"),
        ("<img src=x onerror=alert&#40;1&#41;>", "HTML entity encoding"),

        # Case variations
        ("<SCRIPT>alert(1)</SCRIPT>", "Uppercase script"),
        ("<Script>Alert(1)</Script>", "Mixed case"),

        # Nested attacks
        ("<scr<script>ipt>alert(1)</script>", "Mangled script tags"),
        ("<img src='x' onerror='alert(1)' onload='evil()'>", "Multiple handlers"),

        # CSS-based attacks (limited scope)
        ("<div style='background-image: url(javascript:alert(1))'>", "CSS JavaScript"),

        # Form-based attacks
        ("<form action='javascript:alert(1)'><input type=submit></form>", "Form action JavaScript"),
    ]

    print("Testing XSS threat neutralization...")
    print(f"Testing {len(xss_test_cases)} XSS attack vectors")
    print()

    old_neutralized = 0
    new_neutralized = 0
    total_tests = len(xss_test_cases)

    for i, (attack_vector, description) in enumerate(xss_test_cases):
        # Test old implementation
        old_result = old_sanitize_input(attack_vector)
        old_safe = is_threat_neutralized(attack_vector, old_result)
        if old_safe:
            old_neutralized += 1

        # Test new implementation
        new_result = sanitize_input(attack_vector)
        new_safe = is_threat_neutralized(attack_vector, new_result)
        if new_safe:
            new_neutralized += 1

        # Report failures
        if not new_safe:
            print(f"❌ FAILED: {description}")
            print(f"   Input: {repr(attack_vector)}")
            print(f"   Output: {repr(new_result)}")
        elif not old_safe and new_safe:
            print(f"✅ IMPROVED: {description} (old failed, new passed)")
        elif old_safe and new_safe:
            print(f"✓ MAINTAINED: {description}")

    # Calculate neutralization rates
    old_rate = (old_neutralized / total_tests) * 100
    new_rate = (new_neutralized / total_tests) * 100
    improvement = new_rate - old_rate

    print()
    print("Neutralization Results:")
    print(f"Old implementation: {old_neutralized}/{total_tests} ({old_rate:.1f}%)")
    print(f"New implementation: {new_neutralized}/{total_tests} ({new_rate:.1f}%)")
    print(f"Improvement: {improvement:.1f}%")

    # Check NFR1 compliance (≥90% neutralization)
    if new_rate >= 90.0:
        print("✅ NFR1 COMPLIANT: ≥90% threat neutralization achieved")
        return True
    else:
        print("❌ NFR1 VIOLATION: <90% threat neutralization")
        return False

if __name__ == "__main__":
    success = test_threat_neutralization()
    sys.exit(0 if success else 1)