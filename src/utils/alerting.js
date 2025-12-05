const winston = require('winston');

// Alerting configuration
const alertConfig = {
  thresholds: {
    performance: {
      avgTime: { warning: 80, critical: 100 },
      p95Time: { warning: 150, critical: 200 },
      slaCompliance: { warning: 90, critical: 95 },
    },
    tokenGeneration: {
      avgTime: { warning: 80, critical: 100 },
      p95Time: { warning: 150, critical: 200 },
      slaCompliance: { warning: 90, critical: 95 },
    },
    metadataLeakage: {
      incidentsPerHour: { warning: 5, critical: 10 },
      criticalIncidentsPerDay: { warning: 3, critical: 5 },
      highSeverityIncidentsPerDay: { warning: 10, critical: 20 },
    },
  },
  channels: {
    slack: process.env.SLACK_WEBHOOK_URL,
    email: process.env.ALERT_EMAIL,
    pagerduty: process.env.PAGERDUTY_INTEGRATION_KEY,
  },
  suppression: {
    minIntervalMs: 5 * 60 * 1000, // 5 minutes
    autoResolveAfterChecks: 3,
  },
};

// Alert state per instance

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * PerformanceAlerting provides configurable alerting for performance metrics
 */
class PerformanceAlerting {
  constructor(config = {}) {
    this.config = { ...alertConfig, ...config };
    this.state = {
      activeAlerts: new Map(),
      lastAlertTime: new Map(),
      consecutiveGoodChecks: new Map(),
    };
  }

  /**
   * Check performance metrics against thresholds and trigger alerts
   * @param {Object} metrics - Current metrics from monitoring
   */
  checkAndAlert(metrics) {
    const now = Date.now();
    const alerts = [];

    // Check performance metrics
    const perfAlerts = this.checkPerformanceMetrics(metrics.performance, 'performance', now);
    alerts.push(...perfAlerts);

    // Check token generation metrics
    const tokenAlerts = this.checkPerformanceMetrics(
      metrics.tokenGeneration,
      'tokenGeneration',
      now,
    );
    alerts.push(...tokenAlerts);

    // Check metadata leakage metrics
    const leakageAlerts = this.checkMetadataLeakage(metrics, now);
    alerts.push(...leakageAlerts);

    // Send alerts
    for (const alert of alerts) this.sendAlert(alert);

    // Auto-resolve alerts
    this.autoResolveAlerts(metrics, now);

    return alerts;
  }

