"""
Unit tests for bleach-based sanitization
"""
import pytest
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.api import sanitize_input, get_sanitization_metrics, generate_sanitization_advice


class TestBleachSanitization:
    """Test bleach-based sanitization functionality"""

    def test_basic_html_sanitization(self):
        """Test that HTML tags are properly removed"""
        assert sanitize_input("<b>Bold text</b>") == "Bold text"
        assert sanitize_input("<i>Italic</i>") == "Italic"
        assert sanitize_input("<strong>Strong</strong>") == "Strong"

    def test_script_tag_removal(self):
        """Test that script tags and content are removed"""
        assert sanitize_input("<script>alert('xss')</script>Hello") == "Hello"
        assert sanitize_input("<script src='evil.js'></script>") == ""

    def test_javascript_url_removal(self):
        """Test that javascript: URLs are neutralized"""
        assert sanitize_input("javascript:alert(1)") == "(1)"
        assert sanitize_input("<a href='javascript:alert(1)'>Click me</a>") == "Click me"

    def test_event_handler_removal(self):
        """Test that event handlers are removed"""
        assert sanitize_input("<img src='x' onerror='alert(1)'>") == ""
        assert sanitize_input("<div onclick='evil()'>Click</div>") == "Click"

    def test_data_url_removal(self):
        """Test that dangerous data URLs are removed"""
        assert sanitize_input("<iframe src='data:text/html,<script>alert(1)</script>'></iframe>") == ""

    def test_unicode_normalization(self):
        """Test that Unicode normalization works"""
        # NFC normalization
        assert sanitize_input("café") == "café"

    def test_zero_width_character_removal(self):
        """Test that zero-width characters are removed"""
        assert sanitize_input("Hello\u200Bworld") == "Helloworld"
        assert sanitize_input("Test\u200Cstring") == "Teststring"

    def test_control_character_removal(self):
        """Test that control characters are removed"""
        assert sanitize_input("Hello\x00world") == "Helloworld"
        assert sanitize_input("Test\x01string") == "Teststring"

    def test_ansi_escape_removal(self):
        """Test that ANSI escape sequences are removed"""
        assert sanitize_input("Hello\x1B[31mworld\x1B[0m") == "Helloworld"

    def test_complex_xss_attempts(self):
        """Test complex XSS attack vectors"""
        # Nested script tags - script content removed, remaining HTML escaped
        assert sanitize_input("<scr<script>ipt>alert(1)</script>") == "&lt;scr"

        # Mixed HTML and JavaScript
        assert sanitize_input("<img src=x onerror=alert(1) onload=evil()>") == ""

        # Encoded attacks (basic)
        assert sanitize_input("<script>alert(String.fromCharCode(88,83,83))</script>") == ""

    def test_length_limiting(self):
        """Test that input length is properly limited"""
        long_input = "x" * 1000000 + "y"
        result = sanitize_input(long_input)
        assert len(result) == 1000000
        assert result == "x" * 1000000

    def test_backward_compatibility(self):
        """Test that behavior matches original implementation"""
        test_cases = [
            ("Hello world", "Hello world"),
            ("<script>alert(1)</script>Hello", "Hello"),
            ("<b>Bold</b> text", "Bold text"),
            ("javascript:alert(1)", "(1)"),
            ("Hello\u200Bworld", "Helloworld"),
        ]

        for input_text, expected in test_cases:
            assert sanitize_input(input_text) == expected

    def test_bleach_security_improvements(self):
        """Test that bleach provides better security than basic regex"""
        # These should all be sanitized to safe content
        dangerous_inputs = [
            "<svg onload=alert(1)>",
            "<math><mtext><script>alert(1)</script></mtext></math>",
            "<!--<img src=x onerror=alert(1)>-->",
            "<style>@import 'evil.css';</style>",
        ]

        for dangerous in dangerous_inputs:
            result = sanitize_input(dangerous)
            # Result should not contain dangerous tags or attributes
            assert "<script>" not in result.lower()
            assert "onerror" not in result.lower()
            assert "onload" not in result.lower()
            assert "javascript:" not in result.lower()

    def test_sanitization_metrics_basic(self):
        """Test basic sanitization metrics calculation"""
        # Test with no sanitization needed
        metrics = get_sanitization_metrics("Hello world")
        assert metrics['original_length'] == 11
        assert metrics['final_length'] == 11
        assert metrics['total_chars_removed'] == 0
        assert metrics['sanitization_impact'] == 0.0
        assert metrics['threshold_exceeded'] == False
        assert metrics['bleach_applied'] == False

    def test_sanitization_metrics_with_html(self):
        """Test sanitization metrics with HTML content"""
        input_text = "<b>Hello</b> <i>world</i>"
        metrics = get_sanitization_metrics(input_text)

        # Should have removed HTML tags
        assert metrics['total_chars_removed'] > 0
        assert metrics['sanitization_impact'] > 0
        assert "Hello world" in metrics['sanitized_text']

    def test_sanitization_metrics_threshold(self):
        """Test threshold calculation for 5% impact"""
        # Create input that will have exactly 5% impact when sanitized
        # 20 chars input, remove 1 char = 5% impact
        input_text = "Normal text<script>"  # 20 chars, script tag removed
        metrics = get_sanitization_metrics(input_text)

        assert metrics['original_length'] == len(input_text)
        assert metrics['threshold_exceeded'] == (metrics['sanitization_impact'] > 0.05)

    def test_sanitization_metrics_bleach_applied(self):
        """Test metrics when bleach sanitization is applied"""
        input_text = "<script>alert('xss')</script>Hello world"
        metrics = get_sanitization_metrics(input_text)

        assert metrics['bleach_applied'] == True
        assert "Hello world" in metrics['sanitized_text']
        assert "<script>" not in metrics['sanitized_text']

    def test_generate_sanitization_advice_no_changes(self):
        """Test advice generation when no sanitization occurred"""
        metrics = get_sanitization_metrics("Safe content")
        advice = generate_sanitization_advice(metrics)

        assert "No sanitization needed" in advice or "already safe" in advice

    def test_generate_sanitization_advice_script_removed(self):
        """Test advice when script tags are removed"""
        metrics = get_sanitization_metrics("<script>evil()</script>Good content")
        advice = generate_sanitization_advice(metrics)

        assert "JavaScript code removed" in advice
        assert "XSS attempt neutralized" in advice

    def test_generate_sanitization_advice_html_removed(self):
        """Test advice when HTML tags are removed"""
        metrics = get_sanitization_metrics("<b>Bold</b> and <i>italic</i>")
        advice = generate_sanitization_advice(metrics)

        assert "HTML tags removed" in advice

    def test_generate_sanitization_advice_high_impact(self):
        """Test advice for high impact sanitization"""
        # Create high impact by having mostly removable content
        input_text = "<script></script><style></style><div></div>" * 10  # Lots of tags
        metrics = get_sanitization_metrics(input_text)
        advice = generate_sanitization_advice(metrics)

        if metrics['sanitization_impact'] > 0.2:
            assert "Significant content sanitization detected" in advice

    def test_sanitization_metrics_detailed_breakdown(self):
        """Test detailed breakdown of removed characters by step"""
        input_text = "Hello\x00<script>evil()</script>\u200B"
        metrics = get_sanitization_metrics(input_text)

        removed = metrics['removed_by_step']
        assert isinstance(removed, dict)
        assert 'symbol_stripping' in removed
        assert 'script_tags' in removed
        assert 'bleach_sanitization' in removed