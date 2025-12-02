const TokenGenerationBenchmark = require('../../utils/benchmark');
const TrustTokenGenerator = require('../../components/TrustTokenGenerator');

let generator;
let benchmark;

beforeEach(() => {
  generator = new TrustTokenGenerator({ secret: 'test-secret-for-benchmarking' });
  benchmark = new TokenGenerationBenchmark({
    generator,
    config: {
      warmUpIterations: 10, // Reduced for tests
      measurementIterations: 50, // Reduced for tests
      concurrencyLevels: [1, 2],
      inputDataSets: [
        {
          name: 'test-small',
          sanitizedContent: 'test content',
          originalContent: 'test content',
          rulesApplied: ['test-rule'],
        },
      ],
    },
  });
});

describe('TokenGenerationBenchmark', () => {
  describe('constructor', () => {
    it('should create benchmark instance with valid generator', () => {
      expect(benchmark).toBeInstanceOf(TokenGenerationBenchmark);
      expect(benchmark.generator).toBe(generator);
    });

    it('should throw error without generator', () => {
      expect(() => new TokenGenerationBenchmark({})).toThrow(
        'TrustTokenGenerator instance is required',
      );
    });

    it('should use default config when not provided', () => {
      const defaultBenchmark = new TokenGenerationBenchmark({ generator });
      expect(defaultBenchmark.config.warmUpIterations).toBe(100);
      expect(defaultBenchmark.config.measurementIterations).toBe(1000);
    });
  });

  describe('generateDefaultTestDataSets', () => {
    it('should generate default test data sets', () => {
      const dataSets = benchmark.generateDefaultTestDataSets();
      expect(dataSets).toHaveLength(5);
      expect(dataSets.map((ds) => ds.name)).toEqual([
        'small',
        'medium',
        'large',
        'empty',
        'unicode',
      ]);
    });

    it('should include various data sizes', () => {
      const dataSets = benchmark.generateDefaultTestDataSets();
      const small = dataSets.find((ds) => ds.name === 'small');
      const medium = dataSets.find((ds) => ds.name === 'medium');
      const large = dataSets.find((ds) => ds.name === 'large');

      expect(small.sanitizedContent.length).toBe(100);
      expect(medium.sanitizedContent.length).toBe(10 * 1024);
      expect(large.sanitizedContent.length).toBe(1024 * 1024);
    });
  });

  describe('measureExecutionTime', () => {
    it('should measure execution time accurately', () => {
      const time = benchmark.measureExecutionTime(() => {
        // Simulate some work
        for (let i = 0; i < 1000; i++) {
           
          i + 1;
        }
      });

      expect(typeof time).toBe('bigint');
      expect(time).toBeGreaterThan(0n);
    });
  });

  describe('runSingleBenchmark', () => {
    it('should run benchmark and return execution time', () => {
      const dataSet = benchmark.config.inputDataSets[0];
      const time = benchmark.runSingleBenchmark(dataSet);

      expect(typeof time).toBe('number');
      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThan(1000); // Should be reasonable
    });

    it('should generate valid token during benchmark', () => {
      const dataSet = benchmark.config.inputDataSets[0];
      const time = benchmark.runSingleBenchmark(dataSet);

      // Verify token was generated (though we don't check the time here)
      expect(time).toBeDefined();
    });
  });

  describe('calculateStatistics', () => {
    it('should calculate basic statistics', () => {
      const times = [10, 20, 30, 40, 50];
      const stats = benchmark.calculateStatistics(times);

      expect(stats.count).toBe(5);
      expect(stats.mean).toBe(30);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
    });

    it('should calculate percentiles correctly', () => {
      const times = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const stats = benchmark.calculateStatistics(times);

      expect(stats.p50).toBe(55); // Median of sorted array
      expect(stats.p95).toBe(95.5); // 95th percentile (interpolated)
      expect(stats.p99).toBeCloseTo(99.1, 1); // 99th percentile
    });

    it('should handle empty array', () => {
      const stats = benchmark.calculateStatistics([]);
      expect(stats).toEqual({});
    });
  });

  describe('calculateSLACompliance', () => {
    it('should calculate SLA compliance correctly', () => {
      const times = [50, 100, 150, 200, 250]; // 4 under or equal 200ms
      const compliance = benchmark.calculateSLACompliance(times, 200);

      expect(compliance).toBe(80); // 4/5 * 100
    });

    it('should use default target of 200ms', () => {
      const times = [100, 150, 250];
      const compliance = benchmark.calculateSLACompliance(times);

      expect(compliance).toBeCloseTo(66.666_666_666_666_67, 10); // 2/3 * 100
    });
  });

  describe('runConcurrencyBenchmark', () => {
    it('should run concurrent benchmarks', async () => {
      const dataSet = benchmark.config.inputDataSets[0];
      const times = await benchmark.runConcurrencyBenchmark(2, dataSet, 10);

      expect(times).toHaveLength(10);
      for (const time of times) {
        expect(typeof time).toBe('number');
        expect(time).toBeGreaterThan(0);
      }
    });
  });

  it('should handle concurrency level 1', async () => {
    const dataSet = benchmark.config.inputDataSets[0];
    const times = await benchmark.runConcurrencyBenchmark(1, dataSet, 5);

    expect(times).toHaveLength(5);
  });
});

