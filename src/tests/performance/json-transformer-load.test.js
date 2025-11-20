/**
 * Load testing for JSONTransformer operations
 * Tests performance under various load conditions
 */

const { performance } = require('node:perf_hooks');
const { normalizeKeys, removeFields, coerceTypes } = require('../../utils/jsonTransformer');

// Generate test data of various sizes
function generateTestData(size) {
  const baseData = {
    user_id: 123,
    first_name: 'John',
    last_name: 'Doe',
    email_address: 'john.doe@example.com',
    is_active: 'true',
    created_at: '2023-01-01T00:00:00Z',
    profile: {
      age: '30',
      interests: ['reading', 'coding'],
      settings: {
        notifications: '1',
        theme: 'dark',
      },
    },
    sensitive_data: {
      password: 'secret',
      token: 'abc123',
    },
  };

  if (size === 1) return baseData;

  // For larger sizes, create arrays of data
  return Array.from({ length: size }, (_, i) => ({
    ...baseData,
    id: i,
    data: Array.from({ length: Math.min(size, 10) }, () => baseData),
  }));
}

describe('JSONTransformer Load Testing', () => {
  const loadConditions = [
    { name: 'Small (1 item)', size: 1, iterations: 1000 },
    { name: 'Medium (10 items)', size: 10, iterations: 500 },
    { name: 'Large (100 items)', size: 100, iterations: 100 },
    { name: 'Extra Large (1000 items)', size: 1000, iterations: 10 },
  ];

  for (const { name, size, iterations } of loadConditions) {
    it(`should handle ${name} load for normalizeKeys`, () => {
      const testData = generateTestData(size);
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        normalizeKeys(testData, 'camelCase');
        const end = performance.now();
        totalTime += end - start;
      }

      const avgTime = totalTime / iterations;
      console.log(`${name} normalizeKeys: ${avgTime.toFixed(4)} ms per operation`);

      // Performance should scale reasonably
      expect(avgTime).toBeGreaterThan(0);
      expect(avgTime).toBeLessThan(size * 10); // Rough scaling check
    });

    it(`should handle ${name} load for removeFields`, () => {
      const testData = generateTestData(size);
      const patterns = ['password', 'token'];
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        removeFields(testData, patterns);
        const end = performance.now();
        totalTime += end - start;
      }

      const avgTime = totalTime / iterations;
      console.log(`${name} removeFields: ${avgTime.toFixed(4)} ms per operation`);

      expect(avgTime).toBeGreaterThan(0);
      expect(avgTime).toBeLessThan(size * 5);
    });

    it(`should handle ${name} load for coerceTypes`, () => {
      const testData = generateTestData(size);
      const typeMap = {
        user_id: 'number',
        is_active: 'boolean',
        created_at: 'date',
      };
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        coerceTypes(testData, typeMap);
        const end = performance.now();
        totalTime += end - start;
      }

      const avgTime = totalTime / iterations;
      console.log(`${name} coerceTypes: ${avgTime.toFixed(4)} ms per operation`);

      expect(avgTime).toBeGreaterThan(0);
      expect(avgTime).toBeLessThan(size * 10);
    });
  }

  it('should handle concurrent load (10 parallel operations)', async () => {
    const testData = generateTestData(10);
    const concurrency = 10;
    const operation = () => normalizeKeys(testData, 'camelCase');
    const operations = Array.from({ length: concurrency }, () => operation);

    const start = performance.now();
    await Promise.all(operations.map((op) => op()));
    const end = performance.now();

    const totalTime = end - start;
    const avgTime = totalTime / concurrency;

    console.log(`Concurrent (10 parallel) normalizeKeys: ${avgTime.toFixed(4)} ms per operation`);

    expect(avgTime).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(100);
  });

  it('should handle high-frequency operations (rapid succession)', () => {
    const testData = generateTestData(1);
    const rapidIterations = 10_000;
    let totalTime = 0;

    const start = performance.now();
    for (let i = 0; i < rapidIterations; i++) {
      normalizeKeys(testData, 'camelCase', { useCache: true });
    }
    const end = performance.now();

    totalTime = end - start;
    const avgTime = totalTime / rapidIterations;

    console.log(
      `High-frequency (10k ops) cached normalizeKeys: ${avgTime.toFixed(6)} ms per operation`,
    );

    expect(avgTime).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(0.01); // Should be very fast with caching
  });

  it('should test memory usage under load', () => {
    const initialMemory = process.memoryUsage();
    const loadIterations = 1000;

    // Generate and process large amounts of data
    for (let i = 0; i < loadIterations; i++) {
      const data = generateTestData(5);
      normalizeKeys(data, 'snake_case');
      removeFields(data, ['password']);
      coerceTypes(data, { user_id: 'string' });
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = {
      rss: finalMemory.rss - initialMemory.rss,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
    };

    console.log('Load test memory usage:');
    console.log(`  RSS increase: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap used increase: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap total increase: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)} MB`);

    // Memory should be managed properly under load
    expect(memoryIncrease.heapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB
  });
});
