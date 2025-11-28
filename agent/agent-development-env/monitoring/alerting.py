# monitoring/alerting.py
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from prometheus_client import Gauge

# Alerting metrics
ACTIVE_ALERTS = Gauge("active_alerts", "Number of currently active alerts")


class AlertManager:
    def __init__(self):
        self.active_alerts: Dict[str, Dict[str, Any]] = {}
        self.alert_thresholds = {
            "pdf_processing_duration": 30.0,  # seconds
            "pdf_failure_rate": 0.1,  # 10%
            "chat_response_time": 10.0,  # seconds
            "system_cpu_usage": 90.0,  # percent
            "system_memory_usage": 90.0,  # percent
            "active_connections": 100,  # connections
        }
        self.notification_cooldown = timedelta(minutes=5)  # Don't spam notifications

    def check_thresholds(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check metrics against thresholds and return alerts"""
        alerts = []

        # PDF processing duration alert
        if "pdf_processing_duration" in metrics:
            duration = metrics["pdf_processing_duration"]
            if duration > self.alert_thresholds["pdf_processing_duration"]:
                alerts.append(
                    {
                        "type": "pdf_processing_slow",
                        "severity": "warning",
                        "message": f'PDF processing duration ({duration:.2f}s) exceeds threshold ({self.alert_thresholds["pdf_processing_duration"]}s)',
                        "value": duration,
                        "threshold": self.alert_thresholds["pdf_processing_duration"],
                    }
                )

        # PDF failure rate alert
        if "pdf_failure_rate" in metrics:
            rate = metrics["pdf_failure_rate"]
            if rate > self.alert_thresholds["pdf_failure_rate"]:
                alerts.append(
                    {
                        "type": "pdf_high_failure_rate",
                        "severity": "critical",
                        "message": f'PDF processing failure rate ({rate:.2%}) exceeds threshold ({self.alert_thresholds["pdf_failure_rate"]:.2%})',
                        "value": rate,
                        "threshold": self.alert_thresholds["pdf_failure_rate"],
                    }
                )

        # Chat response time alert
        if "chat_response_time" in metrics:
            response_time = metrics["chat_response_time"]
            if response_time > self.alert_thresholds["chat_response_time"]:
                alerts.append(
                    {
                        "type": "chat_response_slow",
                        "severity": "warning",
                        "message": f'Chat response time ({response_time:.2f}s) exceeds threshold ({self.alert_thresholds["chat_response_time"]}s)',
                        "value": response_time,
                        "threshold": self.alert_thresholds["chat_response_time"],
                    }
                )

        # System resource alerts
        if "cpu_usage" in metrics:
            cpu = metrics["cpu_usage"]
            if cpu > self.alert_thresholds["system_cpu_usage"]:
                alerts.append(
                    {
                        "type": "high_cpu_usage",
                        "severity": "critical",
                        "message": f'CPU usage ({cpu:.1f}%) exceeds threshold ({self.alert_thresholds["system_cpu_usage"]}%)',
                        "value": cpu,
                        "threshold": self.alert_thresholds["system_cpu_usage"],
                    }
                )

        if "memory_usage" in metrics:
            memory = metrics["memory_usage"]
            if memory > self.alert_thresholds["system_memory_usage"]:
                alerts.append(
                    {
                        "type": "high_memory_usage",
                        "severity": "critical",
                        "message": f'Memory usage ({memory:.1f}%) exceeds threshold ({self.alert_thresholds["system_memory_usage"]}%)',
                        "value": memory,
                        "threshold": self.alert_thresholds["system_memory_usage"],
                    }
                )

        if "active_connections" in metrics:
            connections = metrics["active_connections"]
            if connections > self.alert_thresholds["active_connections"]:
                alerts.append(
                    {
                        "type": "high_connection_count",
                        "severity": "warning",
                        "message": f'Active connections ({connections}) exceeds threshold ({self.alert_thresholds["active_connections"]})',
                        "value": connections,
                        "threshold": self.alert_thresholds["active_connections"],
                    }
                )

        return alerts

    def add_alert(self, alert: Dict[str, Any]):
        """Add an alert to active alerts"""
        alert_id = f"{alert['type']}_{datetime.now().isoformat()}"
        alert["id"] = alert_id
        alert["timestamp"] = datetime.now()
        alert["last_notification"] = None

        self.active_alerts[alert_id] = alert
        ACTIVE_ALERTS.set(len(self.active_alerts))

        logging.warning(f"ALERT_TRIGGERED: {alert['message']}")

    def resolve_alert(self, alert_id: str):
        """Resolve an active alert"""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            logging.info(f"ALERT_RESOLVED: {alert['message']}")
            del self.active_alerts[alert_id]
            ACTIVE_ALERTS.set(len(self.active_alerts))

    def should_notify(self, alert: Dict[str, Any]) -> bool:
        """Check if we should send a notification for this alert"""
        last_notification = alert.get("last_notification")
        if last_notification is None:
            return True

        return datetime.now() - last_notification > self.notification_cooldown

    async def send_notification(self, alert: Dict[str, Any]):
        """Send notification for alert"""
        try:
            # Email notification
            await self._send_email_alert(alert)

            # Update last notification time
            alert["last_notification"] = datetime.now()

        except Exception as e:
            logging.error(f"Failed to send alert notification: {e}")

    async def _send_email_alert(self, alert: Dict[str, Any]):
        """Send email alert"""
        smtp_server = os.getenv("SMTP_SERVER")
        smtp_port_str = os.getenv("SMTP_PORT", "587")
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        alert_email = os.getenv("ALERT_EMAIL")

        if not all([smtp_server, smtp_user, smtp_password, alert_email]):
            logging.warning("Email configuration incomplete, skipping email alert")
            return

        # At this point we know they are not None due to the check above
        assert smtp_server is not None
        assert smtp_user is not None
        assert smtp_password is not None
        assert alert_email is not None

        try:
            smtp_port = int(smtp_port_str)
        except ValueError:
            smtp_port = 587

        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = alert_email
        msg["Subject"] = (
            f"MCP Security Alert: {alert['type'].replace('_', ' ').title()}"
        )

        body = f"""
MCP Security System Alert

Type: {alert['type']}
Severity: {alert['severity']}
Message: {alert['message']}
Value: {alert['value']}
Threshold: {alert['threshold']}
Timestamp: {alert['timestamp'].isoformat()}

Please check the system monitoring dashboard for more details.
        """

        msg.attach(MIMEText(body, "plain"))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        text = msg.as_string()
        server.sendmail(smtp_user, alert_email, text)
        server.quit()

    async def process_metrics_and_alert(self, metrics: Dict[str, Any]):
        """Process metrics and trigger alerts if needed"""
        alerts = self.check_thresholds(metrics)

        for alert in alerts:
            alert_id = alert["id"]

            # Check if this alert is already active
            if alert_id not in self.active_alerts:
                self.add_alert(alert)

                # Send notification if cooldown allows
                if self.should_notify(alert):
                    await self.send_notification(alert)
            else:
                # Update existing alert
                existing_alert = self.active_alerts[alert_id]
                existing_alert["value"] = alert["value"]  # Update with latest value

                # Send notification if cooldown allows
                if self.should_notify(existing_alert):
                    await self.send_notification(existing_alert)


# Global alert manager instance
alert_manager = AlertManager()
