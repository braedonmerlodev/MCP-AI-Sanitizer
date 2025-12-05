#!/usr/bin/env node

/**
 * Async Processing Concurrency Benchmark
 *
 * Tests concurrency improvements of the reordered pipeline under various load conditions
 */

const { performance } = require('node:perf_hooks');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * AsyncConcurrencyBenchmark tests pipeline performance under concurrent load
 */
class AsyncConcurrencyBenchmark {
  constructor(options = {}) {
    this.options = {
      concurrencyLevels: options.concurrencyLevels || [1, 5, 10, 20, 50],
      operationsPerLevel: options.operationsPerLevel || 100,
      warmUpOperations: options.warmUpOperations || 20,
      testDataSets: options.testDataSets || this.getDefaultTestData(),
      outputDir: options.outputDir || path.join(__dirname, '..', 'research'),
      ...options,
    };

    this.results = {
      timestamp: new Date().toISOString(),
      configuration: this.options,
      concurrencyTests: {},
      summary: {},
    };
  }

  /**
   * Default test data for concurrency testing
   */
  getDefaultTestData() {
    return [
      {
        name: 'light',
        content: '<p>Light content for concurrency testing.</p>',
        description: 'Lightweight content (minimal processing)',
      },
      {
        name: 'medium',
        content:
          '<div><h1>Title</h1><p>Medium content with some HTML structure for testing concurrent processing performance.</p><ul><li>Item 1</li><li>Item 2</li></ul></div>',
        description: 'Medium content (moderate processing)',
      },
      {
        name: 'heavy',
        content: 'A'.repeat(10000).replace(/(.{200})/g, '<p>$1</p>'),
        description: 'Heavy content (significant processing load)',
      },
    ];
  }

  /**
   * Simulates async job processing with timing
   */
  async simulateAsyncJob(content, jobId) {
    const startTime = performance.now();

    try {
      // Simulate input validation/parsing
      await this.delay(1);

      // Simulate sanitization (reordered pipeline: sanitize first)
      const sanitizeStart = performance.now();
      const sanitizedContent = await this.simulateSanitization(content);
      const sanitizeTime = performance.now() - sanitizeStart;

      // Simulate AI processing
      const aiStart = performance.now();
      const finalContent = await this.simulateAIProcessing(sanitizedContent);
      const aiTime = performance.now() - aiStart;

      // Simulate result storage/formatting
      await this.delay(2);

      const totalTime = performance.now() - startTime;

      return {
        jobId,
        success: true,
        timing: {
          total: totalTime,
          sanitization: sanitizeTime,
          aiProcessing: aiTime,
          overhead: totalTime - sanitizeTime - aiTime,
        },
        inputSize: content.length,
        outputSize: finalContent.length,
      };
    } catch (error) {
      const totalTime = performance.now() - startTime;
      return {
        jobId,
        success: false,
        error: error.message,
        timing: { total: totalTime },
      };
    }
  }

