// Sanitization Metadata Leakage Dashboard
const winston = require('winston');
const SanitizationMonitor = require('../utils/sanitization-monitor');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * SanitizationDashboard provides monitoring dashboard functionality
 * for metadata leakage metrics and trends.
 */
class SanitizationDashboard {
  constructor(options = {}) {
    this.options = {
      retentionDays: options.retentionDays || 30,
      enableHistoricalData: options.enableHistoricalData || true,
      ...options,
    };

    // Dashboard data storage
    this.dashboardData = {
      summary: {
        totalIncidents: 0,
        activeIncidents: 0,
        resolvedIncidents: 0,
        lastUpdated: null,
      },
      trends: {
        daily: [],
        weekly: [],
        monthly: [],
      },
      topPatterns: [],
      topEndpoints: [],
      severityBreakdown: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      recentIncidents: [],
      performance: {
        pipelineMetrics: {
          totalProcessed: 0,
          avgResponseTime: 0,
          p95ResponseTime: 0,
          throughput: 0,
          sanitizationTime: 0,
          aiProcessingTime: 0,
          concurrencyMetrics: {
            activeJobs: 0,
            queueDepth: 0,
            throughput: 0,
          },
        },
        trends: {
          responseTimeTrend: [],
          throughputTrend: [],
          concurrencyTrend: [],
        },
        alerts: [],
      },
    };

    // Historical data storage (if enabled)
    if (this.options.enableHistoricalData) {
      this.historicalData = new Map(); // date -> daily stats
    }
  }

