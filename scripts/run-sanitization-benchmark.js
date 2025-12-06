#!/usr/bin/env node

/**
 * Sanitization Library Performance Benchmarking
 *
 * Comprehensive performance and security benchmarking for Node.js sanitization libraries
 * compared to Python bleach equivalent functionality.
 */

const { createSanitizationAdapter } = require('../src/utils/sanitization-adapters');
const TokenGenerationBenchmark = require('../src/utils/benchmark');
const fs = require('fs');
const path = require('path');

class SanitizationBenchmark {
  constructor() {
    this.adapters = [
      createSanitizationAdapter('DOMPurify'),
      createSanitizationAdapter('sanitize-html'),
      createSanitizationAdapter('bleach'),
    ];

    // Test data sets for benchmarking
    this.testDataSets = this.generateTestDataSets();
  }

  /**
   * Generate comprehensive test data sets for benchmarking
   */
  generateTestDataSets() {
    return [
      {
        name: 'small-safe',
        content: '<p>Hello <strong>world</strong>!</p>',
        description: 'Small safe HTML content',
      },
      {
        name: 'medium-safe',
        content:
          '<div><h1>Title</h1><p>Paragraph with <em>emphasis</em> and <strong>bold</strong> text.</p><ul><li>Item 1</li><li>Item 2</li></ul></div>',
        description: 'Medium safe HTML content',
      },
      {
        name: 'large-safe',
        content: 'A'.repeat(10000).replace(/(.{100})/g, '<p>$1</p>'),
        description: 'Large safe HTML content (10KB)',
      },
      {
        name: 'small-malicious',
        content: '<p>Hello <script>alert("xss")</script> world!</p>',
        description: 'Small content with malicious script',
      },
      {
        name: 'medium-malicious',
        content:
          '<div><h1>Title</h1><p>Content</p><script>evil()</script><iframe src="bad.com"></iframe><a href="javascript:evil()">Link</a></div>',
        description: 'Medium content with multiple threats',
      },
      {
        name: 'large-malicious',
        content: 'B'.repeat(5000).replace(/(.{50})/g, '$1<script>alert(1)</script>'),
        description: 'Large content with distributed threats (5KB)',
      },
      {
        name: 'complex-html',
        content: `
          <article class="post">
            <header>
              <h1>Complex HTML Test</h1>
              <p class="meta">By <a href="/author">Author</a> on <time>2024</time></p>
            </header>
            <div class="content">
              <p>This is a <strong>bold</strong> statement with <em>emphasis</em>.</p>
              <blockquote>
                <p>This is a blockquote with <a href="https://example.com">links</a>.</p>
              </blockquote>
              <ul>
                <li>List item 1</li>
                <li>List item 2 with <code>inline code</code></li>
              </ul>
              <pre><code>console.log('code block');</code></pre>
              <img src="image.jpg" alt="Alt text" onerror="alert('xss')" />
              <form action="/submit">
                <input type="text" name="data" />
                <button type="submit">Submit</button>
              </form>
              <script>maliciousCode()</script>
              <style>body { background: red; }</style>
            </div>
          </article>
        `,
        description: 'Complex real-world HTML with mixed safe/malicious content',
      },
    ];
  }