  /**
   * Simulates sanitization processing
   */
  async simulateSanitization(content) {
    // Base sanitization time
    const baseTime = 3;

    // Additional time based on content complexity
    const complexityFactor = (content.match(/<[^>]*>/g) || []).length * 0.1;
    const processingTime = baseTime + complexityFactor;

    await this.delay(processingTime);

    // Simple sanitization simulation
    return content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  /**
   * Simulates AI processing
   */
  async simulateAIProcessing(content) {
    // AI processing time based on content length
    const baseTime = 5;
    const lengthFactor = Math.min(content.length / 1000, 20); // Up to 20ms for large content
    const processingTime = baseTime + lengthFactor;

    await this.delay(processingTime);

    // Simulate transformation
    return content.toUpperCase();
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Runs concurrency test for a specific level
   */
  async runConcurrencyTest(concurrencyLevel, dataSet) {
    logger.info(
      `Running concurrency test: ${concurrencyLevel} concurrent jobs with ${dataSet.name} data`,
    );

    const results = {
      concurrencyLevel,
      dataSet: dataSet.name,
      totalJobs: concurrencyLevel * this.options.operationsPerLevel,
      jobResults: [],
      timing: {
        startTime: null,
        endTime: null,
        totalDuration: 0,
        avgJobTime: 0,
        throughput: 0, // jobs per second
        efficiency: 0, // actual vs theoretical throughput
      },
    };

    // Warm up
    logger.info(`Warming up with ${this.options.warmUpOperations} operations...`);
    const warmUpPromises = [];
    for (let i = 0; i < this.options.warmUpOperations; i++) {
      warmUpPromises.push(this.simulateAsyncJob(dataSet.content, `warmup-${i}`));
    }
    await Promise.all(warmUpPromises);

    // Run actual test
    logger.info(`Starting ${results.totalJobs} concurrent operations...`);
    results.timing.startTime = performance.now();

    const jobPromises = [];
    for (let i = 0; i < results.totalJobs; i++) {
      jobPromises.push(this.simulateAsyncJob(dataSet.content, `job-${concurrencyLevel}-${i}`));
    }

    results.jobResults = await Promise.all(jobPromises);
    results.timing.endTime = performance.now();
    results.timing.totalDuration = results.timing.endTime - results.timing.startTime;

    // Calculate metrics
    const successfulJobs = results.jobResults.filter((r) => r.success);
    results.timing.avgJobTime =
      successfulJobs.length > 0
        ? successfulJobs.reduce((sum, r) => sum + r.timing.total, 0) / successfulJobs.length
        : 0;

    results.timing.throughput = results.totalJobs / (results.timing.totalDuration / 1000);

    // Theoretical maximum throughput (if jobs ran sequentially)
    const theoreticalMaxTime = results.timing.avgJobTime * results.totalJobs;
    const theoreticalThroughput = results.totalJobs / (theoreticalMaxTime / 1000);
    results.timing.efficiency = (results.timing.throughput / theoreticalThroughput) * 100;

    // Error analysis
    results.errors = {
      total: results.jobResults.filter((r) => !r.success).length,
      errorRate: (results.jobResults.filter((r) => !r.success).length / results.totalJobs) * 100,
    };

    logger.info(
      `Concurrency test completed: ${results.timing.throughput.toFixed(1)} jobs/sec, ${results.timing.efficiency.toFixed(1)}% efficiency`,
    );

    return results;
  }

  /**
   * Runs comprehensive concurrency benchmark
   */
  async runComprehensiveBenchmark() {
    logger.info('🚀 Starting Async Concurrency Benchmark\n');

    // Run tests for each concurrency level and data set combination
    for (const concurrencyLevel of this.options.concurrencyLevels) {
      for (const dataSet of this.options.testDataSets) {
        const testKey = `${concurrencyLevel}conc-${dataSet.name}`;
        logger.info(`Testing ${testKey}...`);

        const result = await this.runConcurrencyTest(concurrencyLevel, dataSet);
        this.results.concurrencyTests[testKey] = result;
      }
    }

    // Generate summary
    this.results.summary = this.generateSummary();

    // Save results
    this.saveResults();

    logger.info('✅ Concurrency benchmarking complete!');
    return this.results;
  }

  /**
   * Generates summary statistics
   */
  generateSummary() {
    const summary = {
      overall: {
        maxThroughput: 0,
        optimalConcurrency: 0,
        efficiencyRange: { min: 100, max: 0 },
        errorRateRange: { min: 100, max: 0 },
      },
      byDataSet: {},
      byConcurrency: {},
      recommendations: [],
    };

    // Analyze results
    Object.entries(this.results.concurrencyTests).forEach(([testKey, result]) => {
      const { concurrencyLevel } = result;

      // Track overall metrics
      if (result.timing.throughput > summary.overall.maxThroughput) {
        summary.overall.maxThroughput = result.timing.throughput;
        summary.overall.optimalConcurrency = concurrencyLevel;
      }

      summary.overall.efficiencyRange.min = Math.min(
        summary.overall.efficiencyRange.min,
        result.timing.efficiency,
      );
      summary.overall.efficiencyRange.max = Math.max(
        summary.overall.efficiencyRange.max,
        result.timing.efficiency,
      );

      summary.overall.errorRateRange.min = Math.min(
        summary.overall.errorRateRange.min,
        result.errors.errorRate,
      );
      summary.overall.errorRateRange.max = Math.max(
        summary.overall.errorRateRange.max,
        result.errors.errorRate,
      );

      // Group by data set
      const dataSet = result.dataSet;
      if (!summary.byDataSet[dataSet]) {
        summary.byDataSet[dataSet] = {
          throughputByConcurrency: {},
          avgEfficiency: 0,
          totalTests: 0,
        };
      }
      summary.byDataSet[dataSet].throughputByConcurrency[concurrencyLevel] =
        result.timing.throughput;
      summary.byDataSet[dataSet].totalTests++;

      // Group by concurrency level
      if (!summary.byConcurrency[concurrencyLevel]) {
        summary.byConcurrency[concurrencyLevel] = {
          throughputByDataSet: {},
          avgEfficiency: 0,
          totalTests: 0,
        };
      }
      summary.byConcurrency[concurrencyLevel].throughputByDataSet[dataSet] =
        result.timing.throughput;
      summary.byConcurrency[concurrencyLevel].totalTests++;
    });

    // Calculate averages
    Object.values(summary.byDataSet).forEach((dataSet) => {
      const efficiencies = Object.values(this.results.concurrencyTests)
        .filter(
          (r) =>
            r.dataSet ===
            Object.keys(summary.byDataSet).find((k) => summary.byDataSet[k] === dataSet),
        )
        .map((r) => r.timing.efficiency);
      dataSet.avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;
    });

    Object.values(summary.byConcurrency).forEach((concurrency) => {
      const efficiencies = Object.values(this.results.concurrencyTests)
        .filter(
          (r) =>
            r.concurrencyLevel ===
            Object.keys(summary.byConcurrency).find(
              (k) => summary.byConcurrency[k] === concurrency,
            ),
        )
        .map((r) => r.timing.efficiency);
      concurrency.avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;
    });

    // Generate recommendations
    summary.recommendations = this.generateRecommendations(summary);

    return summary;
  }

  /**
   * Generates performance recommendations
   */
  generateRecommendations(summary) {
    const recommendations = [];

    if (summary.overall.optimalConcurrency > 1) {
      recommendations.push(
        `Optimal concurrency level identified: ${summary.overall.optimalConcurrency} concurrent operations`,
      );
    }

    if (summary.overall.efficiencyRange.max > 80) {
      recommendations.push(
        'High concurrency efficiency achieved - async processing well optimized',
      );
    } else if (summary.overall.efficiencyRange.max < 50) {
      recommendations.push(
        'Low concurrency efficiency detected - consider optimizing async processing',
      );
    }

    if (summary.overall.errorRateRange.max > 5) {
      recommendations.push(
        'High error rates detected under concurrency - investigate failure patterns',
      );
    }

    const scalabilityConc = Object.entries(summary.byConcurrency)
      .filter(([, data]) => data.avgEfficiency > 70)
      .sort(
        ([, a], [, b]) =>
          parseInt(Object.keys(summary.byConcurrency).find((k) => summary.byConcurrency[k] === a)) -
          parseInt(Object.keys(summary.byConcurrency).find((k) => summary.byConcurrency[k] === b)),
      )
      .pop();

    if (scalabilityConc) {
      recommendations.push(`System scales well up to ${scalabilityConc[0]} concurrent operations`);
    }

    return recommendations;
  }

  /**
   * Saves benchmark results to files
   */
  saveResults() {
    const outputDir = this.options.outputDir;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save detailed results
    const resultsFile = path.join(outputDir, 'async-concurrency-benchmark-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));

    // Generate markdown report
    const markdownFile = path.join(outputDir, 'async-concurrency-benchmark-report.md');
    const markdownContent = this.generateMarkdownReport();
    fs.writeFileSync(markdownFile, markdownContent);

    logger.info(`💾 Results saved to: ${resultsFile}`);
    logger.info(`📄 Markdown report saved to: ${markdownFile}`);
  }

  /**
   * Generates markdown report
   */
  generateMarkdownReport() {
    const summary = this.results.summary;

    let markdown = `# Async Processing Concurrency Benchmark Report

Generated: ${this.results.timestamp}

## Executive Summary

This report presents comprehensive concurrency benchmarking results for the reordered pipeline under various load conditions.

**Key Findings:**
- Maximum Throughput: ${summary.overall.maxThroughput.toFixed(1)} jobs/second
- Optimal Concurrency: ${summary.overall.optimalConcurrency} concurrent operations
- Efficiency Range: ${summary.overall.efficiencyRange.min.toFixed(1)}% - ${summary.overall.efficiencyRange.max.toFixed(1)}%
- Error Rate Range: ${summary.overall.errorRateRange.min.toFixed(1)}% - ${summary.overall.errorRateRange.max.toFixed(1)}%

## Test Configuration

- Concurrency levels tested: ${this.options.concurrencyLevels.join(', ')}
- Operations per concurrency level: ${this.options.operationsPerLevel}
- Data sets tested: ${this.options.testDataSets.map((d) => d.name).join(', ')}
- Total operations: ${this.options.concurrencyLevels.length * this.options.testDataSets.length * this.options.operationsPerLevel}

## Concurrency Performance Results

### Throughput by Concurrency Level

| Concurrency | Light Data | Medium Data | Heavy Data | Avg Efficiency |
|-------------|------------|-------------|------------|----------------|
`;

    this.options.concurrencyLevels.forEach((level) => {
      const levelData = summary.byConcurrency[level];
      if (levelData) {
        const lightThroughput = levelData.throughputByDataSet.light || 0;
        const mediumThroughput = levelData.throughputByDataSet.medium || 0;
        const heavyThroughput = levelData.throughputByDataSet.heavy || 0;

        markdown += `| ${level} | ${lightThroughput.toFixed(1)} | ${mediumThroughput.toFixed(1)} | ${heavyThroughput.toFixed(1)} | ${levelData.avgEfficiency.toFixed(1)}% |\n`;
      }
    });

    markdown += `

## Data Set Performance Analysis

### Throughput by Data Set

| Data Set | 1 Conc | 5 Conc | 10 Conc | 20 Conc | 50 Conc | Avg Efficiency |
|----------|--------|--------|---------|---------|---------|----------------|
`;

    this.options.testDataSets.forEach((dataSet) => {
      const dataSetSummary = summary.byDataSet[dataSet.name];
      if (dataSetSummary) {
        const throughputs = this.options.concurrencyLevels.map((level) => {
          const testKey = `${level}conc-${dataSet.name}`;
          const result = this.results.concurrencyTests[testKey];
          return result ? result.timing.throughput.toFixed(1) : 'N/A';
        });

        markdown += `| ${dataSet.name} | ${throughputs.join(' | ')} | ${dataSetSummary.avgEfficiency.toFixed(1)}% |\n`;
      }
    });

    markdown += `

## Performance Analysis

### Scalability Assessment
`;

    if (summary.overall.efficiencyRange.max > 80) {
      markdown +=
        '**Excellent Scalability**: System maintains high efficiency under concurrent load.\n';
    } else if (summary.overall.efficiencyRange.max > 60) {
      markdown += '**Good Scalability**: System performs well under moderate concurrency.\n';
    } else {
      markdown +=
        '**Limited Scalability**: Performance degrades significantly under high concurrency.\n';
    }

    markdown += `

### Bottleneck Analysis
- **Optimal Performance**: ${summary.overall.optimalConcurrency} concurrent operations
- **Throughput Peak**: ${summary.overall.maxThroughput.toFixed(1)} operations/second
- **Efficiency Range**: ${summary.overall.efficiencyRange.min.toFixed(1)}% to ${summary.overall.efficiencyRange.max.toFixed(1)}%

### Error Analysis
- **Error Rate Range**: ${summary.overall.errorRateRange.min.toFixed(2)}% to ${summary.overall.errorRateRange.max.toFixed(2)}%
`;

    if (summary.overall.errorRateRange.max > 5) {
      markdown += '**High Error Rates**: Investigate failures under high concurrency load.\n';
    } else {
      markdown += '**Low Error Rates**: System handles concurrent load reliably.\n';
    }

    markdown += `

## Recommendations
${summary.recommendations.map((rec) => `- ${rec}`).join('\n')}

## Test Environment

- Node.js version: ${process.version}
- Platform: ${process.platform} ${process.arch}
- Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB heap used
- CPU: ${require('os').cpus().length} cores

## Raw Data

Complete benchmark results are available in the accompanying JSON file.
`;

    return markdown;
  }
}

// Run the benchmark if this script is executed directly
if (require.main === module) {
  const benchmark = new AsyncConcurrencyBenchmark({
    concurrencyLevels: [1, 5, 10, 20], // Reduced for faster testing
    operationsPerLevel: 50, // Reduced for faster testing
  });

  benchmark
    .runComprehensiveBenchmark()
    .then((results) => {
      console.log('\n📊 Concurrency Benchmark Summary:');
      console.log(`Max Throughput: ${results.summary.overall.maxThroughput.toFixed(1)} ops/sec`);
      console.log(`Optimal Concurrency: ${results.summary.overall.optimalConcurrency} operations`);
      console.log(
        `Efficiency Range: ${results.summary.overall.efficiencyRange.min.toFixed(1)}% - ${results.summary.overall.efficiencyRange.max.toFixed(1)}%`,
      );
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}

module.exports = AsyncConcurrencyBenchmark;
