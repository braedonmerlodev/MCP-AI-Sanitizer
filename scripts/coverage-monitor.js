// coverage-monitor.js
// Coverage monitoring utility for test coverage improvements
// Story: 1.11.2 Risk Assessment & Mitigation Strategy

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class CoverageMonitor {
  constructor(options = {}) {
    this.baseline = {
      statements: 73.61,
      branches: 62.84,
      functions: 70.92,
      lines: 73.61,
    };

    this.thresholds = {
      statements: 70.0, // Minimum acceptable
      branches: 60.0,
      functions: 65.0,
      lines: 70.0,
    };

    this.coverageDir = options.coverageDir || 'coverage';
    this.logFile = options.logFile || 'logs/coverage-monitor.log';
    this.alertThreshold = options.alertThreshold || 5.0; // Percentage drop to alert
  }

  async initialize() {
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    await this.log('CoverageMonitor initialized', 'INFO');
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}\n`;

    try {
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    // Also output to console for visibility
    console.log(`${level}: ${message}`);
  }

  async runCoverage() {
    return new Promise((resolve, reject) => {
      const command =
        'npm test -- --coverage --coverageReporters=json --testPathIgnorePatterns="performance"';

      this.log(`Running coverage analysis: ${command}`, 'INFO');

      exec(command, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
        if (error && error.code !== 1) {
          // Jest returns 1 for test failures, which is OK for coverage
          await this.log(`Coverage execution failed: ${error.message}`, 'ERROR');
          reject(error);
          return;
        }

        if (stderr) {
          await this.log(`Coverage stderr: ${stderr}`, 'WARN');
        }

        try {
          const coverageData = await this.readCoverageData();
          const summary = this.calculateSummary(coverageData);
          resolve(summary);
        } catch (parseError) {
          await this.log(`Coverage data parsing failed: ${parseError.message}`, 'ERROR');
          reject(parseError);
        }
      });
    });
  }

  async readCoverageData() {
    const coverageFile = path.join(this.coverageDir, 'coverage-final.json');

    try {
      const data = await fs.readFile(coverageFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to read coverage file ${coverageFile}: ${error.message}`);
    }
  }

  calculateSummary(coverageData) {
    let totalStatements = 0,
      coveredStatements = 0;
    let totalBranches = 0,
      coveredBranches = 0;
    let totalFunctions = 0,
      coveredFunctions = 0;
    let totalLines = 0,
      coveredLines = 0;

    Object.values(coverageData).forEach((file) => {
      // Statements
      totalStatements += file.s.length;
      coveredStatements += file.s.filter((s) => s > 0).length;

      // Branches
      if (file.b) {
        Object.values(file.b).forEach((branches) => {
          totalBranches += branches.length;
          coveredBranches += branches.filter((b) => b > 0).length;
        });
      }

      // Functions
      totalFunctions += file.f.length;
      coveredFunctions += file.f.filter((f) => f > 0).length;

      // Lines (approximation using statements)
      totalLines += file.s.length;
      coveredLines += file.s.filter((s) => s > 0).length;
    });

    const summary = {
      statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
      branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
      functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
      lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
      timestamp: new Date().toISOString(),
      totalFiles: Object.keys(coverageData).length,
    };

    return summary;
  }

  validateThresholds(coverage) {
    const alerts = [];

    Object.keys(this.thresholds).forEach((metric) => {
      const current = coverage[metric];
      const threshold = this.thresholds[metric];
      const baseline = this.baseline[metric];

      if (current < threshold) {
        const drop = baseline - current;
        let severity = 'warning';

        if (current < baseline * 0.9 || drop > this.alertThreshold) {
          severity = 'critical';
        } else if (drop > this.alertThreshold * 0.5) {
          severity = 'high';
        }

        alerts.push({
          metric,
          current: current.toFixed(2),
          threshold,
          baseline: baseline.toFixed(2),
          drop: drop.toFixed(2),
          severity,
        });
      }
    });

    return alerts;
  }

  async checkStability(coverage) {
    const issues = [];

    // Check for extreme variations that might indicate test instability
    Object.keys(coverage).forEach((metric) => {
      if (typeof coverage[metric] === 'number') {
        const baseline = this.baseline[metric];
        const variation = Math.abs(coverage[metric] - baseline);

        if (variation > 10.0) {
          // More than 10% variation
          issues.push({
            type: 'stability',
            metric,
            variation: variation.toFixed(2),
            severity: variation > 20.0 ? 'critical' : 'warning',
          });
        }
      }
    });

    return issues;
  }

  async generateReport(coverage, alerts = [], stabilityIssues = []) {
    const report = {
      timestamp: new Date().toISOString(),
      coverage,
      baseline: this.baseline,
      thresholds: this.thresholds,
      alerts,
      stabilityIssues,
      summary: {
        status: alerts.some((a) => a.severity === 'critical')
          ? 'critical'
          : alerts.some((a) => a.severity === 'high')
            ? 'warning'
            : stabilityIssues.some((i) => i.severity === 'critical')
              ? 'unstable'
              : 'healthy',
        totalAlerts: alerts.length,
        totalStabilityIssues: stabilityIssues.length,
        coverageAboveThreshold: Object.keys(this.thresholds).every(
          (metric) => coverage[metric] >= this.thresholds[metric],
        ),
      },
    };

    return report;
  }

  async saveReport(report, filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `coverage-report-${timestamp}.json`;
    }

    const reportsDir = 'reports/coverage';
    await fs.mkdir(reportsDir, { recursive: true });

    const filepath = path.join(reportsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));

    await this.log(`Coverage report saved: ${filepath}`, 'INFO');
    return filepath;
  }

  async monitor() {
    try {
      await this.initialize();

      await this.log('Starting coverage monitoring cycle', 'INFO');

      // Run coverage analysis
      const coverage = await this.runCoverage();
      await this.log(`Coverage calculated: ${JSON.stringify(coverage)}`, 'INFO');

      // Validate against thresholds
      const alerts = this.validateThresholds(coverage);
      if (alerts.length > 0) {
        await this.log(`Coverage alerts detected: ${alerts.length}`, 'WARN');
        alerts.forEach((alert) => {
          this.log(
            `ALERT [${alert.severity}]: ${alert.metric} coverage ${alert.current}% (threshold: ${alert.threshold}%, baseline: ${alert.baseline}%, drop: ${alert.drop}%)`,
            'WARN',
          );
        });
      }

      // Check stability
      const stabilityIssues = await this.checkStability(coverage);
      if (stabilityIssues.length > 0) {
        await this.log(`Stability issues detected: ${stabilityIssues.length}`, 'WARN');
        stabilityIssues.forEach((issue) => {
          this.log(
            `STABILITY [${issue.severity}]: ${issue.metric} variation ${issue.variation}%`,
            'WARN',
          );
        });
      }

      // Generate and save report
      const report = await this.generateReport(coverage, alerts, stabilityIssues);
      const reportPath = await this.saveReport(report);

      // Summary
      const status = report.summary.status;
      const statusEmoji =
        status === 'healthy'
          ? '✅'
          : status === 'warning'
            ? '⚠️'
            : status === 'critical'
              ? '❌'
              : '🔄';

      await this.log(`${statusEmoji} Coverage monitoring completed - Status: ${status}`, 'INFO');
      await this.log(`Report saved: ${reportPath}`, 'INFO');

      return report;
    } catch (error) {
      await this.log(`Coverage monitoring failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const monitor = new CoverageMonitor();

  try {
    const report = await monitor.monitor();

    // Output summary to console
    console.log('\n=== Coverage Monitoring Summary ===');
    console.log(`Status: ${report.summary.status.toUpperCase()}`);
    console.log(`Coverage Above Threshold: ${report.summary.coverageAboveThreshold ? '✅' : '❌'}`);
    console.log(`Alerts: ${report.summary.totalAlerts}`);
    console.log(`Stability Issues: ${report.summary.totalStabilityIssues}`);
    console.log('\nCoverage Metrics:');
    Object.keys(report.coverage).forEach((metric) => {
      if (typeof report.coverage[metric] === 'number') {
        const value = report.coverage[metric].toFixed(2);
        const threshold = report.thresholds[metric];
        const status = report.coverage[metric] >= threshold ? '✅' : '❌';
        console.log(`  ${metric}: ${value}% ${status}`);
      }
    });

    process.exit(report.summary.status === 'healthy' ? 0 : 1);
  } catch (error) {
    console.error('Coverage monitoring failed:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = CoverageMonitor;

// Run CLI if called directly
if (require.main === module) {
  main();
}
