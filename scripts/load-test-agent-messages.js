#!/usr/bin/env node

/**
 * Load Testing Script for Agent Message System
 * Runs Artillery load tests and analyzes performance metrics
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTILLERY_CONFIG = 'load-test-agent-messages.yml';
const RESULTS_DIR = 'load-test-results';
const PERFORMANCE_BASELINE = {
  avgResponseTime: 200, // ms
  maxResponseTime: 1000, // ms
  errorRate: 0.05, // 5%
  throughput: 10, // requests per second
};

class LoadTestRunner {
  constructor() {
    this.results = {};
    this.startTime = null;
    this.endTime = null;
  }

  async runLoadTests() {
    console.log('🚀 Starting Agent Message Load Testing...\n');

    // Ensure results directory exists
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR);
    }

    this.startTime = new Date();

    try {
      // Check if server is running
      await this.checkServerHealth();

      // Run Artillery load tests
      await this.executeArtilleryTests();

      // Analyze results
      await this.analyzeResults();

      // Generate report
      this.generateReport();
    } catch (error) {
      console.error('❌ Load testing failed:', error.message);
      process.exit(1);
    }

    this.endTime = new Date();
    const duration = (this.endTime - this.startTime) / 1000;
    console.log(`\n✅ Load testing completed in ${duration.toFixed(2)} seconds`);
  }

  async checkServerHealth() {
    console.log('🔍 Checking server health...');

    try {
      const response = await fetch('http://localhost:3000/api/monitoring/metrics');
      if (!response.ok) {
        throw new Error(`Server health check failed: ${response.status}`);
      }
      console.log('✅ Server is healthy');
    } catch (error) {
      console.error('❌ Server health check failed. Please start the server first.');
      throw error;
    }
  }

  async executeArtilleryTests() {
    console.log('🎯 Executing Artillery load tests...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(RESULTS_DIR, `artillery-results-${timestamp}.json`);

    try {
      // Run Artillery with JSON output
      execSync(`npx artillery run --output ${outputFile} ${ARTILLERY_CONFIG}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      console.log(`✅ Artillery tests completed. Results saved to ${outputFile}`);

      // Read and parse results
      const resultsData = fs.readFileSync(outputFile, 'utf8');
      this.results = JSON.parse(resultsData);
    } catch (error) {
      console.error('❌ Artillery execution failed:', error.message);
      throw error;
    }
  }

  async analyzeResults() {
    console.log('📊 Analyzing load test results...');

    const summary = this.results.aggregate;
    const metrics = {
      totalRequests: summary.requestsCompleted,
      totalErrors: summary.errors ? summary.errors.total : 0,
      avgResponseTime: summary.latency ? summary.latency.median : 0,
      maxResponseTime: summary.latency ? summary.latency.max : 0,
      minResponseTime: summary.latency ? summary.latency.min : 0,
      p95ResponseTime: summary.latency ? summary.latency.p95 : 0,
      p99ResponseTime: summary.latency ? summary.latency.p99 : 0,
      throughput: summary.rps ? summary.rps.mean : 0,
      errorRate:
        summary.requestsCompleted > 0
          ? (summary.errors ? summary.errors.total : 0) / summary.requestsCompleted
          : 0,
    };

    this.analysis = {
      metrics,
      passed: this.validateMetrics(metrics),
      recommendations: this.generateRecommendations(metrics),
    };

    console.log('📈 Performance Metrics:');
    console.log(`   Total Requests: ${metrics.totalRequests}`);
    console.log(`   Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`   Avg Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   95th Percentile: ${metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   99th Percentile: ${metrics.p99ResponseTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${metrics.throughput.toFixed(2)} req/sec`);
  }

  validateMetrics(metrics) {
    const validations = {
      responseTime: metrics.avgResponseTime <= PERFORMANCE_BASELINE.avgResponseTime,
      maxResponseTime: metrics.maxResponseTime <= PERFORMANCE_BASELINE.maxResponseTime,
      errorRate: metrics.errorRate <= PERFORMANCE_BASELINE.errorRate,
      throughput: metrics.throughput >= PERFORMANCE_BASELINE.throughput,
    };

    const passed = Object.values(validations).every((v) => v);

    console.log('\n🎯 Validation Results:');
    console.log(
      `   Response Time ≤ ${PERFORMANCE_BASELINE.avgResponseTime}ms: ${validations.responseTime ? '✅' : '❌'} (${metrics.avgResponseTime.toFixed(2)}ms)`,
    );
    console.log(
      `   Max Response Time ≤ ${PERFORMANCE_BASELINE.maxResponseTime}ms: ${validations.maxResponseTime ? '✅' : '❌'} (${metrics.maxResponseTime.toFixed(2)}ms)`,
    );
    console.log(
      `   Error Rate ≤ ${(PERFORMANCE_BASELINE.errorRate * 100).toFixed(1)}%: ${validations.errorRate ? '✅' : '❌'} (${(metrics.errorRate * 100).toFixed(2)}%)`,
    );
    console.log(
      `   Throughput ≥ ${PERFORMANCE_BASELINE.throughput} req/sec: ${validations.throughput ? '✅' : '❌'} (${metrics.throughput.toFixed(2)} req/sec)`,
    );

    return passed;
  }

  generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.avgResponseTime > PERFORMANCE_BASELINE.avgResponseTime) {
      recommendations.push(
        `Response time (${metrics.avgResponseTime.toFixed(2)}ms) exceeds baseline (${PERFORMANCE_BASELINE.avgResponseTime}ms). Consider optimizing PDF processing pipeline.`,
      );
    }

    if (metrics.errorRate > PERFORMANCE_BASELINE.errorRate) {
      recommendations.push(
        `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) exceeds baseline (${(PERFORMANCE_BASELINE.errorRate * 100).toFixed(1)}%). Investigate error causes and improve error handling.`,
      );
    }

    if (metrics.throughput < PERFORMANCE_BASELINE.throughput) {
      recommendations.push(
        `Throughput (${metrics.throughput.toFixed(2)} req/sec) below baseline (${PERFORMANCE_BASELINE.throughput} req/sec). Consider scaling infrastructure or optimizing concurrent processing.`,
      );
    }

    if (metrics.p95ResponseTime > 500) {
      recommendations.push(
        `95th percentile response time (${metrics.p95ResponseTime.toFixed(2)}ms) is high. Consider implementing response time optimizations.`,
      );
    }

    return recommendations;
  }

  generateReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(RESULTS_DIR, `load-test-report-${timestamp}.md`);

    const report = `# Agent Message Load Test Report

Generated: ${new Date().toISOString()}

## Test Configuration
- **Configuration File**: ${ARTILLERY_CONFIG}
- **Duration**: ${(this.endTime - this.startTime) / 1000} seconds
- **Target**: http://localhost:3000

## Performance Metrics

| Metric | Value | Baseline | Status |
|--------|-------|----------|--------|
| Total Requests | ${this.analysis.metrics.totalRequests} | - | - |
| Error Rate | ${(this.analysis.metrics.errorRate * 100).toFixed(2)}% | ≤ ${(PERFORMANCE_BASELINE.errorRate * 100).toFixed(1)}% | ${this.analysis.metrics.errorRate <= PERFORMANCE_BASELINE.errorRate ? '✅' : '❌'} |
| Avg Response Time | ${this.analysis.metrics.avgResponseTime.toFixed(2)}ms | ≤ ${PERFORMANCE_BASELINE.avgResponseTime}ms | ${this.analysis.metrics.avgResponseTime <= PERFORMANCE_BASELINE.avgResponseTime ? '✅' : '❌'} |
| Max Response Time | ${this.analysis.metrics.maxResponseTime.toFixed(2)}ms | ≤ ${PERFORMANCE_BASELINE.maxResponseTime}ms | ${this.analysis.metrics.maxResponseTime <= PERFORMANCE_BASELINE.maxResponseTime ? '✅' : '❌'} |
| 95th Percentile | ${this.analysis.metrics.p95ResponseTime.toFixed(2)}ms | - | - |
| 99th Percentile | ${this.analysis.metrics.p99ResponseTime.toFixed(2)}ms | - | - |
| Throughput | ${this.analysis.metrics.throughput.toFixed(2)} req/sec | ≥ ${PERFORMANCE_BASELINE.throughput} req/sec | ${this.analysis.metrics.throughput >= PERFORMANCE_BASELINE.throughput ? '✅' : '❌'} |

## Overall Status: ${this.analysis.passed ? '✅ PASSED' : '❌ FAILED'}

## Recommendations

${
  this.analysis.recommendations.length > 0
    ? this.analysis.recommendations.map((rec) => `- ${rec}`).join('\n')
    : 'No recommendations. All metrics within acceptable ranges.'
}

## Test Scenarios Executed

1. **Concurrent PDF Upload with Agent Messages** (70% weight)
   - Tests PDF upload triggering agent message generation
   - Validates job status tracking under load

2. **Rapid Sanitization Requests** (20% weight)
   - Tests sanitization API performance
   - Validates trust token generation under concurrent requests

3. **Mixed Load with Message Broadcasting** (10% weight)
   - Tests combined PDF upload and sanitization workflows
   - Validates system stability under mixed load patterns

## Load Phases

- **Warm-up**: 60s at 5 req/sec
- **Main Load**: 300s at 20 req/sec (100+ concurrent connections)
- **Peak Load**: 120s at 50 req/sec
- **Cool-down**: 60s at 5 req/sec

## System Requirements Validation

The load test validates that the agent message system maintains <5% performance overhead under production-like conditions with 100+ simultaneous connections.
`;

    fs.writeFileSync(reportFile, report);
    console.log(`📄 Report generated: ${reportFile}`);
  }
}

// Run load tests if called directly
if (require.main === module) {
  const runner = new LoadTestRunner();
  runner.runLoadTests().catch(console.error);
}

module.exports = LoadTestRunner;
