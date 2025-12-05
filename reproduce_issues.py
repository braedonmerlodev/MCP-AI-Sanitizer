
import sys
import os
import unittest

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'agent', 'agent-development-env'))

# Mock imports that might fail
import unittest.mock
sys.modules['agent.security_agent'] = unittest.mock.MagicMock()
sys.modules['monitoring.alerting'] = unittest.mock.MagicMock()

try:
    from backend.api import sanitize_input
except ImportError as e:
    print(f"Error importing backend.api: {e}")
    sys.exit(1)

class TestSanitization(unittest.TestCase):
    def test_ssn_attached(self):
        # Case: ssn123-45-6789 (no boundary at start)
        result = sanitize_input("ssn123-45-6789")
        self.assertIn("SSN_REDACTED", result)
        self.assertNotIn("123-45-6789", result)

    def test_phone_attached(self):
        # Case: phone123-456-7890
        result = sanitize_input("phone123-456-7890")
        self.assertIn("PHONE_REDACTED", result)
        self.assertNotIn("123-456-7890", result)

    def test_zero_width_label(self):
        # Case: Zero-width label preservation
        result = sanitize_input("Zero-width characters")
        self.assertEqual(result, "Zero-width characters")

    def test_control_chars_newlines(self):
        # Case: Newlines should be preserved
        result = sanitize_input("Control characters\nEgInvisible")
        self.assertEqual(result, "Control characters\nEgInvisible")

if __name__ == '__main__':
    unittest.main()
