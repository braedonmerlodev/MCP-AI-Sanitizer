/**
 * TokenGenerationBenchmark provides comprehensive performance benchmarking
 * for trust token generation with statistical analysis and SLA compliance tracking.
 */
class TokenGenerationBenchmark {
  constructor(options = {}) {
    this.generator = options.generator;
    if (!this.generator) {
      throw new Error('TrustTokenGenerator instance is required');
    }

    this.config = {
      warmUpIterations: 100,
      measurementIterations: 1000,
      concurrencyLevels: [1, 5, 10, 20],
      inputDataSets: this.generateDefaultTestDataSets(),
      confidenceLevel: 0.95,
      ...options.config,
    };

    this.baseline = null;
  }

  /**
   * Generates default test data sets for benchmarking
   * @returns {Array} Array of test data objects
   */
  generateDefaultTestDataSets() {
    return [
      {
        name: 'small',
        sanitizedContent: 'A'.repeat(100),
        originalContent: 'A'.repeat(100),
        rulesApplied: ['basic-sanitization'],
      },
      {
        name: 'medium',
        sanitizedContent: 'B'.repeat(10 * 1024),
        originalContent: 'B'.repeat(10 * 1024),
        rulesApplied: ['unicode-normalization', 'symbol-stripping'],
      },
      {
        name: 'large',
        sanitizedContent: 'C'.repeat(1024 * 1024),
        originalContent: 'C'.repeat(1024 * 1024),
        rulesApplied: ['pattern-redaction', 'escape-neutralization'],
      },
      {
        name: 'empty',
        sanitizedContent: '',
        originalContent: '',
        rulesApplied: [],
      },
      {
        name: 'unicode',
        sanitizedContent: 'Hello 世界 🌍 Test',
        originalContent: 'Hello 世界 🌍 Test',
        rulesApplied: ['unicode-normalization'],
      },
    ];
  }

