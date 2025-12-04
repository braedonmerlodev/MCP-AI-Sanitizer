#!/usr/bin/env node

/**
 * Agent Message System Health Monitor
 * Monitors system health, performance metrics, and provides alerting
 * for the agent message integration system
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AgentMessageHealthMonitor {
  constructor() {
    this.metrics = {};
    this.alerts = [];
    this.baselines = {
      responseTime: { warning: 300, critical: 1000 }, // ms
      errorRate: { warning: 0.05, critical: 0.1 }, // 5%, 10%
      memoryUsage: { warning: 80, critical: 95 }, // % of available
      cpuUsage: { warning: 70, critical: 90 }, // % of available
      websocketConnections: { warning: 1000, critical: 2000 }, // concurrent connections
      messageQueueDepth: { warning: 100, critical: 500 }, // queued messages
    };

    this.monitoringInterval = 30000; // 30 seconds
    this.alertCooldown = 300000; // 5 minutes between similar alerts
    this.lastAlerts = new Map();
  }

  async startMonitoring() {
    console.log('🩺 Starting Agent Message System Health Monitoring...\n');

    // Initial health check
    await this.performHealthCheck();

    // Start continuous monitoring
    setInterval(async () => {
      await this.performHealthCheck();
      this.checkThresholds();
      this.processAlerts();
      this.generateHealthReport();
    }, this.monitoringInterval);

    // Graceful shutdown handling
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping health monitoring...');
      this.generateFinalReport();
      process.exit(0);
    });
  }

  async performHealthCheck() {
    const timestamp = new Date().toISOString();

    try {
      // API Health Check
      const apiHealth = await this.checkAPIHealth();

      // WebSocket Health Check
      const websocketHealth = await this.checkWebSocketHealth();

      // Database Health Check
      const databaseHealth = await this.checkDatabaseHealth();

      // System Resource Check
      const systemResources = await this.checkSystemResources();

      // Agent Message Queue Health
      const messageQueueHealth = await this.checkMessageQueueHealth();

      // Performance Metrics
      const performanceMetrics = await this.checkPerformanceMetrics();

      this.metrics[timestamp] = {
        api: apiHealth,
        websocket: websocketHealth,
        database: databaseHealth,
        system: systemResources,
        queue: messageQueueHealth,
        performance: performanceMetrics,
      };

      console.log(`✅ Health check completed at ${timestamp}`);
    } catch (error) {
      console.error(`❌ Health check failed: ${error.message}`);
      this.metrics[timestamp] = {
        error: error.message,
        timestamp,
      };
    }
  }

  async checkAPIHealth() {
    try {
      const response = await fetch('http://localhost:3000/api/monitoring/metrics');
      const data = await response.json();

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: data.responseTime || 0,
        uptime: data.uptime || 0,
        totalRequests: data.requests?.total || 0,
        errorRate: data.requests?.total > 0 ? (data.errors?.total || 0) / data.requests.total : 0,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  async checkWebSocketHealth() {
    // Mock WebSocket health check - would need actual WebSocket monitoring
    return {
      status: 'healthy',
      activeConnections: Math.floor(Math.random() * 100), // Mock data
      messagesPerSecond: Math.floor(Math.random() * 50),
      connectionErrors: Math.floor(Math.random() * 5),
    };
  }

  async checkDatabaseHealth() {
    try {
      // Check database connectivity and performance
      const start = Date.now();
      // Mock database query - would need actual database check
      await new Promise((resolve) => setTimeout(resolve, 10));
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        responseTime,
        connectionPoolSize: 10,
        activeConnections: 3,
        queryLatency: responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  async checkSystemResources() {
    try {
      // Get system resource usage
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          external: memUsage.external,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: process.uptime(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  async checkMessageQueueHealth() {
    // Mock message queue health - would need actual queue monitoring
    return {
      status: 'healthy',
      queueDepth: Math.floor(Math.random() * 50),
      processingRate: Math.floor(Math.random() * 20),
      failedMessages: Math.floor(Math.random() * 3),
      averageProcessingTime: Math.floor(Math.random() * 200) + 50,
    };
  }

  async checkPerformanceMetrics() {
    try {
      // Run quick performance test
      const start = Date.now();

      await fetch('http://localhost:3000/api/sanitize/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: JSON.stringify({ test: 'performance check' }),
          classification: 'user_input',
        }),
      });

      const responseTime = Date.now() - start;

      return {
        apiResponseTime: responseTime,
        throughput: Math.floor(Math.random() * 100), // Mock throughput
        errorRate: Math.random() * 0.05, // Mock error rate
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  checkThresholds() {
    const latestMetrics = this.getLatestMetrics();

    if (!latestMetrics) return;

    // Check API response time
    if (latestMetrics.api.responseTime > this.baselines.responseTime.critical) {
      this.addAlert(
        'CRITICAL',
        'API Response Time',
        `Response time ${latestMetrics.api.responseTime}ms exceeds critical threshold`,
      );
    } else if (latestMetrics.api.responseTime > this.baselines.responseTime.warning) {
      this.addAlert(
        'WARNING',
        'API Response Time',
        `Response time ${latestMetrics.api.responseTime}ms exceeds warning threshold`,
      );
    }

    // Check error rate
    if (latestMetrics.api.errorRate > this.baselines.errorRate.critical) {
      this.addAlert(
        'CRITICAL',
        'Error Rate',
        `Error rate ${(latestMetrics.api.errorRate * 100).toFixed(2)}% exceeds critical threshold`,
      );
    } else if (latestMetrics.api.errorRate > this.baselines.errorRate.warning) {
      this.addAlert(
        'WARNING',
        'Error Rate',
        `Error rate ${(latestMetrics.api.errorRate * 100).toFixed(2)}% exceeds warning threshold`,
      );
    }

    // Check memory usage
    if (latestMetrics.system.memory.percentage > this.baselines.memoryUsage.critical) {
      this.addAlert(
        'CRITICAL',
        'Memory Usage',
        `Memory usage ${latestMetrics.system.memory.percentage.toFixed(2)}% exceeds critical threshold`,
      );
    } else if (latestMetrics.system.memory.percentage > this.baselines.memoryUsage.warning) {
      this.addAlert(
        'WARNING',
        'Memory Usage',
        `Memory usage ${latestMetrics.system.memory.percentage.toFixed(2)}% exceeds warning threshold`,
      );
    }

    // Check WebSocket connections
    if (latestMetrics.websocket.activeConnections > this.baselines.websocketConnections.critical) {
      this.addAlert(
        'CRITICAL',
        'WebSocket Connections',
        `${latestMetrics.websocket.activeConnections} connections exceeds critical threshold`,
      );
    } else if (
      latestMetrics.websocket.activeConnections > this.baselines.websocketConnections.warning
    ) {
      this.addAlert(
        'WARNING',
        'WebSocket Connections',
        `${latestMetrics.websocket.activeConnections} connections exceeds warning threshold`,
      );
    }

    // Check message queue depth
    if (latestMetrics.queue.queueDepth > this.baselines.messageQueueDepth.critical) {
      this.addAlert(
        'CRITICAL',
        'Message Queue Depth',
        `${latestMetrics.queue.queueDepth} queued messages exceeds critical threshold`,
      );
    } else if (latestMetrics.queue.queueDepth > this.baselines.messageQueueDepth.warning) {
      this.addAlert(
        'WARNING',
        'Message Queue Depth',
        `${latestMetrics.queue.queueDepth} queued messages exceeds warning threshold`,
      );
    }
  }

  addAlert(level, component, message) {
    const alertKey = `${component}:${message}`;
    const now = Date.now();
    const lastAlert = this.lastAlerts.get(alertKey);

    // Check cooldown period
    if (lastAlert && now - lastAlert < this.alertCooldown) {
      return; // Skip alert due to cooldown
    }

    this.alerts.push({
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      acknowledged: false,
    });

    this.lastAlerts.set(alertKey, now);

    console.log(`🚨 ${level}: ${component} - ${message}`);
  }

  processAlerts() {
    // Process unacknowledged alerts
    const unacknowledgedAlerts = this.alerts.filter((alert) => !alert.acknowledged);

    if (unacknowledgedAlerts.length > 0) {
      // In a real system, this would send alerts to monitoring systems
      // For now, just log them
      console.log(`📢 ${unacknowledgedAlerts.length} unacknowledged alerts`);

      // Auto-acknowledge INFO level alerts after 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      this.alerts.forEach((alert) => {
        if (alert.level === 'INFO' && new Date(alert.timestamp) < fiveMinutesAgo) {
          alert.acknowledged = true;
        }
      });
    }
  }

  getLatestMetrics() {
    const timestamps = Object.keys(this.metrics).sort();
    if (timestamps.length === 0) return null;

    return this.metrics[timestamps[timestamps.length - 1]];
  }

  generateHealthReport() {
    const reportDir = 'monitoring-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `health-report-${timestamp}.json`);

    const latestMetrics = this.getLatestMetrics();
    const recentAlerts = this.alerts.slice(-10); // Last 10 alerts

    const report = {
      timestamp: new Date().toISOString(),
      systemStatus: this.determineOverallStatus(),
      latestMetrics,
      recentAlerts,
      summary: {
        totalAlerts: this.alerts.length,
        unacknowledgedAlerts: this.alerts.filter((a) => !a.acknowledged).length,
        monitoringUptime: Object.keys(this.metrics).length * (this.monitoringInterval / 1000),
      },
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  }

  determineOverallStatus() {
    const latestMetrics = this.getLatestMetrics();
    if (!latestMetrics) return 'unknown';

    const criticalAlerts = this.alerts.filter((a) => a.level === 'CRITICAL' && !a.acknowledged);
    const warningAlerts = this.alerts.filter((a) => a.level === 'WARNING' && !a.acknowledged);

    if (criticalAlerts.length > 0) return 'critical';
    if (warningAlerts.length > 0) return 'warning';

    // Check if all components are healthy
    const components = ['api', 'websocket', 'database', 'system', 'queue'];
    const unhealthyComponents = components.filter(
      (comp) => latestMetrics[comp]?.status === 'unhealthy',
    );

    if (unhealthyComponents.length > 0) return 'degraded';

    return 'healthy';
  }

  generateFinalReport() {
    const finalReport = {
      monitoringSession: {
        startTime: new Date(
          Date.now() - Object.keys(this.metrics).length * this.monitoringInterval,
        ).toISOString(),
        endTime: new Date().toISOString(),
        totalChecks: Object.keys(this.metrics).length,
      },
      finalStatus: this.determineOverallStatus(),
      alertSummary: {
        total: this.alerts.length,
        byLevel: {
          CRITICAL: this.alerts.filter((a) => a.level === 'CRITICAL').length,
          WARNING: this.alerts.filter((a) => a.level === 'WARNING').length,
          INFO: this.alerts.filter((a) => a.level === 'INFO').length,
        },
        unacknowledged: this.alerts.filter((a) => !a.acknowledged).length,
      },
      recommendations: this.generateRecommendations(),
    };

    const reportFile = path.join('monitoring-reports', 'final-health-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(finalReport, null, 2));

    console.log('📄 Final health report generated');
  }

  generateRecommendations() {
    const recommendations = [];
    const latestMetrics = this.getLatestMetrics();

    if (!latestMetrics) return recommendations;

    // Response time recommendations
    if (latestMetrics.api.responseTime > this.baselines.responseTime.warning) {
      recommendations.push(
        'Consider optimizing API response times - check database queries and caching',
      );
    }

    // Error rate recommendations
    if (latestMetrics.api.errorRate > this.baselines.errorRate.warning) {
      recommendations.push('Investigate and reduce error rates - check logs for error patterns');
    }

    // Memory recommendations
    if (latestMetrics.system.memory.percentage > this.baselines.memoryUsage.warning) {
      recommendations.push('Monitor memory usage - consider memory optimization or scaling');
    }

    // Connection recommendations
    if (latestMetrics.websocket.activeConnections > this.baselines.websocketConnections.warning) {
      recommendations.push('High WebSocket connection count - consider load balancing');
    }

    // Queue recommendations
    if (latestMetrics.queue.queueDepth > this.baselines.messageQueueDepth.warning) {
      recommendations.push('Message queue depth is high - check message processing performance');
    }

    return recommendations;
  }

  // Method to manually trigger health check
  async manualHealthCheck() {
    console.log('🔍 Performing manual health check...');
    await this.performHealthCheck();
    this.checkThresholds();

    const status = this.determineOverallStatus();
    console.log(`🏥 System Status: ${status.toUpperCase()}`);

    return status;
  }

  // Method to get current alerts
  getCurrentAlerts() {
    return this.alerts.filter((alert) => !alert.acknowledged);
  }

  // Method to acknowledge alerts
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find((a) => a.timestamp === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`✅ Alert acknowledged: ${alert.message}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new AgentMessageHealthMonitor();

  const command = process.argv[2];

  switch (command) {
    case 'start':
      monitor.startMonitoring();
      break;
    case 'check':
      monitor.manualHealthCheck().then((status) => {
        console.log(`Health check result: ${status}`);
        process.exit(status === 'healthy' ? 0 : 1);
      });
      break;
    case 'alerts':
      const alerts = monitor.getCurrentAlerts();
      console.log(`Current alerts: ${alerts.length}`);
      alerts.forEach((alert) => {
        console.log(`- ${alert.level}: ${alert.component} - ${alert.message}`);
      });
      break;
    default:
      console.log('Usage: node agent-message-health-monitor.js <command>');
      console.log('Commands:');
      console.log('  start  - Start continuous monitoring');
      console.log('  check  - Perform manual health check');
      console.log('  alerts - Show current alerts');
      process.exit(1);
  }
}

module.exports = AgentMessageHealthMonitor;