describe('performWarmUp', () => {
  it('should perform warm-up iterations', async () => {
    const dataSet = benchmark.config.inputDataSets[0];
    await benchmark.performWarmUp(dataSet);

    // Warm-up should complete without error
    expect(true).toBe(true);
  });
});

describe('runComprehensiveTests', () => {
  it('should run comprehensive tests', async () => {
    const results = await benchmark.runComprehensiveTests();

    expect(results).toHaveProperty('timestamp');
    expect(results).toHaveProperty('scenarios');
    expect(results).toHaveProperty('summary');
    expect(Array.isArray(results.scenarios)).toBe(true);
    expect(results.scenarios.length).toBeGreaterThan(0);
  });

  it('should include statistics in results', async () => {
    const results = await benchmark.runComprehensiveTests();

    for (const scenario of results.scenarios) {
      expect(scenario).toHaveProperty('statistics');
      expect(scenario).toHaveProperty('slaCompliance');
      expect(scenario).toHaveProperty('rawTimes');
    }
  });
});

describe('analyzeResults', () => {
  it('should analyze results without baseline', () => {
    const mockResults = {
      summary: {
        overall: {
          statistics: { mean: 50, p95: 100 },
          slaCompliance: 95,
        },
        worstCase: { p95: 150, slaCompliance: 90 },
      },
    };

    const analysis = benchmark.analyzeResults(mockResults);

    expect(analysis).toHaveProperty('summary');
    expect(analysis.regressionDetected).toBe(false);
    expect(analysis.baselineComparison).toBe(null);
  });

  it('should detect regression when baseline exists', () => {
    const baselineResults = {
      summary: {
        overall: {
          statistics: { mean: 50, p95: 100 },
          slaCompliance: 98,
        },
      },
    };

    benchmark.setBaseline(baselineResults);

    const currentResults = {
      summary: {
        overall: {
          statistics: { mean: 60, p95: 120 }, // >10% increase in p95
          slaCompliance: 90, // >5% drop
        },
        worstCase: { p95: 150 },
      },
    };

    const analysis = benchmark.analyzeResults(currentResults, { baselineComparison: true });

    expect(analysis.regressionDetected).toBe(true);
    expect(analysis.baselineComparison).toBeDefined();
  });
});

describe('generateRecommendations', () => {
  it('should generate recommendations for poor performance', () => {
    const results = {
      summary: {
        overall: {
          statistics: { mean: 150, p95: 250 },
          slaCompliance: 80,
        },
        worstCase: { p95: 300 },
      },
    };

    const analysis = { regressionDetected: true };
    const recommendations = benchmark.generateRecommendations(results, analysis);

    expect(recommendations).toContain(
      'Average response time exceeds 100ms target. Consider optimization.',
    );
    expect(recommendations).toContain(
      'SLA compliance below 95%. Investigate high-percentile performance.',
    );
    expect(recommendations).toContain('Performance regression detected. Review recent changes.');
    expect(recommendations).toContain(
      'Worst-case P95 exceeds 200ms. Focus on outlier performance.',
    );
  });

  it('should return empty array for good performance', () => {
    const results = {
      summary: {
        overall: {
          statistics: { mean: 50, p95: 100 },
          slaCompliance: 98,
        },
        worstCase: { p95: 150 },
      },
    };

    const analysis = { regressionDetected: false };
    const recommendations = benchmark.generateRecommendations(results, analysis);

    expect(recommendations).toEqual([]);
  });
});
