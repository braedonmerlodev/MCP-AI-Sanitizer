# tests/test_imports.py
"""Basic import tests to verify module structure"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_config_imports():
    """Test that config modules can be imported"""
    try:
        from config.backend_config import BACKEND_CONFIG
        from config.agent_prompts import AGENT_SYSTEM_PROMPT, AGENT_TOOLS_CONFIG
        assert isinstance(BACKEND_CONFIG, dict)
        assert isinstance(AGENT_SYSTEM_PROMPT, str)
        assert isinstance(AGENT_TOOLS_CONFIG, dict)
        print("✓ Config imports successful")
    except ImportError as e:
        print(f"✗ Config import failed: {e}")
        raise

def test_agent_imports():
    """Test that agent modules can be imported (will fail without deepagent)"""
    try:
        from agent.security_agent import SecurityAgent
        from agent.monitoring_tools import MonitoringTools
        from agent.response_tools import ResponseTools
        from agent.job_tools import JobTools
        print("✓ Agent imports successful")
    except ImportError as e:
        print(f"⚠ Agent import failed (expected without deepagent): {e}")

def test_main_import():
    """Test that main.py can be imported"""
    try:
        import main
        print("✓ Main import successful")
    except ImportError as e:
        print(f"✗ Main import failed: {e}")
        raise

if __name__ == "__main__":
    test_config_imports()
    test_agent_imports()
    test_main_import()
    print("Basic import tests completed")