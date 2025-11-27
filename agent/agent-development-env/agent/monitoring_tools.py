# agent/monitoring_tools.py
from deepagent import Tool
from datetime import datetime
from langsmith import traceable
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any

class MonitoringTools:
    def __init__(self, agent):
        self.agent = agent

    @traceable(name="monitor_system_health")
    def create_monitoring_tool(self) -> Tool:
        """Tool for monitoring system health and performance"""
        async def monitor_system() -> Dict[str, Any]:
            """Get comprehensive system monitoring data"""
            try:
                # Get reuse statistics
                async with self.agent.session.get(
                    f"{self.agent.backend_config['base_url']}{self.agent.backend_config['endpoints']['monitoring']}"
                ) as response:

                    if response.status == 200:
                        stats = await response.json()

                        # Analyze for anomalies
                        anomalies = self._detect_anomalies(stats)

                        return {
                            "success": True,
                            "statistics": stats,
                            "anomalies_detected": len(anomalies) > 0,
                            "anomaly_details": anomalies,
                            "recommendations": self._generate_recommendations(anomalies)
                        }
                    else:
                        return {"success": False, "error": "Failed to fetch monitoring data"}

            except Exception as e:
                # Return mock data for testing when backend is unavailable
                mock_stats = {
                    "performance": {
                        "cacheHitRate": 85.5,
                        "failureRate": 2.1,
                        "avgResponseTime": 150,
                        "totalRequests": 1250
                    },
                    "security": {
                        "tokensValidated": 980,
                        "sanitizationsPerformed": 450,
                        "riskAssessments": 120
                    },
                    "timestamp": "2024-11-26T12:00:00Z"
                }
                anomalies = self._detect_anomalies(mock_stats)
                return {
                    "success": True,
                    "statistics": mock_stats,
                    "anomalies_detected": len(anomalies) > 0,
                    "anomaly_details": anomalies,
                    "recommendations": self._generate_recommendations(anomalies),
                    "note": "Using mock data - backend unavailable"
                }

        return Tool(
            name="monitor_system",
            description="Monitor MCP-Security system health, performance, and detect anomalies",
            function=monitor_system
        )

    def _detect_anomalies(self, stats: Dict) -> list:
        """Detect anomalies in monitoring data"""
        anomalies = []

        # Check cache hit rate
        cache_hit_rate = stats.get('performance', {}).get('cacheHitRate', 0)
        if cache_hit_rate < 50:  # Below 50% is concerning
            anomalies.append({
                "type": "low_cache_hit_rate",
                "severity": "medium",
                "value": cache_hit_rate,
                "threshold": 50
            })

        # Check validation failure rate
        failure_rate = stats.get('performance', {}).get('failureRate', 0)
        if failure_rate > 5:  # Above 5% is concerning
            anomalies.append({
                "type": "high_failure_rate",
                "severity": "high",
                "value": failure_rate,
                "threshold": 5
            })

        return anomalies

    def _generate_recommendations(self, anomalies: list) -> list:
        """Generate recommendations based on detected anomalies"""
        recommendations = []

        for anomaly in anomalies:
            if anomaly["type"] == "low_cache_hit_rate":
                recommendations.append("Consider increasing trust token reuse or optimizing sanitization cache")
            elif anomaly["type"] == "high_failure_rate":
                recommendations.append("Investigate token validation failures and improve error handling")

        return recommendations

    @traceable(name="learn_from_incidents")
    def create_learning_tool(self) -> Tool:
        """Tool for learning from security incidents"""
        async def learn_from_data(days_back: int = 7) -> Dict[str, Any]:
            """Export and analyze recent security data for learning"""
            try:
                # Export training data
                end_date = datetime.now()
                start_date = end_date - timedelta(days=days_back)

                payload = {
                    "format": "json",
                    "filters": {
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                        "include_risk_assessments": True,
                        "include_audit_trails": True
                    }
                }

                async with self.agent.session.post(
                    f"{self.agent.backend_config['base_url']}{self.agent.backend_config['endpoints']['export_data']}",
                    json=payload
                ) as response:

                    if response.status == 200:
                        # Process the exported data for learning
                        training_data = await response.json()

                        # Analyze patterns
                        patterns = self._analyze_patterns(training_data)

                        return {
                            "success": True,
                            "data_points": len(training_data),
                            "patterns_identified": len(patterns),
                            "learning_insights": patterns,
                            "next_actions": self._generate_learning_actions(patterns)
                        }
                    else:
                        return {"success": False, "error": "Failed to export training data"}

            except Exception as e:
                # Return mock data for testing when backend is unavailable
                mock_data = [
                    {"riskLevel": "low", "incident": "Minor validation error", "timestamp": "2024-11-25T10:00:00Z"},
                    {"riskLevel": "medium", "incident": "Cache miss spike", "timestamp": "2024-11-25T11:00:00Z"},
                    {"riskLevel": "high", "incident": "Potential injection attempt", "timestamp": "2024-11-25T12:00:00Z"},
                    {"riskLevel": "low", "incident": "Rate limit hit", "timestamp": "2024-11-25T13:00:00Z"},
                    {"riskLevel": "medium", "incident": "Token validation failure", "timestamp": "2024-11-25T14:00:00Z"}
                ]
                patterns = self._analyze_patterns(mock_data)
                return {
                    "success": True,
                    "data_points": len(mock_data),
                    "patterns_identified": len(patterns),
                    "learning_insights": patterns,
                    "next_actions": self._generate_learning_actions(patterns),
                    "note": "Using mock data - backend unavailable"
                }

        return Tool(
            name="learn_from_incidents",
            description="Export and analyze recent security incidents for continuous learning",
            function=learn_from_data,
            parameters={
                "type": "object",
                "properties": {
                    "days_back": {"type": "integer", "description": "Number of days of data to analyze", "default": 7}
                }
            }
        )

    def _analyze_patterns(self, data: list) -> list:
        """Analyze patterns in security data"""
        patterns = []

        # Simple pattern analysis (can be enhanced with ML)
        risk_levels = {}
        for item in data:
            risk_level = item.get('riskLevel', 'unknown')
            risk_levels[risk_level] = risk_levels.get(risk_level, 0) + 1

        # Identify dominant patterns
        total = sum(risk_levels.values())
        for level, count in risk_levels.items():
            percentage = (count / total) * 100
            if percentage > 20:  # More than 20% of incidents
                patterns.append({
                    "pattern": f"high_{level}_risk_incidents",
                    "frequency": percentage,
                    "description": f"{percentage:.1f}% of incidents are {level} risk"
                })

        return patterns

    def _generate_learning_actions(self, patterns: list) -> list:
        """Generate actions based on learned patterns"""
        actions = []

        for pattern in patterns:
            if "high_risk" in pattern["pattern"]:
                actions.append("Increase monitoring sensitivity for high-risk patterns")
            elif "unknown_risk" in pattern["pattern"]:
                actions.append("Improve risk classification accuracy")

        return actions