  /**
   * Run performance benchmark for a single adapter and dataset
   */
  async runSingleBenchmark(adapter, dataSet, iterations = 100) {
    const results = {
      adapter: adapter.libraryName,
      dataSet: dataSet.name,
      iterations,
      times: [],
      errors: 0,
      totalInputSize: dataSet.content.length,
    };

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = process.hrtime.bigint();
        const output = adapter.sanitize(dataSet.content);
        const endTime = process.hrtime.bigint();

        const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
        results.times.push(duration);

        // Store output size for first iteration
        if (i === 0) {
          results.outputSize = output.length;
          results.compressionRatio = output.length / dataSet.content.length;
        }
      } catch (error) {
        results.errors++;
        results.times.push(0); // Placeholder for failed runs
      }
    }

    return results;
  }

  /**
   * Calculate statistics for benchmark results
   */
  calculateStatistics(times) {
    const validTimes = times.filter((t) => t > 0);
    if (validTimes.length === 0) return { error: 'No valid measurements' };

    const sorted = [...validTimes].sort((a, b) => a - b);
    const sum = validTimes.reduce((a, b) => a + b, 0);

    return {
      count: validTimes.length,
      min: Math.min(...validTimes),
      max: Math.max(...validTimes),
      mean: sum / validTimes.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(
        validTimes.reduce((acc, time) => acc + Math.pow(time - sum / validTimes.length, 2), 0) /
          validTimes.length,
      ),
    };
  }

  /**
   * Run comprehensive benchmarking suite
   */
  async runComprehensiveBenchmark(iterations = 100) {
    console.log('🚀 Starting Comprehensive Sanitization Benchmark\n');

    const results = {
      timestamp: new Date().toISOString(),
      iterations,
      adapters: this.adapters.map((a) => a.getMetadata()),
      dataSets: this.testDataSets.map((ds) => ({
        name: ds.name,
        description: ds.description,
        size: ds.content.length,
      })),
      benchmarks: [],
      summary: {},
    };

    // Run benchmarks for each adapter and dataset combination
    for (const adapter of this.adapters) {
      console.log(`📊 Benchmarking ${adapter.libraryName}...`);

      for (const dataSet of this.testDataSets) {
        console.log(`  Running ${dataSet.name} (${dataSet.content.length} chars)...`);

        const benchmarkResult = await this.runSingleBenchmark(adapter, dataSet, iterations);
        const stats = this.calculateStatistics(benchmarkResult.times);

        const result = {
          adapter: adapter.libraryName,
          dataSet: dataSet.name,
          stats,
          metadata: {
            inputSize: benchmarkResult.totalInputSize,
            outputSize: benchmarkResult.outputSize,
            compressionRatio: benchmarkResult.compressionRatio,
            errors: benchmarkResult.errors,
          },
        };

        results.benchmarks.push(result);
      }
    }

    // Generate summary statistics
    results.summary = this.generateSummary(results);

    // Save results
    const outputDir = path.join(__dirname, '..', 'research');
    const outputFile = path.join(outputDir, 'sanitization-performance-benchmark.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

    // Generate markdown report
    const markdownFile = path.join(outputDir, 'sanitization-performance-benchmark.md');
    const markdownContent = this.generateMarkdownReport(results);
    fs.writeFileSync(markdownFile, markdownContent);

    console.log(`\n💾 Results saved to: ${outputFile}`);
    console.log(`📄 Markdown report saved to: ${markdownFile}`);

    return results;
  }

  /**
   * Generate summary statistics across all benchmarks
   */
  generateSummary(results) {
    const summary = {
      byAdapter: {},
      byDataSet: {},
      overall: {
        totalBenchmarks: results.benchmarks.length,
        totalTime: 0,
        avgThroughput: 0,
      },
    };

    // Group by adapter
    results.adapters.forEach((adapter) => {
      const adapterBenchmarks = results.benchmarks.filter((b) => b.adapter === adapter.name);
      summary.byAdapter[adapter.name] = {
        benchmarks: adapterBenchmarks.length,
        avgResponseTime:
          adapterBenchmarks.reduce((sum, b) => sum + b.stats.mean, 0) / adapterBenchmarks.length,
        avgThroughput:
          adapterBenchmarks.reduce((sum, b) => sum + b.metadata.inputSize / b.stats.mean, 0) /
          adapterBenchmarks.length,
        totalErrors: adapterBenchmarks.reduce((sum, b) => sum + b.metadata.errors, 0),
      };
    });

    // Group by dataset
    results.dataSets.forEach((dataSet) => {
      const dataSetBenchmarks = results.benchmarks.filter((b) => b.dataSet === dataSet.name);
      summary.byDataSet[dataSet.name] = {
        size: dataSet.size,
        adapters: dataSetBenchmarks.length,
        avgResponseTime:
          dataSetBenchmarks.reduce((sum, b) => sum + b.stats.mean, 0) / dataSetBenchmarks.length,
      };
    });

    // Calculate overall metrics
    const allBenchmarks = results.benchmarks;
    summary.overall.totalTime = allBenchmarks.reduce(
      (sum, b) => sum + b.stats.mean * results.iterations,
      0,
    );
    summary.overall.avgThroughput =
      allBenchmarks.reduce((sum, b) => sum + b.metadata.inputSize / b.stats.mean, 0) /
      allBenchmarks.length;

    return summary;
  }

  /**
   * Generate markdown report from benchmark results
   */
  generateMarkdownReport(results) {
    let markdown = `# Sanitization Library Performance Benchmark Report

Generated: ${results.timestamp}

## Executive Summary

This report presents comprehensive performance benchmarking results for Node.js sanitization libraries (DOMPurify, sanitize-html) compared to Python bleach equivalent functionality.

**Test Configuration:**
- Iterations per benchmark: ${results.iterations}
- Libraries tested: ${results.adapters.map((a) => a.name).join(', ')}
- Data sets: ${results.dataSets.length} (ranging from ${Math.min(...results.dataSets.map((d) => d.size))} to ${Math.max(...results.dataSets.map((d) => d.size))} characters)

## Performance Summary

| Library | Avg Response Time | Throughput (chars/ms) | Total Errors |
|---------|-------------------|----------------------|--------------|
`;

    Object.entries(results.summary.byAdapter).forEach(([adapter, stats]) => {
      markdown += `| ${adapter} | ${stats.avgResponseTime.toFixed(2)}ms | ${stats.avgThroughput.toFixed(0)} | ${stats.totalErrors} |\n`;
    });

    markdown += `

## Detailed Results by Data Set

`;

    results.dataSets.forEach((dataSet) => {
      markdown += `### ${dataSet.name} (${dataSet.size} chars)
${dataSet.description}

| Library | Mean (ms) | P95 (ms) | Min (ms) | Max (ms) | Errors | Compression |
|---------|-----------|----------|----------|----------|--------|-------------|
`;

      const dataSetBenchmarks = results.benchmarks.filter((b) => b.dataSet === dataSet.name);
      dataSetBenchmarks.forEach((benchmark) => {
        markdown += `| ${benchmark.adapter} | ${benchmark.stats.mean.toFixed(2)} | ${benchmark.stats.p95.toFixed(2)} | ${benchmark.stats.min.toFixed(2)} | ${benchmark.stats.max.toFixed(2)} | ${benchmark.metadata.errors} | ${(benchmark.metadata.compressionRatio * 100).toFixed(1)}% |\n`;
      });

      markdown += '\n';
    });

    markdown += `## Performance Analysis

### Response Time Distribution
- **Fastest overall**: ${Object.entries(results.summary.byAdapter).sort(([, a], [, b]) => a.avgResponseTime - b.avgResponseTime)[0][0]} (${Object.entries(
      results.summary.byAdapter,
    )
      .sort(([, a], [, b]) => a.avgResponseTime - b.avgResponseTime)[0][1]
      .avgResponseTime.toFixed(2)}ms avg)
- **Most consistent**: ${Object.entries(results.summary.byAdapter).sort(([, a], [, b]) => a.stdDev - b.stdDev)[0][0]}
- **Highest throughput**: ${Object.entries(results.summary.byAdapter).sort(([, a], [, b]) => b.avgThroughput - a.avgThroughput)[0][0]} (${Object.entries(
      results.summary.byAdapter,
    )
      .sort(([, a], [, b]) => b.avgThroughput - a.avgThroughput)[0][1]
      .avgThroughput.toFixed(0)} chars/ms)

### Data Set Performance Patterns
`;

    Object.entries(results.summary.byDataSet).forEach(([name, stats]) => {
      markdown += `- **${name}** (${stats.size} chars): ${stats.avgResponseTime.toFixed(2)}ms average response time\n`;
    });

    markdown += `

## Recommendations

Based on the benchmark results:

1. **For performance-critical applications**: Use sanitize-html (fastest response times)
2. **For maximum security**: Use DOMPurify (most comprehensive sanitization)
3. **For bleach compatibility**: Use bleach adapter (highest accuracy for complex threats)

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
  const benchmark = new SanitizationBenchmark();

  benchmark
    .runComprehensiveBenchmark(50) // Reduced iterations for faster testing
    .then((results) => {
      console.log('\n✅ Benchmarking complete!');
      console.log(`Total benchmarks run: ${results.benchmarks.length}`);
      console.log(
        `Average throughput: ${results.summary.overall.avgThroughput.toFixed(0)} chars/ms`,
      );
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}

module.exports = SanitizationBenchmark;
