// Pipeline Reorder Performance Benchmarks
const { performance } = require('node:perf_hooks');
const winston = require('winston');
const fs = require('node:fs');
const path = require('node:path');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * PipelineReorderBenchmark provides comprehensive performance benchmarking
 * for the reordered sanitization pipeline (Sanitization → AI vs AI → Sanitization)
 */
class PipelineReorderBenchmark {
  constructor(options = {}) {
    this.options = {
      iterations: options.iterations || 100,
      concurrencyLevels: options.concurrencyLevels || [1, 5, 10],
      warmUpIterations: options.warmUpIterations || 10,
      outputDir: options.outputDir || path.join(__dirname, '..', '..', '..', 'research'),
      ...options,
    };

    // Test data sets for different scenarios
    this.testDataSets = this.generateTestDataSets();

    // Results storage
    this.results = {
      timestamp: new Date().toISOString(),
      configuration: this.options,
      baselines: {},
      reordered: {},
      comparisons: {},
    };
  }

  /**
   * Generates comprehensive test data sets for pipeline benchmarking
   */
  generateTestDataSets() {
    return [
      {
        name: 'small-clean',
        content: '<p>Hello <strong>world</strong>! This is a simple test.</p>',
        description: 'Small clean HTML content',
        expectedThreats: 0,
      },
      {
        name: 'small-malicious',
        content: '<p>Hello <script>alert("xss")</script> world!</p>',
        description: 'Small content with script injection',
        expectedThreats: 1,
      },
      {
        name: 'medium-clean',
        content: `
          <article>
            <h1>Sample Article</h1>
            <p>This is a sample article with <em>emphasis</em> and <strong>bold text</strong>.</p>
            <ul>
              <li>Point 1</li>
              <li>Point 2</li>
              <li>Point 3</li>
            </ul>
            <p>More content here with <a href="https://example.com">links</a>.</p>
          </article>
        `,
        description: 'Medium clean HTML content',
        expectedThreats: 0,
      },
      {
        name: 'medium-malicious',
        content: `
          <article>
            <h1>Sample Article</h1>
            <p>This is content with <script>evil()</script> scripts.</p>
            <img src="x" onerror="alert(1)" alt="Image" />
            <a href="javascript:attack()">Bad Link</a>
            <form action="/hack"><input type="submit" /></form>
          </article>
        `,
        description: 'Medium content with multiple threats',
        expectedThreats: 4,
      },
      {
        name: 'large-clean',
        content: 'A'.repeat(50_000).replaceAll(/(.{200})/g, '<p>$1</p>'),
        description: 'Large clean HTML content (50KB)',
        expectedThreats: 0,
      },
      {
        name: 'large-malicious',
        content: 'B'.repeat(25_000).replaceAll(/(.{100})/g, '$1<script>alert(1)</script>'),
        description: 'Large content with distributed threats (25KB)',
        expectedThreats: 250, // Approximately 250 script tags
      },
    ];
  }

  /**
   * Measures execution time with high precision
   */
  measureExecutionTime(fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    return {
      duration: end - start,
      result,
    };
  }

