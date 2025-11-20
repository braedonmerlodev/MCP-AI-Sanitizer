/**
 * Performance baselines for JSONTransformer operations
 * This test establishes baseline performance metrics for all transformation operations
 */

const { performance } = require('node:perf_hooks');
const {
  normalizeKeys,
  removeFields,
  coerceTypes,
  applyPreset,
  createChain,
} = require('../../utils/jsonTransformer');

// Sample data for performance testing
const sampleData = {
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

// Large dataset for scalability testing
const largeData = Array.from({ length: 100 }, (_, i) => ({
  ...sampleData,
  id: i,
  data: Array.from({ length: 50 }, () => sampleData),
}));

describe('JSONTransformer Performance Baselines', () => {
  const iterations = 1000;
  const largeIterations = 100;

  it('should establish normalizeKeys baseline performance', () => {
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      normalizeKeys(sampleData, 'camelCase');
      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime = totalTime / iterations;
    console.log(`normalizeKeys (camelCase) baseline: ${avgTime.toFixed(4)} ms per operation`);

    // With caching enabled
    let cachedTotalTime = 0;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      normalizeKeys(sampleData, 'camelCase', { useCache: true });
      const end = performance.now();
      cachedTotalTime += end - start;
    }

    const cachedAvgTime = cachedTotalTime / iterations;
    console.log(`normalizeKeys (cached) baseline: ${cachedAvgTime.toFixed(4)} ms per operation`);

    // Baseline should be reasonable
    expect(avgTime).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(50); // Arbitrary upper bound
  });

  it('should establish removeFields baseline performance', () => {
    let totalTime = 0;
    const patterns = ['password', 'token'];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      removeFields(sampleData, patterns);
      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime = totalTime / iterations;
    console.log(`removeFields baseline: ${avgTime.toFixed(4)} ms per operation`);

    expect(avgTime).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(20);
  });

  it('should establish coerceTypes baseline performance', () => {
    let totalTime = 0;
    const typeMap = {
      user_id: 'number',
      is_active: 'boolean',
      created_at: 'date',
      'profile.age': 'number',
      'profile.settings.notifications': 'boolean',
    };

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      coerceTypes(sampleData, typeMap);
      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime = totalTime / iterations;
    console.log(`coerceTypes baseline: ${avgTime.toFixed(4)} ms per operation`);

    expect(avgTime).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(30);
  });

  it('should establish applyPreset baseline performance', () => {
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      applyPreset(sampleData, 'apiResponse');
      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime = totalTime / iterations;
    console.log(`applyPreset (apiResponse) baseline: ${avgTime.toFixed(4)} ms per operation`);

    expect(avgTime).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(40);
  });

  it('should establish createChain baseline performance', () => {
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      createChain(sampleData)
        .normalizeKeys('snake_case')
        .removeFields(['password'])
        .coerceTypes({ user_id: 'string' })
        .value();
      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime = totalTime / iterations;
    console.log(`createChain (full pipeline) baseline: ${avgTime.toFixed(4)} ms per operation`);

    expect(avgTime).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(60);
  });

  it('should establish large dataset performance baseline', () => {
    let totalTime = 0;

    for (let i = 0; i < largeIterations; i++) {
      const start = performance.now();
      normalizeKeys(largeData, 'camelCase');
      const end = performance.now();
      totalTime += end - start;
    }

    const avgTime = totalTime / largeIterations;
    console.log(`Large dataset (100 items) baseline: ${avgTime.toFixed(4)} ms per operation`);

    expect(avgTime).toBeGreaterThan(0);
    expect(avgTime).toBeLessThan(500); // Allow more time for large data
  });

  it('should measure memory usage baseline', () => {
    const initialMemory = process.memoryUsage();

    // Perform operations
    for (let i = 0; i < iterations; i++) {
      normalizeKeys(sampleData, 'camelCase', { useCache: true });
      removeFields(sampleData, ['password']);
      coerceTypes(sampleData, { user_id: 'number' });
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = {
      rss: finalMemory.rss - initialMemory.rss,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
    };

    console.log('Memory usage baseline:');
    console.log(`  RSS increase: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap used increase: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap total increase: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)} MB`);

    // Memory should not increase excessively
    expect(memoryIncrease.heapUsed).toBeLessThan(50 * 1024 * 1024); // 50MB
  });
});
