## Phase 2: Agent Development

### 2.1 Core Agent Structure

Create the main agent file:

```python
# agent/security_agent.py
import os
from deepagent import Agent, Tool
from langsmith import traceable
from config.backend_config import BACKEND_CONFIG
import requests
import json
from typing import Dict, Any

class SecurityAgent(Agent):
    def __init__(self):
        super().__init__(
            name="MCP Security Agent",
            description="Autonomous security agent for MCP-Security backend",
            tools=self._initialize_tools()
        )
        self.backend_config = BACKEND_CONFIG
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.backend_config['api_key']}",
            "Content-Type": "application/json"
        })

    def _initialize_tools(self) -> list[Tool]:
        """Initialize all backend-integrated tools"""
        return [
            self._create_sanitization_tool(),
            self._create_monitoring_tool(),
            self._create_document_tool(),
            self._create_admin_tool(),
            self._create_learning_tool()
        ]

    @traceable(name="ai_pdf_enhancement")
    def _create_ai_pdf_tool(self) -> Tool:
        """Tool for AI-powered PDF text enhancement"""
        def enhance_pdf_text(content: str, transformation_type: str = "structure") -> Dict[str, Any]:
            """Enhance PDF text using Langchain and GPT models"""
            try:
                from langchain.chains import LLMChain
                from langchain.prompts import PromptTemplate
                from langchain.llms import OpenAI

                # Initialize Langchain components
                llm = OpenAI(temperature=0.1, model_name="gpt-3.5-turbo")
                prompt = self._get_pdf_enhancement_prompt(transformation_type)

                chain = LLMChain(llm=llm, prompt=prompt)

                # Process content through AI pipeline
                enhanced_content = chain.run(text=content)

                # Validate and structure output
                structured_output = self._validate_ai_output(enhanced_content, transformation_type)

                return {
                    "success": True,
                    "original_content": content,
                    "enhanced_content": enhanced_content,
                    "structured_output": structured_output,
                    "transformation_type": transformation_type,
                    "processing_metadata": {
                        "model_used": "gpt-3.5-turbo",
                        "processing_time": "calculated",
                        "confidence_score": self._calculate_confidence(structured_output)
                    }
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"AI enhancement failed: {str(e)}",
                    "fallback_content": content  # Return original if AI fails
                }

        return Tool(
            name="ai_pdf_enhancement",
            description="Enhance PDF text using AI for better structure and readability",
            function=enhance_pdf_text,
            parameters={
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "Raw PDF text to enhance"},
                    "transformation_type": {
                        "type": "string",
                        "enum": ["structure", "summarize", "extract_entities", "json_schema"],
                        "description": "Type of AI transformation to apply"
                    }
                },
                "required": ["content"]
            }
        )

    def _get_pdf_enhancement_prompt(self, transformation_type: str) -> PromptTemplate:
        """Get appropriate prompt template for transformation type"""
        prompts = {
            "structure": """
            Transform the following raw PDF text into well-structured, readable content.
            Improve formatting, fix any OCR errors, and organize the content logically.
            Maintain all important information while making it more readable:

            Raw text: {text}

            Structured output:
            """,
            "summarize": """
            Create a concise summary of the following PDF content, highlighting key points and main ideas:

            Content: {text}

            Summary:
            """,
            "extract_entities": """
            Extract and categorize key entities from the following text (people, organizations, dates, locations, etc.):

            Text: {text}

            Extracted entities:
            """,
            "json_schema": """
            Convert the following text into a structured JSON format with appropriate keys and values.
            Identify logical sections and create a hierarchical JSON structure:

            Text: {text}

            JSON output:
            """
        }
        return PromptTemplate(template=prompts[transformation_type], input_variables=["text"])

    def _validate_ai_output(self, output: str, transformation_type: str) -> Dict[str, Any]:
        """Validate and structure AI output"""
        try:
            if transformation_type == "json_schema":
                # Parse JSON output
                return json.loads(output)
            else:
                # Return structured text
                return {"enhanced_text": output, "word_count": len(output.split())}
        except json.JSONDecodeError:
            # Fallback for invalid JSON
            return {"enhanced_text": output, "validation_error": "Invalid JSON structure"}

    def _calculate_confidence(self, structured_output: Dict) -> float:
        """Calculate confidence score for AI output"""
        # Simple confidence calculation based on output structure
        if isinstance(structured_output, dict) and len(structured_output) > 0:
            return 0.8  # High confidence for structured output
        return 0.5  # Medium confidence for text-only output

    @traceable(name="sanitize_content")
    def _create_sanitization_tool(self) -> Tool:
        """Tool for content sanitization"""
        def sanitize_content(content: str, classification: str = "general") -> Dict[str, Any]:
            """Sanitize content using backend API"""
            payload = {
                "data": content,
                "classification": classification
            }

            response = self.session.post(
                f"{self.backend_config['base_url']}{self.backend_config['endpoints']['sanitize']}",
                json=payload
            )

            if response.status_code == 200:
                return {
                    "success": True,
                    "sanitized_content": response.json().get("sanitizedData"),
                    "processing_time": response.elapsed.total_seconds()
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code
                }

        return Tool(
            name="sanitize_content",
            description="Sanitize potentially malicious content using MCP-Security backend",
            function=sanitize_content,
            parameters={
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "Content to sanitize"},
                    "classification": {"type": "string", "description": "Content classification (general, llm, api)"}
                },
                "required": ["content"]
            }
        )
```