  /**
   * Update dashboard with latest monitoring data
   * @param {SanitizationMonitor} monitor - The sanitization monitor instance
   * @param {Object} performanceMetrics - Pipeline performance metrics from monitoring
   */
  updateDashboard(monitor, performanceMetrics = {}) {
    try {
      const stats = monitor.getStatistics();
      const incidents = monitor.getIncidents();

      // Update summary
      this.dashboardData.summary = {
        totalIncidents: stats.totalIncidents,
        activeIncidents: incidents.filter((i) => !i.resolved).length,
        resolvedIncidents: incidents.filter((i) => i.resolved).length,
        lastUpdated: new Date().toISOString(),
      };

      // Update severity breakdown
      this.dashboardData.severityBreakdown = { ...stats.bySeverity };

      // Update top patterns
      this.dashboardData.topPatterns = Object.entries(stats.byPattern)
        .map(([pattern, count]) => ({ pattern, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Update top endpoints
      this.dashboardData.topEndpoints = Object.entries(stats.byEndpoint)
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Update recent incidents
      this.dashboardData.recentIncidents = [...incidents]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);

      // Update performance metrics
      this.updatePerformanceMetrics(performanceMetrics);

      // Update trends if historical data is enabled
      if (this.options.enableHistoricalData) {
        this.updateTrends();
      }

      logger.info('Dashboard updated successfully', {
        totalIncidents: this.dashboardData.summary.totalIncidents,
        activeIncidents: this.dashboardData.summary.activeIncidents,
      });
    } catch (error) {
      logger.error('Failed to update dashboard', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Update performance metrics in dashboard
   * @param {Object} metrics - Performance metrics from monitoring system
   */
  updatePerformanceMetrics(metrics) {
    const perf = this.dashboardData.performance;

    // Update current pipeline metrics
    if (metrics.pipeline) {
      perf.pipelineMetrics = {
        totalProcessed: metrics.pipeline.totalProcessed || 0,
        avgResponseTime: this.calculateAverage(metrics.pipeline.totalPipelineTime || []),
        p95ResponseTime: this.calculatePercentile(metrics.pipeline.totalPipelineTime || [], 95),
        throughput: metrics.pipeline.concurrencyMetrics?.throughput || 0,
        sanitizationTime: this.calculateAverage(metrics.pipeline.sanitizationTime || []),
        aiProcessingTime: this.calculateAverage(metrics.pipeline.aiProcessingTime || []),
        concurrencyMetrics: metrics.pipeline.concurrencyMetrics || {
          activeJobs: 0,
          queueDepth: 0,
          throughput: 0,
        },
      };
    }

    // Update performance trends (last 10 data points)
    this.updatePerformanceTrends();

    // Check for performance alerts
    perf.alerts = this.checkPerformanceAlerts(perf.pipelineMetrics);

    logger.info('Performance metrics updated in dashboard', {
      totalProcessed: perf.pipelineMetrics.totalProcessed,
      avgResponseTime: perf.pipelineMetrics.avgResponseTime.toFixed(2) + 'ms',
      throughput: perf.pipelineMetrics.throughput.toFixed(0) + ' ops/sec',
    });
  }

  /**
   * Update performance trends data
   */
  updatePerformanceTrends() {
    const now = new Date().toISOString();
    const perf = this.dashboardData.performance;

    // Add current metrics to trends (simplified - in production would use time-series data)
    const currentMetrics = {
      timestamp: now,
      avgResponseTime: perf.pipelineMetrics.avgResponseTime,
      throughput: perf.pipelineMetrics.throughput,
      activeJobs: perf.pipelineMetrics.concurrencyMetrics.activeJobs,
    };

    // Keep last 10 data points for trends
    perf.trends.responseTimeTrend.push(currentMetrics);
    perf.trends.throughputTrend.push(currentMetrics);
    perf.trends.concurrencyTrend.push(currentMetrics);

    for (const trend of [
      perf.trends.responseTimeTrend,
      perf.trends.throughputTrend,
      perf.trends.concurrencyTrend,
    ]) {
      if (trend.length > 10) {
        trend.shift(); // Remove oldest
      }
    }
  }

  /**
   * Check for performance alerts
   * @param {Object} metrics - Current performance metrics
   * @returns {Array} Array of performance alerts
   */
  checkPerformanceAlerts(metrics) {
    const alerts = [];

    // Response time alerts
    if (metrics.avgResponseTime > 100) {
      alerts.push({
        level: 'warning',
        type: 'response_time',
        message: `Average response time (${metrics.avgResponseTime.toFixed(2)}ms) exceeds 100ms threshold`,
        value: metrics.avgResponseTime,
        threshold: 100,
        timestamp: new Date().toISOString(),
      });
    }

    if (metrics.p95ResponseTime > 200) {
      alerts.push({
        level: 'critical',
        type: 'response_time_p95',
        message: `P95 response time (${metrics.p95ResponseTime.toFixed(2)}ms) exceeds 200ms threshold`,
        value: metrics.p95ResponseTime,
        threshold: 200,
        timestamp: new Date().toISOString(),
      });
    }

    // Throughput alerts
    if (metrics.throughput < 100) {
      alerts.push({
        level: 'warning',
        type: 'throughput',
        message: `Throughput (${metrics.throughput.toFixed(0)} ops/sec) below 100 ops/sec minimum`,
        value: metrics.throughput,
        threshold: 100,
        timestamp: new Date().toISOString(),
      });
    }

    // Concurrency alerts
    if (metrics.concurrencyMetrics.queueDepth > 10) {
      alerts.push({
        level: 'warning',
        type: 'queue_depth',
        message: `Queue depth (${metrics.concurrencyMetrics.queueDepth}) exceeds 10 threshold`,
        value: metrics.concurrencyMetrics.queueDepth,
        threshold: 10,
        timestamp: new Date().toISOString(),
      });
    }

    return alerts;
  }

  /**
   * Update trend data for dashboard
   */
  updateTrends() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get today's stats
    const todayStats = {
      date: today,
      incidents: this.dashboardData.summary.totalIncidents,
      bySeverity: { ...this.dashboardData.severityBreakdown },
      topPatterns: this.dashboardData.topPatterns.slice(0, 5),
    };

    // Store in historical data
    this.historicalData.set(today, todayStats);

    // Update daily trends (last 7 days)
    const dailyTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayStats = this.historicalData.get(dateKey) || {
        date: dateKey,
        incidents: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        topPatterns: [],
      };
      dailyTrends.push(dayStats);
    }
    this.dashboardData.trends.daily = dailyTrends;

    // Update weekly trends (last 4 weeks)
    const weeklyTrends = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekKey = `week-${weekStart.toISOString().split('T')[0]}`;

      // Aggregate weekly data
      let weekIncidents = 0;
      const weekSeverity = { critical: 0, high: 0, medium: 0, low: 0 };
      const weekPatterns = new Map();

      for (let j = 0; j < 7; j++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + j);
        const dayKey = dayDate.toISOString().split('T')[0];
        const dayStats = this.historicalData.get(dayKey);

        if (dayStats) {
          weekIncidents += dayStats.incidents;
          for (const severity of Object.keys(weekSeverity)) {
            weekSeverity[severity] += dayStats.bySeverity[severity] || 0;
          }
          for (const pattern of dayStats.topPatterns) {
            weekPatterns.set(
              pattern.pattern,
              (weekPatterns.get(pattern.pattern) || 0) + pattern.count,
            );
          }
        }
      }

      weeklyTrends.push({
        period: weekKey,
        incidents: weekIncidents,
        bySeverity: weekSeverity,
        topPatterns: [...weekPatterns.entries()]
          .map(([pattern, count]) => ({ pattern, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      });
    }
    this.dashboardData.trends.weekly = weeklyTrends;

    // Clean up old historical data
    this.cleanupHistoricalData();
  }

  /**
   * Clean up old historical data beyond retention period
   */
  cleanupHistoricalData() {
    if (!this.options.enableHistoricalData) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

    const cutoffKey = cutoffDate.toISOString().split('T')[0];

    for (const [dateKey] of this.historicalData) {
      if (dateKey < cutoffKey) {
        this.historicalData.delete(dateKey);
      }
    }
  }

  /**
   * Get dashboard data for API response
   * @param {Object} filters - Optional filters
   * @returns {Object} Dashboard data
   */
  getDashboardData(filters = {}) {
    let data = { ...this.dashboardData };

    // Add performance summary to main summary
    data.summary.performance = {
      totalProcessed: data.performance.pipelineMetrics.totalProcessed,
      avgResponseTime: data.performance.pipelineMetrics.avgResponseTime,
      throughput: data.performance.pipelineMetrics.throughput,
      activeAlerts: data.performance.alerts.length,
    };

    // Apply filters if specified
    if (filters.timeRange) {
      data = this.applyTimeRangeFilter(data, filters.timeRange);
    }

    if (filters.severity) {
      data = this.applySeverityFilter(data, filters.severity);
    }

    return {
      ...data,
      generatedAt: new Date().toISOString(),
      filters: filters,
    };
  }

  /**
   * Apply time range filter to dashboard data
   * @param {Object} data - Dashboard data
   * @param {string} timeRange - Time range (1d, 7d, 30d)
   * @returns {Object} Filtered data
   */
  applyTimeRangeFilter(data, timeRange) {
    const days =
      {
        '1d': 1,
        '7d': 7,
        '30d': 30,
      }[timeRange] || 30;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Filter recent incidents
    data.recentIncidents = data.recentIncidents.filter(
      (incident) => new Date(incident.timestamp) >= cutoffDate,
    );

    // Filter trends
    data.trends.daily = data.trends.daily.filter((day) => new Date(day.date) >= cutoffDate);

    return data;
  }

  /**
   * Apply severity filter to dashboard data
   * @param {Object} data - Dashboard data
   * @param {string} severity - Minimum severity level
   * @returns {Object} Filtered data
   */
  applySeverityFilter(data, severity) {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const minLevel = severityLevels[severity] || 1;

    // Filter incidents by severity
    data.recentIncidents = data.recentIncidents.filter(
      (incident) => severityLevels[incident.severity] >= minLevel,
    );

    // Filter severity breakdown
    const filteredBreakdown = {};
    for (const sev of Object.keys(data.severityBreakdown)) {
      if (severityLevels[sev] >= minLevel) {
        filteredBreakdown[sev] = data.severityBreakdown[sev];
      }
    }
    data.severityBreakdown = filteredBreakdown;

    return data;
  }

  /**
   * Generate dashboard metrics for monitoring systems
   * @returns {Object} Metrics suitable for monitoring systems
   */
  getMetrics() {
    const perf = this.dashboardData.performance;
    return {
      sanitization_leakage: {
        total_incidents: this.dashboardData.summary.totalIncidents,
        active_incidents: this.dashboardData.summary.activeIncidents,
        critical_severity: this.dashboardData.severityBreakdown.critical,
        high_severity: this.dashboardData.severityBreakdown.high,
        top_patterns_count: this.dashboardData.topPatterns.length,
        top_endpoints_count: this.dashboardData.topEndpoints.length,
        recent_incidents_count: this.dashboardData.recentIncidents.length,
      },
      pipeline_performance: {
        total_processed: perf.pipelineMetrics.totalProcessed,
        avg_response_time_ms: perf.pipelineMetrics.avgResponseTime,
        p95_response_time_ms: perf.pipelineMetrics.p95ResponseTime,
        throughput_ops_per_sec: perf.pipelineMetrics.throughput,
        sanitization_time_ms: perf.pipelineMetrics.sanitizationTime,
        ai_processing_time_ms: perf.pipelineMetrics.aiProcessingTime,
        active_jobs: perf.pipelineMetrics.concurrencyMetrics.activeJobs,
        queue_depth: perf.pipelineMetrics.concurrencyMetrics.queueDepth,
        performance_alerts_count: perf.alerts.length,
      },
      trends: {
        daily_incidents_avg: this.calculateAverage(
          this.dashboardData.trends.daily.map((d) => d.incidents),
        ),
        weekly_incidents_avg: this.calculateAverage(
          this.dashboardData.trends.weekly.map((w) => w.incidents),
        ),
        response_time_trend_avg: this.calculateAverage(
          perf.trends.responseTimeTrend.map((t) => t.avgResponseTime),
        ),
        throughput_trend_avg: this.calculateAverage(
          perf.trends.throughputTrend.map((t) => t.throughput),
        ),
      },
    };
  }

  /**
   * Calculate average of array of numbers
   * @param {Array} numbers - Array of numbers
   * @returns {number} Average value
   */
  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  /**
   * Export dashboard data for backup/reporting
   * @returns {Object} Exportable dashboard data
   */
  exportData() {
    return {
      dashboard: this.dashboardData,
      historical: this.options.enableHistoricalData
        ? Object.fromEntries(this.historicalData)
        : null,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        retentionDays: this.options.retentionDays,
      },
    };
  }
}

module.exports = SanitizationDashboard;