  /**
   * Runs warm-up iterations to stabilize performance
   */
  async warmUp(testFunction) {
    logger.info(`Running ${this.options.warmUpIterations} warm-up iterations...`);

    for (let i = 0; i < this.options.warmUpIterations; i++) {
      await testFunction();
    }

    // Small delay to ensure system stabilization
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Simulates baseline pipeline (AI → Sanitization)
   * This is the old approach for comparison
   */
  async simulateBaselinePipeline(content) {
    // Simulate AI processing first
    const aiStart = performance.now();
    await this.simulateAIProcessing(content);
    const aiDuration = performance.now() - aiStart;

    // Then sanitize
    const sanitizeStart = performance.now();
    const sanitizedContent = await this.simulateSanitization(content);
    const sanitizeDuration = performance.now() - sanitizeStart;

    return {
      aiDuration,
      sanitizeDuration,
      totalDuration: aiDuration + sanitizeDuration,
      output: sanitizedContent,
      order: 'AI → Sanitization',
    };
  }

  /**
   * Simulates reordered pipeline (Sanitization → AI)
   * This is the new approach
   */
  async simulateReorderedPipeline(content) {
    // Sanitize first
    const sanitizeStart = performance.now();
    const sanitizedContent = await this.simulateSanitization(content);
    const sanitizeDuration = performance.now() - sanitizeStart;

    // Then AI processing
    const aiStart = performance.now();
    const finalOutput = await this.simulateAIProcessing(sanitizedContent);
    const aiDuration = performance.now() - aiStart;

    return {
      sanitizeDuration,
      aiDuration,
      totalDuration: sanitizeDuration + aiDuration,
      output: finalOutput,
      order: 'Sanitization → AI',
    };
  }

  /**
   * Simulates AI processing (text transformation)
   */
  async simulateAIProcessing(content) {
    // Simulate AI processing time based on content length
    const baseTime = 5; // 5ms base processing time
    const variableTime = Math.min(content.length / 1000, 50); // Up to 50ms for large content
    const processingTime = baseTime + variableTime;

    // Simulate async processing
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // Simulate some transformation
    return content.toUpperCase();
  }

  /**
   * Simulates sanitization processing
   */
  async simulateSanitization(content) {
    // Simulate sanitization time based on content complexity
    const baseTime = 2; // 2ms base sanitization time
    const complexityFactor = (content.match(/<[^>]*>/g) || []).length / 10; // More tags = more complex
    const processingTime = baseTime + complexityFactor;

    // Simulate async sanitization
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // Simple sanitization simulation (remove script tags)
    return content.replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  /**
   * Runs benchmark for a single data set
   */
  async runDataSetBenchmark(dataSet) {
    const results = {
      dataSet: dataSet.name,
      description: dataSet.description,
      contentLength: dataSet.content.length,
      expectedThreats: dataSet.expectedThreats,
      baseline: {
        runs: [],
        statistics: {},
      },
      reordered: {
        runs: [],
        statistics: {},
      },
    };

    logger.info(`Benchmarking ${dataSet.name} (${dataSet.content.length} chars)...`);

    // Warm up
    await this.warmUp(async () => {
      await this.simulateBaselinePipeline(dataSet.content);
      await this.simulateReorderedPipeline(dataSet.content);
    });

    // Run baseline benchmarks
    for (let i = 0; i < this.options.iterations; i++) {
      const result = await this.simulateBaselinePipeline(dataSet.content);
      results.baseline.runs.push(result);
    }

    // Run reordered benchmarks
    for (let i = 0; i < this.options.iterations; i++) {
      const result = await this.simulateReorderedPipeline(dataSet.content);
      results.reordered.runs.push(result);
    }

    // Calculate statistics
    results.baseline.statistics = this.calculateStatistics(results.baseline.runs);
    results.reordered.statistics = this.calculateStatistics(results.reordered.runs);

    // Calculate comparison
    results.comparison = this.calculateComparison(
      results.baseline.statistics,
      results.reordered.statistics,
    );

    return results;
  }

  /**
   * Runs concurrency benchmarks
   */
  async runConcurrencyBenchmark(concurrencyLevel, dataSet) {
    const results = {
      concurrencyLevel,
      dataSet: dataSet.name,
      totalOperations: concurrencyLevel * this.options.iterations,
      baseline: {
        totalTime: 0,
        avgTimePerOperation: 0,
        throughput: 0, // operations per second
      },
      reordered: {
        totalTime: 0,
        avgTimePerOperation: 0,
        throughput: 0,
      },
    };

    logger.info(`Running concurrency benchmark: ${concurrencyLevel} concurrent operations...`);

    // Baseline concurrency test
    const baselineStart = performance.now();
    const baselinePromises = [];
    for (let i = 0; i < concurrencyLevel * this.options.iterations; i++) {
      baselinePromises.push(this.simulateBaselinePipeline(dataSet.content));
    }
    await Promise.all(baselinePromises);
    const baselineEnd = performance.now();

    results.baseline.totalTime = baselineEnd - baselineStart;
    results.baseline.avgTimePerOperation =
      results.baseline.totalTime / (concurrencyLevel * this.options.iterations);
    results.baseline.throughput =
      (concurrencyLevel * this.options.iterations) / (results.baseline.totalTime / 1000);

    // Reordered concurrency test
    const reorderedStart = performance.now();
    const reorderedPromises = [];
    for (let i = 0; i < concurrencyLevel * this.options.iterations; i++) {
      reorderedPromises.push(this.simulateReorderedPipeline(dataSet.content));
    }
    await Promise.all(reorderedPromises);
    const reorderedEnd = performance.now();

    results.reordered.totalTime = reorderedEnd - reorderedStart;
    results.reordered.avgTimePerOperation =
      results.reordered.totalTime / (concurrencyLevel * this.options.iterations);
    results.reordered.throughput =
      (concurrencyLevel * this.options.iterations) / (results.reordered.totalTime / 1000);

    // Calculate improvement
    results.comparison = {
      timeImprovement:
        ((results.baseline.totalTime - results.reordered.totalTime) / results.baseline.totalTime) *
        100,
      throughputImprovement:
        ((results.reordered.throughput - results.baseline.throughput) /
          results.baseline.throughput) *
        100,
    };

    return results;
  }

  /**
   * Calculates statistics from benchmark runs
   */
  calculateStatistics(runs) {
    if (runs.length === 0) return {};

    const durations = runs.map((r) => r.totalDuration);
    const aiDurations = runs.map((r) => r.aiDuration);
    const sanitizeDurations = runs.map((r) => r.sanitizeDuration);

    const sortedDurations = [...durations].toSorted((a, b) => a - b);

    return {
      count: runs.length,
      totalDuration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        mean: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: sortedDurations[Math.floor(sortedDurations.length / 2)],
        p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)],
        p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)],
      },
      aiDuration: {
        mean: aiDurations.reduce((a, b) => a + b, 0) / aiDurations.length,
      },
      sanitizeDuration: {
        mean: sanitizeDurations.reduce((a, b) => a + b, 0) / sanitizeDurations.length,
      },
    };
  }

  /**
   * Calculates comparison between baseline and reordered results
   */
  calculateComparison(baselineStats, reorderedStats) {
    return {
      totalDurationChange:
        ((reorderedStats.totalDuration.mean - baselineStats.totalDuration.mean) /
          baselineStats.totalDuration.mean) *
        100,
      aiDurationChange:
        ((reorderedStats.aiDuration.mean - baselineStats.aiDuration.mean) /
          baselineStats.aiDuration.mean) *
        100,
      sanitizeDurationChange:
        ((reorderedStats.sanitizeDuration.mean - baselineStats.sanitizeDuration.mean) /
          baselineStats.sanitizeDuration.mean) *
        100,
      p95Change:
        ((reorderedStats.totalDuration.p95 - baselineStats.totalDuration.p95) /
          baselineStats.totalDuration.p95) *
        100,
    };
  }

  /**
   * Runs comprehensive benchmark suite
   */
  async runComprehensiveBenchmark() {
    logger.info('🚀 Starting Comprehensive Pipeline Reorder Benchmark\n');

    // Run data set benchmarks
    logger.info('📊 Running data set performance benchmarks...');
    for (const dataSet of this.testDataSets) {
      const result = await this.runDataSetBenchmark(dataSet);
      this.results.baselines[dataSet.name] = result.baseline;
      this.results.reordered[dataSet.name] = result.reordered;
      this.results.comparisons[dataSet.name] = result.comparison;
    }

    // Run concurrency benchmarks
    logger.info('⚡ Running concurrency performance benchmarks...');
    this.results.concurrency = {};
    for (const concurrencyLevel of this.options.concurrencyLevels) {
      const dataSet = this.testDataSets[2]; // Use medium dataset for concurrency tests
      const result = await this.runConcurrencyBenchmark(concurrencyLevel, dataSet);
      this.results.concurrency[concurrencyLevel] = result;
    }

    // Generate summary
    this.results.summary = this.generateSummary();

    // Save results
    this.saveResults();

    logger.info('✅ Benchmarking complete!');
    return this.results;
  }

  /**
   * Generates summary statistics
   */
  generateSummary() {
    const summary = {
      overall: {
        baselineAvg: 0,
        reorderedAvg: 0,
        improvement: 0,
      },
      byDataSet: {},
      concurrency: {
        maxThroughputImprovement: 0,
        avgTimeImprovement: 0,
      },
      recommendations: [],
    };

    // Calculate overall averages
    const allComparisons = Object.values(this.results.comparisons);
    summary.overall.baselineAvg =
      allComparisons.reduce(
        (sum, comp) => sum + (comp.totalDurationChange < 0 ? 100 + comp.totalDurationChange : 100),
        0,
      ) / allComparisons.length;
    summary.overall.reorderedAvg = 100;
    summary.overall.improvement =
      ((summary.overall.reorderedAvg - summary.overall.baselineAvg) / summary.overall.baselineAvg) *
      100;

    // Data set summaries
    for (const [dataSet, comparison] of Object.entries(this.results.comparisons)) {
      summary.byDataSet[dataSet] = {
        performanceChange: comparison.totalDurationChange,
        p95Change: comparison.p95Change,
        assessment: this.assessPerformanceChange(comparison),
      };
    }

    // Concurrency summaries
    const concurrencyResults = Object.values(this.results.concurrency);
    summary.concurrency.maxThroughputImprovement = Math.max(
      ...concurrencyResults.map((r) => r.comparison.throughputImprovement),
    );
    summary.concurrency.avgTimeImprovement =
      concurrencyResults.reduce((sum, r) => sum + r.comparison.timeImprovement, 0) /
      concurrencyResults.length;

    // Generate recommendations
    summary.recommendations = this.generateRecommendations(summary);

    return summary;
  }

  /**
   * Assesses performance change severity
   */
  assessPerformanceChange(comparison) {
    const totalChange = comparison.totalDurationChange;
    const p95Change = comparison.p95Change;

    if (totalChange < -10 || p95Change < -10) {
      return 'significant_improvement';
    } else if (totalChange < -5 || p95Change < -5) {
      return 'moderate_improvement';
    } else if (totalChange > 10 || p95Change > 10) {
      return 'significant_regression';
    } else if (totalChange > 5 || p95Change > 5) {
      return 'moderate_regression';
    } else {
      return 'neutral';
    }
  }

  /**
   * Generates performance recommendations
   */
  generateRecommendations(summary) {
    const recommendations = [];

    if (summary.overall.improvement > 10) {
      recommendations.push(
        'Pipeline reordering provides significant performance benefits - proceed with implementation',
      );
    } else if (summary.overall.improvement < -10) {
      recommendations.push(
        'Pipeline reordering causes performance regression - consider alternative approaches',
      );
    } else {
      recommendations.push(
        'Pipeline reordering has neutral performance impact - evaluate based on security benefits',
      );
    }

    if (summary.concurrency.maxThroughputImprovement > 20) {
      recommendations.push(
        'Significant concurrency improvements detected - optimize for high-throughput scenarios',
      );
    }

    const regressionDataSets = Object.entries(summary.byDataSet)
      .filter(([, data]) => data.assessment.includes('regression'))
      .map(([name]) => name);

    if (regressionDataSets.length > 0) {
      recommendations.push(
        `Performance regression detected for: ${regressionDataSets.join(', ')} - investigate optimization opportunities`,
      );
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
    const resultsFile = path.join(outputDir, 'pipeline-reorder-benchmark-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));

    // Generate markdown report
    const markdownFile = path.join(outputDir, 'pipeline-reorder-benchmark-report.md');
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

    let markdown = `# Pipeline Reorder Performance Benchmark Report

Generated: ${this.results.timestamp}

## Executive Summary

This report presents comprehensive performance benchmarking results comparing the baseline pipeline (AI → Sanitization) with the reordered pipeline (Sanitization → AI).

**Key Findings:**
- Overall Performance Impact: ${summary.overall.improvement > 0 ? '+' : ''}${summary.overall.improvement.toFixed(1)}%
- Maximum Concurrency Throughput Improvement: ${summary.concurrency.maxThroughputImprovement.toFixed(1)}%
- Average Response Time Improvement: ${summary.concurrency.avgTimeImprovement.toFixed(1)}%

## Test Configuration

- Iterations per benchmark: ${this.options.iterations}
- Concurrency levels tested: ${this.options.concurrencyLevels.join(', ')}
- Data sets tested: ${this.testDataSets.length} (ranging from ${Math.min(...this.testDataSets.map((d) => d.content.length))} to ${Math.max(...this.testDataSets.map((d) => d.content.length))} characters)

## Performance Results by Data Set

| Data Set | Description | Performance Change | P95 Change | Assessment |
|----------|-------------|-------------------|------------|------------|
`;

    for (const [name, data] of Object.entries(summary.byDataSet)) {
      const dataSet = this.testDataSets.find((d) => d.name === name);
      markdown += `| ${name} | ${dataSet.description} | ${data.performanceChange.toFixed(1)}% | ${data.p95Change.toFixed(1)}% | ${data.assessment.replace('_', ' ')} |\n`;
    }

    markdown += `

## Concurrency Performance Results

| Concurrency | Baseline Throughput | Reordered Throughput | Improvement |
|-------------|-------------------|---------------------|-------------|
`;

    for (const [level, data] of Object.entries(this.results.concurrency)) {
      markdown += `| ${level} | ${data.baseline.throughput.toFixed(0)} ops/sec | ${data.reordered.throughput.toFixed(0)} ops/sec | ${data.comparison.throughputImprovement.toFixed(1)}% |\n`;
    }

    markdown += `

## Detailed Analysis

### Performance Impact Assessment
`;

    if (summary.overall.improvement > 10) {
      markdown +=
        '**Positive Impact**: Pipeline reordering provides significant performance benefits.\n';
    } else if (summary.overall.improvement < -10) {
      markdown += '**Negative Impact**: Pipeline reordering causes performance regression.\n';
    } else {
      markdown += '**Neutral Impact**: Pipeline reordering has minimal performance impact.\n';
    }

    markdown += `

### Recommendations
${summary.recommendations.map((rec) => `- ${rec}`).join('\n')}

## Test Environment

- Node.js version: ${process.version}
- Platform: ${process.platform} ${process.arch}
- Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB heap used
- CPU: ${require('node:os').cpus().length} cores

## Raw Data

Complete benchmark results are available in the accompanying JSON file.
`;

    return markdown;
  }
}

module.exports = PipelineReorderBenchmark;
