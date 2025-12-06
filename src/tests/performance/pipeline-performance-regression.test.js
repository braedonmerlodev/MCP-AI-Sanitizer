// Pipeline Performance Regression Tests
const PipelineReorderBenchmark = require('./pipeline-reorder-benchmarks');
const AsyncConcurrencyBenchmark = require('../../../scripts/run-async-concurrency-benchmark');
const fs = require('node:fs');
const path = require('node:path');

describe('Pipeline Performance Regression Tests', () => {
  const testTimeout = 60_000; // 60 seconds for performance tests
  const regressionThreshold = 0.1; // 10% regression threshold

  let benchmark;
  let baselineResults;

  beforeAll(() => {
    benchmark = new PipelineReorderBenchmark({
      iterations: 50, // Reduced for test environment
      concurrencyLevels: [1, 5],
      warmUpIterations: 5,
    });

    // Load baseline results if they exist
    const baselineFile = path.join(
      __dirname,
      '..',
      '..',
      'research',
      'pipeline-reorder-benchmark-baseline.json',
    );
    if (fs.existsSync(baselineFile)) {
      baselineResults = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    }
  });

  describe('Performance Baseline Validation', () => {
    test(
      'should establish performance baseline for reordered pipeline',
      async () => {
        const results = await benchmark.runDataSetBenchmark(benchmark.testDataSets[0]); // Test with small dataset

        expect(results).toBeDefined();
        expect(results.baseline).toBeDefined();
        expect(results.reordered).toBeDefined();
        expect(results.comparison).toBeDefined();

        // Validate that reordered pipeline performs at least as well as baseline
        expect(results.comparison.totalDurationChange).toBeLessThan(regressionThreshold);
      },
      testTimeout,
    );

    test(
      'should validate sanitization performance in reordered pipeline',
      async () => {
        const results = await benchmark.runDataSetBenchmark(benchmark.testDataSets[1]); // Test with malicious content

        expect(results.baseline.statistics).toBeDefined();
        expect(results.reordered.statistics).toBeDefined();

        // Ensure sanitization timing is reasonable (< 50ms average)
        expect(results.reordered.statistics.sanitizeDuration.mean).toBeLessThan(50);
      },
      testTimeout,
    );
  });

  describe('Concurrency Performance Validation', () => {
    test(
      'should validate concurrent processing performance',
      async () => {
        const concurrencyBenchmark = new AsyncConcurrencyBenchmark({
          concurrencyLevels: [5],
          operationsPerLevel: 25, // Reduced for test
        });
        const results = await concurrencyBenchmark.runComprehensiveBenchmark();
        const concurrencyResult = results.concurrency['5conc-light']; // Use light dataset result

        expect(concurrencyResult).toBeDefined();
        expect(concurrencyResult.timing.throughput).toBeGreaterThan(1000); // At least 1000 ops/sec
        expect(concurrencyResult.timing.efficiency).toBeGreaterThan(50); // At least 50% efficiency
        expect(concurrencyResult.errors.errorRate).toBeLessThan(5); // Less than 5% error rate
      },
      testTimeout,
    );

    test(
      'should handle high concurrency without significant degradation',
      async () => {
        const concurrencyBenchmark = new AsyncConcurrencyBenchmark({
          concurrencyLevels: [1, 5],
          operationsPerLevel: 25, // Reduced for test
        });
        const results = await concurrencyBenchmark.runComprehensiveBenchmark();
        const highConcurrency = results.concurrency['5conc-light'];

        // High concurrency should maintain reasonable efficiency
        expect(highConcurrency.timing.efficiency).toBeGreaterThan(100); // Allow for super-linear scaling in tests
      },
      testTimeout,
    );
  });

  describe('Regression Detection', () => {
    test(
      'should detect performance regression against baseline',
      async () => {
        if (!baselineResults) {
          console.warn('No baseline results found, skipping regression test');
          return;
        }

        const currentResults = await benchmark.runDataSetBenchmark(benchmark.testDataSets[0]);

        // Compare current performance against baseline
        const baselineAvg = baselineResults.reordered.statistics.totalDuration.mean;
        const currentAvg = currentResults.reordered.statistics.totalDuration.mean;

        const regression = (currentAvg - baselineAvg) / baselineAvg;

        console.log(
          `Performance regression check: ${regression.toFixed(3)} (${(regression * 100).toFixed(1)}%)`,
        );

        // Allow for some variance but detect significant regression
        expect(regression).toBeLessThan(regressionThreshold);

        // Log performance metrics for monitoring
        console.log(`Current avg response time: ${currentAvg.toFixed(2)}ms`);
        console.log(`Baseline avg response time: ${baselineAvg.toFixed(2)}ms`);
      },
      testTimeout,
    );

    test(
      'should maintain SLA compliance under load',
      async () => {
        const concurrencyBenchmark = new AsyncConcurrencyBenchmark({
          concurrencyLevels: [5],
          operationsPerLevel: 25, // Reduced for test
        });
        const results = await concurrencyBenchmark.runComprehensiveBenchmark();
        const loadTest = results.concurrency['5conc-medium']; // Use medium dataset for load test

        // P95 should be reasonable (< 100ms under load)
        expect(loadTest.timing.p95).toBeLessThan(100);

        // Error rate should be low
        expect(loadTest.errors.errorRate).toBeLessThan(1);
      },
      testTimeout,
    );
  });

  describe('Pipeline Component Performance', () => {
    test(
      'should validate individual pipeline component performance',
      async () => {
        const results = await benchmark.runDataSetBenchmark(benchmark.testDataSets[2]); // Heavy dataset

        // Validate that AI processing doesn't dominate total time
        const aiPortion =
          results.reordered.statistics.aiDuration.mean /
          results.reordered.statistics.totalDuration.mean;
        expect(aiPortion).toBeLessThan(0.8); // AI should be < 80% of total time

        // Validate that sanitization is not the bottleneck
        const sanitizePortion =
          results.reordered.statistics.sanitizeDuration.mean /
          results.reordered.statistics.totalDuration.mean;
        expect(sanitizePortion).toBeLessThan(0.5); // Sanitization should be < 50% of total time
      },
      testTimeout,
    );

    test(
      'should ensure consistent performance across data types',
      async () => {
        const results = [];

        // Test all data sets
        for (const dataSet of benchmark.testDataSets.slice(0, 3)) {
          // Test first 3 datasets
          const result = await benchmark.runDataSetBenchmark(dataSet);
          results.push(result);
        }

        // Validate that performance is reasonably consistent
        const avgTimes = results.map((r) => r.reordered.statistics.totalDuration.mean);
        const maxTime = Math.max(...avgTimes);
        const minTime = Math.min(...avgTimes);

        // Performance variation should be reasonable (< 5x difference)
        expect(maxTime / minTime).toBeLessThan(5);
      },
      testTimeout,
    );
  });

  describe('Memory and Resource Usage', () => {
    test(
      'should monitor memory usage during performance tests',
      async () => {
        const initialMemory = process.memoryUsage();

        // Run a performance test
        const concurrencyBenchmark = new AsyncConcurrencyBenchmark({
          concurrencyLevels: [5],
          operationsPerLevel: 25, // Reduced for test
        });
        await concurrencyBenchmark.runComprehensiveBenchmark();

        const finalMemory = process.memoryUsage();

        // Memory usage should not grow excessively
        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryGrowthMB = memoryGrowth / (1024 * 1024);

        console.log(`Memory growth during test: ${memoryGrowthMB.toFixed(2)}MB`);

        // Allow for some memory growth but not excessive (> 50MB)
        expect(memoryGrowthMB).toBeLessThan(50);
      },
      testTimeout,
    );
  });

  afterAll(() => {
    // Clean up any test artifacts
    console.log('Performance regression tests completed');
  });
});
