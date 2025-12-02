#!/usr/bin/env python3
"""
Performance benchmark for bleach sanitization vs original implementation
"""
import time
import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'agent', 'agent-development-env'))

from backend.api import sanitize_input as new_sanitize_input

# Original implementation for comparison
import re
import unicodedata

def old_sanitize_input(text):
    """Original sanitization logic for performance comparison"""
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

def benchmark_sanitization():
    """Benchmark sanitization performance"""

    # Test data with various inputs
    test_cases = [
        "Hello world",  # Simple text
        "<script>alert('xss')</script>Hello world",  # Script injection
        "<b>Bold</b> and <i>italic</i> text",  # HTML tags
        "javascript:alert(1)",  # JavaScript URL
        "<img src=x onerror=alert(1)>",  # Event handler
        "Hello\u200Bworld\u200Ctest",  # Zero-width chars
        "Hello\x1B[31mred\x1B[0mworld",  # ANSI escapes
        "café résumé naïve",  # Unicode
        "<script>var x=1; alert(x);</script><p>Content</p>",  # Complex HTML
        "data:text/html,<script>alert(1)</script>",  # Data URL
    ]

    # Number of iterations for each test case
    iterations = 1000

    print("Benchmarking sanitization performance...")
    print(f"Running {iterations} iterations for each of {len(test_cases)} test cases")
    print()

    old_times = []
    new_times = []

    for i, test_input in enumerate(test_cases):
        # Benchmark old implementation
        start_time = time.time()
        for _ in range(iterations):
            old_result = old_sanitize_input(test_input)
        old_time = time.time() - start_time
        old_times.append(old_time)

        # Benchmark new implementation
        start_time = time.time()
        for _ in range(iterations):
            new_result = new_sanitize_input(test_input)
        new_time = time.time() - start_time
        new_times.append(new_time)

        # Only check result equivalence for first iteration to avoid spam
        if i == 0 and old_result != new_result:
            print(f"WARNING: Results differ for test case {i+1}")
            print(f"  Input: {repr(test_input)}")
            print(f"  Old: {repr(old_result)}")
            print(f"  New: {repr(new_result)}")

        print(f"Test case {i+1}: Old={old_time:.4f}s, New={new_time:.4f}s, Overhead={((new_time-old_time)/old_time*100 if old_time > 0 else 0):.1f}%")

        # Verify results are equivalent
        if old_result != new_result:
            print(f"WARNING: Results differ for test case {i+1}")
            print(f"  Input: {repr(test_input)}")
            print(f"  Old: {repr(old_result)}")
            print(f"  New: {repr(new_result)}")

        print(".1f")

    # Calculate totals and averages
    total_old = sum(old_times)
    total_new = sum(new_times)
    avg_old = total_old / len(test_cases)
    avg_new = total_new / len(test_cases)

    overhead_percent = ((total_new - total_old) / total_old) * 100

    print()
    print("Performance Results:")
    print(f"Total old time: {total_old:.4f}s")
    print(f"Total new time: {total_new:.4f}s")
    print(f"Average old time: {avg_old:.4f}s per test case")
    print(f"Average new time: {avg_new:.4f}s per test case")
    print(f"Performance overhead: {overhead_percent:.2f}%")

    # Check NFR3 compliance (<5% overhead)
    if overhead_percent <= 5.0:
        print("✅ NFR3 COMPLIANT: Overhead is within 5% limit")
        return True
    else:
        print("❌ NFR3 VIOLATION: Overhead exceeds 5% limit")
        return False

if __name__ == "__main__":
    success = benchmark_sanitization()
    sys.exit(0 if success else 1)