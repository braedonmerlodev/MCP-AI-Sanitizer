# Agent Message System Alerting Configuration

## Overview

This document defines alerting rules and escalation procedures for the agent message system health monitoring.

## Alert Categories

### Critical Alerts (Immediate Response Required)

- **System Down**: Agent message system is completely unavailable
- **Data Loss**: Agent messages are being lost or corrupted
- **Security Breach**: Unauthorized access or data exposure detected
- **Performance Critical**: Response times > 1000ms sustained

### Warning Alerts (Response Within 1 Hour)

- **High Error Rate**: Error rate > 5% sustained
- **Memory Usage**: Memory usage > 80% of available
- **Queue Backlog**: Message queue depth > 100 pending messages
- **Connection Limits**: WebSocket connections > 1000 concurrent

### Info Alerts (Monitor and Trend)

- **Performance Degradation**: Response times > 300ms
- **Resource Usage**: CPU usage > 70%
- **Connection Growth**: WebSocket connections increasing rapidly

## Alert Channels

### Primary Channels

1. **Email**: Development team distribution list
2. **Slack**: #agent-message-alerts channel
3. **PagerDuty**: Critical alerts for on-call engineer

### Secondary Channels

1. **Dashboard**: Real-time metrics dashboard
2. **Logs**: Structured logging with correlation IDs
3. **Metrics**: Time-series metrics for trending

## Escalation Procedures

### Level 1: Automatic Alerts (0-15 minutes)

- Email notifications sent to development team
- Slack notifications posted to alert channel
- Dashboard indicators turn red/yellow

### Level 2: Manual Escalation (15-60 minutes)

- On-call engineer notified via PagerDuty
- Team lead alerted for critical issues
- Incident response process initiated

### Level 3: Management Escalation (1-4 hours)

- Engineering manager notified
- Customer impact assessment performed
- Communication plan activated

### Level 4: Executive Escalation (4+ hours)

- VP Engineering notified
- Public communication prepared
- Crisis management team assembled

## Alert Definitions

### API Health Alerts

#### API Response Time Critical

```
Condition: avg(response_time) > 1000ms for 5 minutes
Severity: Critical
Channels: Email, Slack, PagerDuty
Escalation: Immediate (Level 2)
Auto-Resolution: avg(response_time) < 500ms for 10 minutes
```

#### API Response Time Warning

```
Condition: avg(response_time) > 300ms for 10 minutes
Severity: Warning
Channels: Email, Slack
Escalation: Level 1
Auto-Resolution: avg(response_time) < 200ms for 5 minutes
```

#### API Error Rate Critical

```
Condition: error_rate > 10% for 5 minutes
Severity: Critical
Channels: Email, Slack, PagerDuty
Escalation: Immediate (Level 2)
Auto-Resolution: error_rate < 5% for 10 minutes
```

#### API Error Rate Warning

```
Condition: error_rate > 5% for 10 minutes
Severity: Warning
Channels: Email, Slack
Escalation: Level 1
Auto-Resolution: error_rate < 2% for 5 minutes
```

### System Resource Alerts

#### Memory Usage Critical

```
Condition: memory_usage > 95% for 2 minutes
Severity: Critical
Channels: Email, Slack, PagerDuty
Escalation: Immediate (Level 2)
Auto-Resolution: memory_usage < 80% for 5 minutes
```

#### Memory Usage Warning

```
Condition: memory_usage > 80% for 5 minutes
Severity: Warning
Channels: Email, Slack
Escalation: Level 1
Auto-Resolution: memory_usage < 70% for 10 minutes
```

#### CPU Usage Critical

```
Condition: cpu_usage > 90% for 5 minutes
Severity: Critical
Channels: Email, Slack, PagerDuty
Escalation: Immediate (Level 2)
Auto-Resolution: cpu_usage < 70% for 10 minutes
```

#### CPU Usage Warning

```
Condition: cpu_usage > 70% for 10 minutes
Severity: Warning
Channels: Email, Slack
Escalation: Level 1
Auto-Resolution: cpu_usage < 50% for 5 minutes
```

### WebSocket Connection Alerts

#### Connection Limit Critical

```
Condition: websocket_connections > 2000 for 2 minutes
Severity: Critical
Channels: Email, Slack, PagerDuty
Escalation: Immediate (Level 2)
Auto-Resolution: websocket_connections < 1500 for 5 minutes
```