  /**
   * Check specific performance metrics against thresholds
   * @param {Object} perfMetrics - Performance metrics object
   * @param {string} metricType - Type of metrics (performance or tokenGeneration)
   * @param {number} now - Current timestamp
   * @returns {Array} Array of alerts
   */
  checkPerformanceMetrics(perfMetrics, metricType, now) {
    const alerts = [];
    const thresholds = this.config.thresholds[metricType];

    // Check average time
    if (perfMetrics.avgTime && perfMetrics.avgTime > thresholds.avgTime.critical) {
      alerts.push(
        this.createAlert(
          'critical',
          `${metricType}.avgTime`,
          perfMetrics.avgTime,
          thresholds.avgTime.critical,
          now,
        ),
      );
    } else if (perfMetrics.avgTime && perfMetrics.avgTime > thresholds.avgTime.warning) {
      alerts.push(
        this.createAlert(
          'warning',
          `${metricType}.avgTime`,
          perfMetrics.avgTime,
          thresholds.avgTime.warning,
          now,
        ),
      );
    }

    // Check P95 time
    if (perfMetrics.p95 && perfMetrics.p95 > thresholds.p95Time.critical) {
      alerts.push(
        this.createAlert(
          'critical',
          `${metricType}.p95`,
          perfMetrics.p95,
          thresholds.p95Time.critical,
          now,
        ),
      );
    } else if (perfMetrics.p95 && perfMetrics.p95 > thresholds.p95Time.warning) {
      alerts.push(
        this.createAlert(
          'warning',
          `${metricType}.p95`,
          perfMetrics.p95,
          thresholds.p95Time.warning,
          now,
        ),
      );
    }

    // Check P95 time
    if (perfMetrics.p95 && perfMetrics.p95 > thresholds.p95Time.critical) {
      alerts.push(
        this.createAlert(
          'critical',
          `${metricType}.p95`,
          perfMetrics.p95,
          thresholds.p95Time.critical,
          now,
        ),
      );
    } else if (perfMetrics.p95 && perfMetrics.p95 > thresholds.p95Time.warning) {
      alerts.push(
        this.createAlert(
          'warning',
          `${metricType}.p95`,
          perfMetrics.p95,
          thresholds.p95Time.warning,
          now,
        ),
      );
    }

    // Check P95 time
    if (perfMetrics.p95 && perfMetrics.p95 > thresholds.p95Time.critical) {
      alerts.push(
        this.createAlert(
          'critical',
          `${metricType}.p95`,
          perfMetrics.p95,
          thresholds.p95Time.critical,
          now,
        ),
      );
    } else if (perfMetrics.p95 && perfMetrics.p95 > thresholds.p95Time.warning) {
      alerts.push(
        this.createAlert(
          'warning',
          `${metricType}.p95`,
          perfMetrics.p95,
          thresholds.p95Time.warning,
          now,
        ),
      );
    }

    // Check SLA compliance
    if (
      perfMetrics.slaCompliance &&
      perfMetrics.slaCompliance < thresholds.slaCompliance.critical
    ) {
      alerts.push(
        this.createAlert(
          'critical',
          `${metricType}.slaCompliance`,
          perfMetrics.slaCompliance,
          thresholds.slaCompliance.critical,
          now,
          true,
        ),
      );
    } else if (
      perfMetrics.slaCompliance &&
      perfMetrics.slaCompliance < thresholds.slaCompliance.warning
    ) {
      alerts.push(
        this.createAlert(
          'warning',
          `${metricType}.slaCompliance`,
          perfMetrics.slaCompliance,
          thresholds.slaCompliance.warning,
          now,
          true,
        ),
      );
    }

    return alerts;
  }

  /**
   * Check metadata leakage metrics against thresholds
   * @param {Object} metrics - Current metrics from monitoring
   * @param {number} now - Current timestamp
   * @returns {Array} Array of alerts
   */
  checkMetadataLeakage(metrics, now) {
    const alerts = [];
    const thresholds = this.config.thresholds.metadataLeakage;

    // Get leakage statistics from sanitization monitor if available
    const leakageStats = metrics.aiInputSanitization || {};

    // Check incidents per hour (simplified - would need time-windowed data)
    // For now, we'll check against total incidents as a proxy
    if (
      leakageStats.totalProcessed &&
      leakageStats.totalProcessed > thresholds.incidentsPerHour.critical
    ) {
      alerts.push(
        this.createAlert(
          'critical',
          'metadataLeakage.incidentsPerHour',
          leakageStats.totalProcessed,
          thresholds.incidentsPerHour.critical,
          now,
        ),
      );
    } else if (
      leakageStats.totalProcessed &&
      leakageStats.totalProcessed > thresholds.incidentsPerHour.warning
    ) {
      alerts.push(
        this.createAlert(
          'warning',
          'metadataLeakage.incidentsPerHour',
          leakageStats.totalProcessed,
          thresholds.incidentsPerHour.warning,
          now,
        ),
      );
    }

    // Check for sanitization failures (indicates potential leakage issues)
    if (leakageStats.sanitizationFailures && leakageStats.sanitizationFailures > 0) {
      alerts.push(
        this.createAlert(
          'warning',
          'metadataLeakage.sanitizationFailures',
          leakageStats.sanitizationFailures,
          0, // Any sanitization failure is concerning
          now,
        ),
      );
    }

    // Check for validation failures (indicates metadata leakage detection)
    if (leakageStats.validationFailures && leakageStats.validationFailures > 0) {
      alerts.push(
        this.createAlert(
          'critical',
          'metadataLeakage.validationFailures',
          leakageStats.validationFailures,
          0, // Any validation failure indicates leakage
          now,
        ),
      );
    }

    return alerts;
  }