  /**
   * Measures execution time with high precision
   * @param {Function} fn - Function to measure
   * @returns {bigint} Execution time in nanoseconds
   */
  measureExecutionTime(fn) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    return end - start;
  }

  /**
   * Runs a single token generation benchmark
   * @param {Object} dataSet - Test data set
   * @returns {number} Execution time in milliseconds
   */
  runSingleBenchmark(dataSet) {
    const { sanitizedContent, originalContent, rulesApplied } = dataSet;

    const executionTimeNs = this.measureExecutionTime(() => {
      this.generator.generateToken(sanitizedContent, originalContent, rulesApplied);
    });

    return Number(executionTimeNs) / 1_000_000; // Convert to milliseconds
  }

  /**
   * Runs benchmarks for a specific concurrency level
   * @param {number} concurrency - Number of concurrent operations
   * @param {Object} dataSet - Test data set
   * @param {number} iterations - Number of iterations
   * @returns {Array<number>} Array of execution times in milliseconds
   */
  async runConcurrencyBenchmark(concurrency, dataSet, iterations) {
    const results = [];

    for (let i = 0; i < iterations; i += concurrency) {
      const promises = [];
      const batchSize = Math.min(concurrency, iterations - i);

      for (let j = 0; j < batchSize; j++) {
        promises.push(this.runSingleBenchmark(dataSet));
      }

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results.slice(0, iterations);
  }

  /**
   * Calculates statistical metrics from timing data
   * @param {Array<number>} times - Array of execution times
   * @returns {Object} Statistical analysis results
   */
  calculateStatistics(times) {
    if (times.length === 0) return {};

    const sorted = [...times].toSorted((a, b) => a - b);
    const n = sorted.length;

    // Basic statistics
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = sorted.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Percentiles
    const p50 = this.calculatePercentile(sorted, 50);
    const p95 = this.calculatePercentile(sorted, 95);
    const p99 = this.calculatePercentile(sorted, 99);
    const p999 = this.calculatePercentile(sorted, 99.9);

    // Confidence interval (95% by default)
    const confidenceLevel = this.config.confidenceLevel;
    const zScore = this.getZScore(confidenceLevel);
    const marginOfError = zScore * (stdDev / Math.sqrt(n));
    const confidenceInterval = marginOfError;

    return {
      count: n,
      mean,
      median: p50,
      stdDev,
      variance,
      min: sorted[0],
      max: sorted.at(-1),
      p50,
      p95,
      p99,
      p999,
      confidenceInterval,
      confidenceLevel,
    };
  }

  /**
   * Calculates percentile from sorted array
   * @param {Array<number>} sorted - Sorted array of values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(sorted, percentile) {
    if (sorted.length === 0) return 0;
    if (percentile <= 0) return sorted[0];
    if (percentile >= 100) return sorted.at(-1);

    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sorted.length) return sorted.at(-1);

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Gets Z-score for confidence level
   * @param {number} confidenceLevel - Confidence level (0-1)
   * @returns {number} Z-score
   */
  getZScore(confidenceLevel) {
    // Approximation for common confidence levels
    const zScores = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };
    return zScores[confidenceLevel] || 1.96; // Default to 95%
  }

  /**
   * Calculates SLA compliance percentage
   * @param {Array<number>} times - Array of execution times
   * @param {number} targetMs - Target time in milliseconds
   * @returns {number} SLA compliance percentage (0-100)
   */
  calculateSLACompliance(times, targetMs = 200) {
    const underTarget = times.filter((time) => time <= targetMs).length;
    return (underTarget / times.length) * 100;
  }

  /**
   * Performs warm-up iterations to stabilize performance
   * @param {Object} dataSet - Test data set for warm-up
   */
  async performWarmUp(dataSet) {
    console.log(`Performing ${this.config.warmUpIterations} warm-up iterations...`);
    for (let i = 0; i < this.config.warmUpIterations; i++) {
      await this.runSingleBenchmark(dataSet);
    }
    console.log('Warm-up completed.');
  }

  /**
   * Runs comprehensive performance tests across all scenarios
   * @returns {Object} Comprehensive test results
   */
  async runComprehensiveTests() {
    const results = {
      timestamp: new Date().toISOString(),
      scenarios: [],
      summary: {},
    };

    // Use the first data set for warm-up
    const warmUpDataSet = this.config.inputDataSets[0];
    await this.performWarmUp(warmUpDataSet);

    // Run tests for each data set and concurrency level
    for (const dataSet of this.config.inputDataSets) {
      console.log(`Testing data set: ${dataSet.name}`);

      for (const concurrency of this.config.concurrencyLevels) {
        console.log(`  Concurrency level: ${concurrency}`);

        const times = await this.runConcurrencyBenchmark(
          concurrency,
          dataSet,
          this.config.measurementIterations,
        );

        const statistics = this.calculateStatistics(times);
        const slaCompliance = this.calculateSLACompliance(times);

        const scenario = {
          dataSet: dataSet.name,
          concurrency,
          iterations: this.config.measurementIterations,
          statistics,
          slaCompliance,
          rawTimes: times, // Keep for further analysis
        };

        results.scenarios.push(scenario);
      }
    }

    // Calculate overall summary
    results.summary = this.calculateOverallSummary(results.scenarios);

    return results;
  }

  /**
   * Calculates overall summary from all scenarios
   * @param {Array} scenarios - Array of scenario results
   * @returns {Object} Overall summary
   */
  calculateOverallSummary(scenarios) {
    const allTimes = scenarios.flatMap((s) => s.rawTimes);
    const overallStats = this.calculateStatistics(allTimes);
    const overallSLA = this.calculateSLACompliance(allTimes);

    // Find worst-case scenarios
    const worstP95 = Math.max(...scenarios.map((s) => s.statistics.p95));
    const worstSLA = Math.min(...scenarios.map((s) => s.slaCompliance));

    return {
      totalScenarios: scenarios.length,
      totalMeasurements: allTimes.length,
      overall: {
        statistics: overallStats,
        slaCompliance: overallSLA,
      },
      worstCase: {
        p95: worstP95,
        slaCompliance: worstSLA,
      },
    };
  }

  /**
   * Analyzes results with baseline comparison and regression detection
   * @param {Object} results - Test results from runComprehensiveTests
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results
   */
  analyzeResults(results, options = {}) {
    const analysis = {
      timestamp: new Date().toISOString(),
      summary: results.summary,
      regressionDetected: false,
      baselineComparison: null,
      recommendations: [],
    };

    // Baseline comparison
    if (options.baselineComparison && this.baseline) {
      analysis.baselineComparison = this.compareWithBaseline(results, this.baseline);
      analysis.regressionDetected = this.detectRegression(analysis.baselineComparison);
    }

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(results, analysis);

    return analysis;
  }

  /**
   * Compares current results with baseline
   * @param {Object} current - Current test results
   * @param {Object} baseline - Baseline results
   * @returns {Object} Comparison results
   */
  compareWithBaseline(current, baseline) {
    const comparison = {
      meanChange:
        ((current.summary.overall.statistics.mean - baseline.summary.overall.statistics.mean) /
          baseline.summary.overall.statistics.mean) *
        100,
      p95Change:
        ((current.summary.overall.statistics.p95 - baseline.summary.overall.statistics.p95) /
          baseline.summary.overall.statistics.p95) *
        100,
      slaChange: current.summary.overall.slaCompliance - baseline.summary.overall.slaCompliance,
    };

    return comparison;
  }

  /**
   * Detects performance regression based on comparison
   * @param {Object} comparison - Comparison results
   * @returns {boolean} True if regression detected
   */
  detectRegression(comparison) {
    // Simple regression detection: >10% increase in p95 or >5% drop in SLA
    return comparison.p95Change > 10 || comparison.slaChange < -5;
  }

  /**
   * Generates recommendations based on results
   * @param {Object} results - Test results
   * @param {Object} analysis - Analysis results
   * @returns {Array<string>} Array of recommendations
   */
  generateRecommendations(results, analysis) {
    const recommendations = [];

    if (results.summary.overall.statistics.mean > 100) {
      recommendations.push('Average response time exceeds 100ms target. Consider optimization.');
    }

    if (results.summary.overall.slaCompliance < 95) {
      recommendations.push('SLA compliance below 95%. Investigate high-percentile performance.');
    }

    if (analysis.regressionDetected) {
      recommendations.push('Performance regression detected. Review recent changes.');
    }

    if (results.summary.worstCase.p95 > 200) {
      recommendations.push('Worst-case P95 exceeds 200ms. Focus on outlier performance.');
    }

    return recommendations;
  }

  /**
   * Sets the performance baseline
   * @param {Object} results - Baseline test results
   */
  setBaseline(results) {
    this.baseline = results;
  }
}

module.exports = TokenGenerationBenchmark;