#### Connection Limit Warning

```
Condition: websocket_connections > 1000 for 5 minutes
Severity: Warning
Channels: Email, Slack
Escalation: Level 1
Auto-Resolution: websocket_connections < 800 for 10 minutes
```

#### Connection Errors Critical

```
Condition: websocket_connection_errors > 50/minute for 5 minutes
Severity: Critical
Channels: Email, Slack, PagerDuty
Escalation: Immediate (Level 2)
Auto-Resolution: websocket_connection_errors < 10/minute for 10 minutes
```

### Message Queue Alerts

#### Queue Depth Critical

```
Condition: queue_depth > 500 for 2 minutes
Severity: Critical
Channels: Email, Slack, PagerDuty
Escalation: Immediate (Level 2)
Auto-Resolution: queue_depth < 200 for 5 minutes
```

#### Queue Depth Warning

```
Condition: queue_depth > 100 for 5 minutes
Severity: Warning
Channels: Email, Slack
Escalation: Level 1
Auto-Resolution: queue_depth < 50 for 10 minutes
```

#### Message Processing Errors Critical

```
Condition: message_processing_errors > 20/minute for 5 minutes
Severity: Critical
Channels: Email, Slack, PagerDuty
Escalation: Immediate (Level 2)
Auto-Resolution: message_processing_errors < 5/minute for 10 minutes
```

## Alert Suppression Rules

### Maintenance Windows

- Alerts suppressed during scheduled maintenance (defined in maintenance calendar)
- Manual suppression available for known issues
- Auto-suppression for flapping alerts (3 alerts in 10 minutes)

### Dependency Alerts

- Database alerts suppressed if upstream dependency is down
- External API alerts suppressed if provider has outages
- Network alerts suppressed if infrastructure issues detected

## Response Playbooks

### API Response Time Critical

1. Check application logs for errors
2. Review recent deployments
3. Check database performance
4. Scale application instances if needed
5. Implement emergency caching if required

### Memory Usage Critical

1. Check for memory leaks in application code
2. Review recent code changes
3. Restart application instances
4. Scale infrastructure if needed
5. Implement memory limits and circuit breakers

### WebSocket Connection Issues

1. Check WebSocket server configuration
2. Review connection pooling settings
3. Monitor network connectivity
4. Implement connection limits
5. Scale WebSocket infrastructure

### Message Queue Backlog

1. Check message processing workers
2. Review message processing logic
3. Scale worker instances
4. Implement dead letter queues
5. Monitor message processing metrics

## Monitoring Dashboard

### Key Metrics Panels

- API Response Times (p50, p95, p99)
- Error Rates by Endpoint
- System Resource Usage
- WebSocket Connection Count
- Message Queue Depth
- Alert Status and History

### Dashboard Access

- Internal dashboard: `https://monitoring.company.com/agent-messages`
- On-call engineer mobile access
- Real-time alerting integration
- Historical trend analysis

## Testing Alerting

### Alert Testing Procedures

1. **Manual Testing**: Trigger alerts using test endpoints
2. **Automated Testing**: Include alert validation in CI/CD
3. **Integration Testing**: Test alert delivery to all channels
4. **Failover Testing**: Test alert delivery when primary channels fail

### Alert Test Schedule

- Daily: Automated alert validation
- Weekly: Manual alert testing
- Monthly: Full alerting system test
- Quarterly: Disaster recovery alert testing

## Maintenance and Updates

### Alert Configuration Updates

1. Review alert thresholds quarterly
2. Update based on system performance trends
3. Adjust for new features and scaling changes
4. Document all configuration changes

### Alert System Maintenance

- Weekly: Review alert noise and false positives
- Monthly: Update contact lists and escalation paths
- Quarterly: Full alerting system audit
- Annually: Complete alerting system redesign review

## Emergency Contacts

### Primary On-Call

- **Engineering On-Call**: +1-555-0101 (PagerDuty)
- **DevOps On-Call**: +1-555-0102 (PagerDuty)
- **Security On-Call**: +1-555-0103 (PagerDuty)

### Management Contacts

- **Engineering Manager**: manager@company.com
- **VP Engineering**: vp@company.com
- **CTO**: cto@company.com

### External Support

- **Cloud Provider**: support@cloudprovider.com
- **Monitoring Vendor**: support@monitoringvendor.com
- **Security Vendor**: support@securityvendor.com
