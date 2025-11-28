#!/usr/bin/env python3
# run_monitoring.py - Script to run the monitoring dashboard
import subprocess
import sys
import os


def main():
    """Run the monitoring dashboard"""
    dashboard_path = os.path.join(
        os.path.dirname(__file__), "monitoring", "dashboard.py"
    )

    if not os.path.exists(dashboard_path):
        print(f"Error: Monitoring dashboard not found at {dashboard_path}")
        sys.exit(1)

    print("Starting MCP Security Monitoring Dashboard...")
    print("Dashboard will be available at http://localhost:8501")
    print("Make sure the backend is running on port 3000 for live metrics")

    try:
        # Run streamlit dashboard
        subprocess.run(
            [
                sys.executable,
                "-m",
                "streamlit",
                "run",
                dashboard_path,
                "--server.port",
                "8501",
                "--server.address",
                "0.0.0.0",
            ],
            check=True,
        )
    except KeyboardInterrupt:
        print("\nMonitoring dashboard stopped.")
    except subprocess.CalledProcessError as e:
        print(f"Error running dashboard: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
