#!/usr/bin/env python3
"""
Test runner script for the MCP Security project
Runs all test suites with coverage reporting
"""
import subprocess
import sys
import os
from pathlib import Path

def run_command(cmd, description):
    """Run a command and return success status"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(cmd)}")
    print('='*60)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode == 0:
            print("✓ SUCCESS")
            if result.stdout:
                print(result.stdout)
        else:
            print("✗ FAILED")
            if result.stderr:
                print("STDERR:", result.stderr)
            if result.stdout:
                print("STDOUT:", result.stdout)
        return result.returncode == 0
    except Exception as e:
        print(f"✗ ERROR: {e}")
        return False

def main():
    """Main test runner"""
    print("MCP Security - Comprehensive Test Suite")
    print("=======================================")

    # Ensure we're in the right directory
    if not Path("tests").exists():
        print("Error: tests directory not found. Run from project root.")
        return 1

    success = True

    # Run backend unit tests
    if not run_command([
        "python", "-m", "pytest",
        "tests/test_api.py",
        "-v",
        "--cov=backend",
        "--cov-report=term-missing"
    ], "Backend Unit Tests"):
        success = False

    # Run integration tests
    if not run_command([
        "python", "-m", "pytest",
        "tests/test_integration.py",
        "-v",
        "--cov-append",
        "--cov=backend",
        "--cov-report=term-missing"
    ], "Integration Tests"):
        success = False

    # Run E2E tests
    if not run_command([
        "python", "-m", "pytest",
        "tests/test_e2e.py",
        "-v",
        "--cov-append",
        "--cov=backend",
        "--cov-report=term-missing"
    ], "End-to-End Tests"):
        success = False

    # Run existing import tests
    if not run_command([
        "python", "-m", "pytest",
        "tests/test_imports.py",
        "-v"
    ], "Import Tests"):
        success = False

    # Run frontend tests (if available)
    frontend_test_dir = Path("frontend")
    if frontend_test_dir.exists() and (frontend_test_dir / "package.json").exists():
        if not run_command([
            "cd", "frontend", "&&", "npm", "test", "--", "--watchAll=false", "--verbose"
        ], "Frontend Tests"):
            success = False

    # Generate coverage report
    if not run_command([
        "python", "-m", "pytest",
        "--cov=backend",
        "--cov=agent",
        "--cov-report=html:htmlcov",
        "--cov-report=xml",
        "--cov-report=term-missing",
        "--cov-fail-under=80"
    ], "Coverage Report Generation"):
        success = False

    # Final status
    print(f"\n{'='*60}")
    if success:
        print("🎉 ALL TESTS PASSED!")
        print("Coverage report available at: htmlcov/index.html")
        return 0
    else:
        print("❌ SOME TESTS FAILED!")
        print("Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())