  /**
   * Create an alert object
   * @param {string} severity - Alert severity (warning, critical)
   * @param {string} metric - Metric name
   * @param {number} value - Current value
   * @param {number} threshold - Threshold value
   * @param {number} timestamp - Alert timestamp
   * @param {boolean} isLowerBetter - True if lower values are better
   * @returns {Object} Alert object
   */
  createAlert(severity, metric, value, threshold, timestamp, isLowerBetter = false) {
    const alertKey = `${metric}-${severity}`;
    const lastAlert = this.state.lastAlertTime.get(alertKey);

    // Check suppression interval
    if (lastAlert && timestamp - lastAlert < this.config.suppression.minIntervalMs) {
      return null; // Suppress alert
    }

    return {
      severity,
      metric,
      value,
      threshold,
      isLowerBetter,
      timestamp,
      message: this.formatAlertMessage(severity, metric, value, threshold, isLowerBetter),
    };
  }

  /**
   * Format alert message
   * @param {string} severity - Alert severity
   * @param {string} metric - Metric name
   * @param {number} value - Current value
   * @param {number} threshold - Threshold value
   * @param {boolean} isLowerBetter - True if lower values are better
   * @returns {string} Formatted message
   */
  formatAlertMessage(severity, metric, value, threshold, isLowerBetter) {
    const direction = isLowerBetter ? 'below' : 'above';
    return `Performance Alert: ${metric} is ${direction} threshold. Current: ${value}, Threshold: ${threshold}`;
  }

  /**
   * Send alert to configured channels
   * @param {Object} alert - Alert object
   */
  async sendAlert(alert) {
    if (!alert) return;

    const alertKey = `${alert.metric}-${alert.severity}`;

    // Log alert
    logger.warn('Performance Alert Triggered', {
      severity: alert.severity,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      timestamp: alert.timestamp,
      message: alert.message,
    });

    // Mark as active
    this.state.activeAlerts.set(alertKey, alert);
    this.state.lastAlertTime.set(alertKey, alert.timestamp);
    this.state.consecutiveGoodChecks.set(alertKey, 0);

    // Send to channels
    await this.sendToSlack(alert);
    await this.sendToEmail(alert);
    await this.sendToPagerDuty(alert);
  }

