const TrustTokenGenerator = require('../../components/TrustTokenGenerator');
const ProxySanitizer = require('../../components/proxy-sanitizer');

describe('Reuse Mechanisms Performance Tests', () => {
  let trustTokenGenerator;
  let proxySanitizer;
  let testContent;
  let validTrustToken;

  beforeAll(() => {
    trustTokenGenerator = new TrustTokenGenerator();
    proxySanitizer = new ProxySanitizer();

    // Create test content of various sizes
    testContent = {
      small: JSON.stringify({ message: 'Small test content', data: 'test' }),
      medium: JSON.stringify({
        message: 'Medium test content with more data',
        data: { nested: { value: 'test', array: [1, 2, 3, 4, 5] } },
        metadata: { size: 'medium', complexity: 'moderate' },
      }),
      large: JSON.stringify({
        message: 'Large test content with substantial data',
        data: {
          nested: {
            deep: {
              structure: {
                with: {
                  many: {
                    levels: {
                      of: {
                        nesting: Array.from({ length: 100 }, (_, i) => ({
                          id: i,
                          value: `item-${i}`,
                        })),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        metadata: { size: 'large', complexity: 'high' },
        arrays: [
          Array.from({ length: 50 }, (_, i) => ({ index: i, data: `data-${i}` })),
          Array.from({ length: 50 }, (_, i) => ({ index: i + 50, data: `data-${i + 50}` })),
        ],
      }),
    };

    // Generate trust tokens for each content size
    validTrustToken = {
      small: trustTokenGenerator.generateToken(
        testContent.small,
        testContent.small,
        ['sanitize-basic'],
        { version: '1.0.0', expirationHours: 1 },
      ),
      medium: trustTokenGenerator.generateToken(
        testContent.medium,
        testContent.medium,
        ['sanitize-basic', 'remove-sensitive'],
        { version: '1.0.0', expirationHours: 1 },
      ),
      large: trustTokenGenerator.generateToken(
        testContent.large,
        testContent.large,
        ['sanitize-basic', 'remove-sensitive', 'validate-structure'],
        { version: '1.0.0', expirationHours: 1 },
      ),
    };
  });

  describe('Token Validation Performance', () => {
    test('should measure token validation latency for different token sizes', () => {
      const results = {};

      ['small', 'medium', 'large'].forEach((size) => {
        const token = validTrustToken[size];
        const measurements = [];

        // Measure validation time over multiple runs
        for (let i = 0; i < 100; i++) {
          const startTime = process.hrtime.bigint();
          const validation = trustTokenGenerator.validateToken(token);
          const endTime = process.hrtime.bigint();

          expect(validation.isValid).toBe(true);
          const durationMs = Number(endTime - startTime) / 1e6;
          measurements.push(durationMs);
        }

        // Calculate statistics
        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const minTime = Math.min(...measurements);
        const maxTime = Math.max(...measurements);
        const p95Time = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

        results[size] = {
          averageMs: avgTime,
          minMs: minTime,
          maxMs: maxTime,
          p95Ms: p95Time,
          contentLength: testContent[size].length,
        };
      });

      // Log performance results
      console.log('Token Validation Performance Results:');
      Object.entries(results).forEach(([size, stats]) => {
        console.log(
          `${size}: avg=${stats.averageMs.toFixed(3)}ms, p95=${stats.p95Ms.toFixed(3)}ms, content=${stats.contentLength}chars`,
        );
      });

      // Performance assertions - validation should be fast (< 10ms target)
      expect(results.small.averageMs).toBeLessThan(10);
      expect(results.medium.averageMs).toBeLessThan(10);
      expect(results.large.averageMs).toBeLessThan(10);
    });
  });

  describe('Content Hash Performance', () => {
    test('should benchmark content hash computation', () => {
      const results = {};

      ['small', 'medium', 'large'].forEach((size) => {
        const content = testContent[size];
        const measurements = [];

        // Measure hash computation time
        for (let i = 0; i < 100; i++) {
          const startTime = process.hrtime.bigint();
          const hash = require('crypto').createHash('sha256').update(content).digest('hex');
          const endTime = process.hrtime.bigint();

          const durationMs = Number(endTime - startTime) / 1e6;
          measurements.push(durationMs);

          // Verify hash is correct
          expect(hash).toMatch(/^[a-f0-9]{64}$/);
        }

        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const p95Time = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

        results[size] = {
          averageMs: avgTime,
          p95Ms: p95Time,
          contentLength: content.length,
          throughput: content.length / 1024 / (avgTime / 1000), // KB per second
        };
      });

      console.log('Content Hash Performance Results:');
      Object.entries(results).forEach(([size, stats]) => {
        console.log(
          `${size}: avg=${stats.averageMs.toFixed(3)}ms, throughput=${stats.throughput.toFixed(2)}KB/s`,
        );
      });
    });
  });

  describe('Reuse vs Sanitization Performance Comparison', () => {
    test('should compare performance of reuse vs full sanitization', async () => {
      const results = {};

      for (const size of ['small', 'medium', 'large']) {
        const content = testContent[size];
        const token = validTrustToken[size];

        // Measure full sanitization time
        const sanitizationTimes = [];
        for (let i = 0; i < 50; i++) {
          const startTime = process.hrtime.bigint();
          const result = await proxySanitizer.sanitize(content, {
            classification: 'llm',
            generateTrustToken: true,
          });
          const endTime = process.hrtime.bigint();

          const durationMs = Number(endTime - startTime) / 1e6;
          sanitizationTimes.push(durationMs);
        }

        // Measure reuse time (simulate the reuse logic)
        const reuseTimes = [];
        for (let i = 0; i < 50; i++) {
          const startTime = process.hrtime.bigint();

          // Simulate reuse validation logic
          const validation = trustTokenGenerator.validateToken(token);
          if (validation.isValid) {
            const contentHash = require('crypto')
              .createHash('sha256')
              .update(content)
              .digest('hex');
            if (contentHash === token.contentHash) {
              // Reuse successful
            }
          }

          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1e6;
          reuseTimes.push(durationMs);
        }

        const avgSanitizationTime =
          sanitizationTimes.reduce((a, b) => a + b, 0) / sanitizationTimes.length;
        const avgReuseTime = reuseTimes.reduce((a, b) => a + b, 0) / reuseTimes.length;
        const timeSaved = avgSanitizationTime - avgReuseTime;
        const speedup = avgSanitizationTime / avgReuseTime;

        results[size] = {
          sanitizationMs: avgSanitizationTime,
          reuseMs: avgReuseTime,
          timeSavedMs: timeSaved,
          speedup: speedup,
          contentLength: content.length,
        };
      }

      console.log('Reuse vs Sanitization Performance Comparison:');
      Object.entries(results).forEach(([size, stats]) => {
        console.log(
          `${size}: sanitization=${stats.sanitizationMs.toFixed(2)}ms, reuse=${stats.reuseMs.toFixed(2)}ms, speedup=${stats.speedup.toFixed(2)}x, saved=${stats.timeSavedMs.toFixed(2)}ms`,
        );
      });

      // Performance assertions
      Object.values(results).forEach((stats) => {
        expect(stats.speedup).toBeGreaterThan(1); // Reuse should be faster
        expect(stats.timeSavedMs).toBeGreaterThan(0); // Should save time
      });
    });
  });

  describe('Concurrent Load Performance', () => {
    test('should handle concurrent reuse operations', async () => {
      const concurrentOperations = 100;
      const operations = [];

      // Create concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        const size = ['small', 'medium', 'large'][i % 3];
        operations.push(async () => {
          const token = validTrustToken[size];
          const startTime = process.hrtime.bigint();

          // Simulate reuse validation
          const validation = trustTokenGenerator.validateToken(token);
          if (validation.isValid) {
            const contentHash = require('crypto')
              .createHash('sha256')
              .update(testContent[size])
              .digest('hex');
            if (contentHash === token.contentHash) {
              // Reuse successful
            }
          }

          const endTime = process.hrtime.bigint();
          return Number(endTime - startTime) / 1e6;
        });
      }

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(operations.map((op) => op()));
      const endTime = process.hrtime.bigint();

      const totalTime = Number(endTime - startTime) / 1e6;
      const avgOperationTime = results.reduce((a, b) => a + b, 0) / results.length;
      const throughput = concurrentOperations / (totalTime / 1000); // operations per second

      console.log(`Concurrent Load Performance (${concurrentOperations} operations):`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Average operation time: ${avgOperationTime.toFixed(3)}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} ops/sec`);

      // Performance assertions
      expect(avgOperationTime).toBeLessThan(50); // Each operation should be fast
      expect(throughput).toBeGreaterThan(1000); // Should handle high throughput
    });
  });

  describe('Memory Usage Benchmarks', () => {
    test('should monitor memory usage during operations', () => {
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      const tokens = [];
      for (let i = 0; i < 1000; i++) {
        const content = JSON.stringify({
          id: i,
          data: `test-data-${i}`,
          largeArray: Array.from({ length: 100 }, () => Math.random()),
        });
        tokens.push(
          trustTokenGenerator.generateToken(content, content, ['test'], { expirationHours: 1 }),
        );
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = {
        rss: (finalMemory.rss - initialMemory.rss) / 1024 / 1024, // MB
        heapUsed: (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024, // MB
        heapTotal: (finalMemory.heapTotal - initialMemory.heapTotal) / 1024 / 1024, // MB
      };

      console.log('Memory Usage Benchmark:');
      console.log(`RSS increase: ${memoryIncrease.rss.toFixed(2)}MB`);
      console.log(`Heap used increase: ${memoryIncrease.heapUsed.toFixed(2)}MB`);
      console.log(`Heap total increase: ${memoryIncrease.heapTotal.toFixed(2)}MB`);

      // Memory assertions - should not have excessive memory growth
      expect(memoryIncrease.heapUsed).toBeLessThan(100); // Less than 100MB increase
    });
  });

  describe('Scalability Tests', () => {
    test('should maintain performance with increasing content sizes', () => {
      const sizes = [100, 1000, 10000, 100000]; // Content sizes in characters
      const results = [];

      sizes.forEach((size) => {
        const content = 'x'.repeat(size);
        const measurements = [];

        for (let i = 0; i < 10; i++) {
          const startTime = process.hrtime.bigint();
          const hash = require('crypto').createHash('sha256').update(content).digest('hex');
          const endTime = process.hrtime.bigint();

          const durationMs = Number(endTime - startTime) / 1e6;
          measurements.push(durationMs);
        }

        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        results.push({ size, avgTimeMs: avgTime });
      });

      console.log('Scalability Test Results:');
      results.forEach((result) => {
        console.log(`${result.size} chars: ${result.avgTimeMs.toFixed(3)}ms`);
      });

      // Scalability assertions - performance should degrade gracefully
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      const degradationRatio = lastResult.avgTimeMs / firstResult.avgTimeMs;

      expect(degradationRatio).toBeLessThan(100); // Should not degrade by more than 100x
    });
  });
});