### 2.2 Monitoring and Learning Tools

```python
# agent/monitoring_tools.py
from deepagent import Tool
from langsmith import traceable
import pandas as pd
from datetime import datetime, timedelta

class MonitoringTools:
    def __init__(self, agent):
        self.agent = agent

    @traceable(name="monitor_system_health")
    def create_monitoring_tool(self) -> Tool:
        """Tool for monitoring system health and performance"""
        def monitor_system() -> Dict[str, Any]:
            """Get comprehensive system monitoring data"""
            try:
                # Get reuse statistics
                response = self.agent.session.get(
                    f"{self.agent.backend_config['base_url']}{self.agent.backend_config['endpoints']['monitoring']}"
                )

                if response.status_code == 200:
                    stats = response.json()

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
                return {"success": False, "error": str(e)}

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
        def learn_from_data(days_back: int = 7) -> Dict[str, Any]:
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

                response = self.agent.session.post(
                    f"{self.agent.backend_config['base_url']}{self.agent.backend_config['endpoints']['export_data']}",
                    json=payload
                )

                if response.status_code == 200:
                    # Process the exported data for learning
                    training_data = response.json()

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
                return {"success": False, "error": str(e)}

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
```

### 2.3 Orchestration and Response Tools

```python
# agent/response_tools.py
from deepagent import Tool
from langsmith import traceable
import json

class ResponseTools:
    def __init__(self, agent):
        self.agent = agent

    @traceable(name="orchestrate_response")
    def create_orchestration_tool(self) -> Tool:
        """Tool for orchestrating automated security responses"""
        def orchestrate_response(threat_level: str, threat_details: str, actions: list) -> Dict[str, Any]:
            """Orchestrate automated response to detected threats"""
            results = {
                "threat_level": threat_level,
                "threat_details": threat_details,
                "actions_attempted": [],
                "actions_successful": [],
                "actions_failed": []
            }

            for action in actions:
                try:
                    if action["type"] == "admin_override":
                        result = self._activate_admin_override(action)
                    elif action["type"] == "n8n_workflow":
                        result = self._trigger_n8n_workflow(action)
                    elif action["type"] == "sanitize_content":
                        result = self._emergency_sanitize(action)
                    else:
                        result = {"success": False, "error": f"Unknown action type: {action['type']}"}

                    results["actions_attempted"].append(action["type"])

                    if result["success"]:
                        results["actions_successful"].append({
                            "action": action["type"],
                            "result": result
                        })
                    else:
                        results["actions_failed"].append({
                            "action": action["type"],
                            "error": result.get("error", "Unknown error")
                        })

                except Exception as e:
                    results["actions_failed"].append({
                        "action": action["type"],
                        "error": str(e)
                    })

            # Log orchestration results
            self._log_orchestration_results(results)

            return results

        return Tool(
            name="orchestrate_response",
            description="Orchestrate automated security responses to detected threats",
            function=orchestrate_response,
            parameters={
                "type": "object",
                "properties": {
                    "threat_level": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                    "threat_details": {"type": "string", "description": "Description of the detected threat"},
                    "actions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string", "enum": ["admin_override", "n8n_workflow", "sanitize_content"]},
                                "parameters": {"type": "object"}
                            }
                        }
                    }
                },
                "required": ["threat_level", "threat_details", "actions"]
            }
        )

    def _activate_admin_override(self, action: Dict) -> Dict[str, Any]:
        """Activate admin override for emergency response"""
        payload = {
            "duration": action.get("parameters", {}).get("duration", 1800000),  # 30 minutes default
            "justification": f"Automated response to {action.get('threat_level', 'unknown')} threat"
        }

        response = self.agent.session.post(
            f"{self.agent.backend_config['base_url']}{self.agent.backend_config['endpoints']['admin_override']}",
            json=payload
        )

        return {
            "success": response.status_code == 200,
            "response": response.json() if response.status_code == 200 else response.text
        }

    def _trigger_n8n_workflow(self, action: Dict) -> Dict[str, Any]:
        """Trigger N8N workflow for automated response"""
        payload = {
            "data": json.dumps({
                "threat_level": action.get("threat_level"),
                "threat_details": action.get("threat_details"),
                "timestamp": str(datetime.now()),
                "automated": True
            })
        }

        response = self.agent.session.post(
            f"{self.agent.backend_config['base_url']}{self.agent.backend_config['endpoints']['n8n_webhook']}",
            json=payload
        )

        return {
            "success": response.status_code == 200,
            "response": response.json() if response.status_code == 200 else response.text
        }

    def _emergency_sanitize(self, action: Dict) -> Dict[str, Any]:
        """Perform emergency sanitization of suspicious content"""
        payload = {
            "data": action.get("parameters", {}).get("content", ""),
            "classification": "emergency"
        }

        response = self.agent.session.post(
            f"{self.agent.backend_config['base_url']}{self.agent.backend_config['endpoints']['sanitize']}",
            json=payload
        )

        return {
            "success": response.status_code == 200,
            "sanitized_content": response.json().get("sanitizedData") if response.status_code == 200 else None
        }

    def _log_orchestration_results(self, results: Dict) -> None:
        """Log orchestration results for learning"""
        # This would integrate with LangSmith for memory persistence
        pass
```
