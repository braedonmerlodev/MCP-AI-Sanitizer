#!/usr/bin/env python3
"""
Compare old vs new sanitization behavior
"""
import re
import unicodedata
import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'agent', 'agent-development-env'))

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

from backend.api import sanitize_input

# Test cases
test_cases = [
    'javascript:alert(1)',
    '<script>alert(1)</script>Hello',
    '<b>Bold</b> text',
    'Hello\u200Bworld',
]

print("Comparing old vs new sanitization:")
for test_input in test_cases:
    old_result = old_sanitize_input(test_input)
    new_result = sanitize_input(test_input)
    match = "✓" if old_result == new_result else "✗"
    print(f"{match} Input: {repr(test_input)}")
    print(f"  Old: {repr(old_result)}")
    print(f"  New: {repr(new_result)}")
    print()