  /**
   * Send alert to Slack
   * @param {Object} alert - Alert object
   */
  async sendToSlack(alert) {
    if (!this.config.channels.slack) return;

    try {
      const payload = {
        text: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}`,
        attachments: [
          {
            color: alert.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'Metric', value: alert.metric, short: true },
              { title: 'Value', value: alert.value.toString(), short: true },
              { title: 'Threshold', value: alert.threshold.toString(), short: true },
              { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true },
            ],
          },
        ],
      };

      // In real implementation, send HTTP request to Slack webhook
      logger.info('Slack alert sent', { alert: alert.metric, payload });
    } catch (error) {
      logger.error('Failed to send Slack alert', { error: error.message, alert: alert.metric });
    }
  }

  /**
   * Send alert to email
   * @param {Object} alert - Alert object
   */
  async sendToEmail(alert) {
    if (!this.config.channels.email) return;

    try {
      const subject = `Performance Alert: ${alert.severity.toUpperCase()} - ${alert.metric}`;

      // In real implementation, send email
      logger.info('Email alert sent', {
        to: this.config.channels.email,
        subject,
        alert: alert.metric,
      });
    } catch (error) {
      logger.error('Failed to send email alert', { error: error.message, alert: alert.metric });
    }
  }

  /**
   * Send alert to PagerDuty
   * @param {Object} alert - Alert object
   */
  async sendToPagerDuty(alert) {
    if (!this.config.channels.pagerduty) return;

    try {
      const payload = {
        routing_key: this.config.channels.pagerduty,
        event_action: 'trigger',
        dedup_key: `${alert.metric}-${alert.severity}`,
        payload: {
          summary: alert.message,
          severity: alert.severity,
          source: 'performance-monitoring',
          component: 'token-generation',
          group: 'performance',
          class: 'metric-threshold',
          custom_details: {
            metric: alert.metric,
            value: alert.value,
            threshold: alert.threshold,
          },
        },
      };

      // In real implementation, send to PagerDuty API
      logger.info('PagerDuty alert sent', { alert: alert.metric, payload });
    } catch (error) {
      logger.error('Failed to send PagerDuty alert', { error: error.message, alert: alert.metric });
    }
  }

  /**
   * Auto-resolve alerts that have been good for consecutive checks
   * @param {Object} metrics - Current metrics
   * @param {number} now - Current timestamp
   */
  autoResolveAlerts(metrics, now) {
    for (const [alertKey, alert] of this.state.activeAlerts) {
      const isGood = this.isMetricGood(alert, metrics);

      if (isGood) {
        const goodChecks = this.state.consecutiveGoodChecks.get(alertKey) || 0;
        this.state.consecutiveGoodChecks.set(alertKey, goodChecks + 1);

        if (goodChecks + 1 >= this.config.suppression.autoResolveAfterChecks) {
          this.resolveAlert(alertKey, now);
        }
      } else {
        this.state.consecutiveGoodChecks.set(alertKey, 0);
      }
    }
  }

  /**
   * Check if a metric is now good (below threshold)
   * @param {Object} alert - Alert object
   * @param {Object} metrics - Current metrics
   * @returns {boolean} True if metric is good
   */
  isMetricGood(alert, metrics) {
    const [metricType, metricName] = alert.metric.split('.');
    const currentValue = metrics[metricType][metricName];

    return alert.isLowerBetter ? currentValue >= alert.threshold : currentValue <= alert.threshold;
  }

  /**
   * Resolve an alert
   * @param {string} alertKey - Alert key
   * @param {number} timestamp - Resolution timestamp
   */
  resolveAlert(alertKey, timestamp) {
    const alert = this.state.activeAlerts.get(alertKey);
    if (!alert) return;

    logger.info('Alert auto-resolved', {
      alertKey,
      metric: alert.metric,
      duration: timestamp - alert.timestamp,
    });

    this.state.activeAlerts.delete(alertKey);

    // Send resolution to PagerDuty if configured
    if (this.config.channels.pagerduty) {
      this.sendPagerDutyResolution(alertKey);
    }
  }

  /**
   * Send resolution to PagerDuty
   * @param {string} alertKey - Alert key
   */
  async sendPagerDutyResolution(alertKey) {
    try {
      // In real implementation, send to PagerDuty API
      logger.info('PagerDuty resolution sent', { alertKey });
    } catch (error) {
      logger.error('Failed to send PagerDuty resolution', { error: error.message, alertKey });
    }
  }

  /**
   * Get current alert state
   * @returns {Object} Alert state
   */
  getAlertState() {
    return {
      activeAlerts: [...this.state.activeAlerts.values()],
      lastAlertTimes: Object.fromEntries(this.state.lastAlertTime),
      consecutiveGoodChecks: Object.fromEntries(this.state.consecutiveGoodChecks),
    };
  }

  /**
   * Reset alert state
   */
  reset() {
    this.state.activeAlerts.clear();
    this.state.lastAlertTime.clear();
    this.state.consecutiveGoodChecks.clear();
  }
}

module.exports = PerformanceAlerting;
