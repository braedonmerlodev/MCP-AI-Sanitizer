// Mock dependencies
jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({
    text: 'Sample PDF text for performance testing',
    numpages: 1,
    info: { Title: 'Performance Test PDF' },
  });
});
jest.mock('../../components/MarkdownConverter');
jest.mock('../../components/AITextTransformer');
jest.mock('../../components/proxy-sanitizer');
jest.mock('../../components/AccessControlEnforcer');
jest.mock('../../utils/jsonRepair', () => ({
  default: {
    repair: jest.fn().mockReturnValue({
      success: true,
      data: { content: 'repaired content' },
    }),
  },
}));
jest.mock('../../components/data-integrity/AuditLogger');
jest.mock('../../models/JobStatus');
jest.mock('../../models/JobResult');

const processJob = require('../../workers/jobWorker');

describe('Threat Extraction Performance Tests', () => {
  const mockJobData = {
    id: 'perf-test-1',
    data: {
      content: 'Clean content for performance baseline testing',
    },
    options: {},
  };

  const mockJobDataWithThreats = {
    id: 'perf-test-2',
    data: {
      content: 'Content with potential threats for performance testing',
      sanitizationTests: { patterns: ['<script>alert(1)</script>'] },
      potentialXSS: { scripts: ['evil.js'] },
    },
    options: {},
  };

  beforeAll(() => {
    // Setup mock implementations
    const MarkdownConverter = require('../../components/MarkdownConverter');
    MarkdownConverter.prototype.convert = jest
      .fn()
      .mockReturnValue('Converted markdown for performance testing');

    const AITextTransformer = require('../../components/AITextTransformer');
    AITextTransformer.prototype.transform = jest.fn().mockResolvedValue({
      text: '{"content": "AI processed content for performance testing"}',
    });

    const ProxySanitizer = require('../../components/proxy-sanitizer');
    ProxySanitizer.prototype.sanitize = jest.fn().mockResolvedValue({
      sanitizedData: '{"content": "sanitized content for performance testing"}',
    });

    const AuditLogger = require('../../components/data-integrity/AuditLogger');
    AuditLogger.prototype.logEscalationDecision = jest.fn().mockResolvedValue();

    const JobStatus = require('../../models/JobStatus');
    JobStatus.load = jest.fn().mockResolvedValue({
      updateStatus: jest.fn().mockResolvedValue(),
      updateProgress: jest.fn().mockResolvedValue(),
    });

    const JobResult = require('../../models/JobResult');
    JobResult.prototype.save = jest.fn().mockResolvedValue();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Performance Impact Measurement', () => {
    it('should measure processing time for clean content (baseline)', async () => {
      const startTime = process.hrtime.bigint();

      await processJob(mockJobData);

      const endTime = process.hrtime.bigint();
      const processingTimeMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      console.log(`Clean content processing time: ${processingTimeMs.toFixed(2)}ms`);
      expect(processingTimeMs).toBeLessThan(100); // Should complete within reasonable time
    });

    it('should measure processing time for content with threats', async () => {
      const startTime = process.hrtime.bigint();

      await processJob(mockJobDataWithThreats);

      const endTime = process.hrtime.bigint();
      const processingTimeMs = Number(endTime - startTime) / 1000000;

      console.log(`Threat processing time: ${processingTimeMs.toFixed(2)}ms`);
      expect(processingTimeMs).toBeLessThan(150); // Allow slightly more time for threat processing
    });

    it('should validate performance overhead is under 1%', async () => {
      // Run multiple iterations to get average performance
      const iterations = 10;
      const cleanTimes = [];
      const threatTimes = [];

      for (let i = 0; i < iterations; i++) {
        // Clean content timing
        const cleanStart = process.hrtime.bigint();
        await processJob(mockJobData);
        const cleanEnd = process.hrtime.bigint();
        cleanTimes.push(Number(cleanEnd - cleanStart) / 1000000);

        // Threat content timing
        const threatStart = process.hrtime.bigint();
        await processJob(mockJobDataWithThreats);
        const threatEnd = process.hrtime.bigint();
        threatTimes.push(Number(threatEnd - threatStart) / 1000000);
      }

      const avgCleanTime = cleanTimes.reduce((a, b) => a + b) / cleanTimes.length;
      const avgThreatTime = threatTimes.reduce((a, b) => a + b) / threatTimes.length;
      const overheadPercent = ((avgThreatTime - avgCleanTime) / avgCleanTime) * 100;

      console.log(`Average clean processing time: ${avgCleanTime.toFixed(2)}ms`);
      console.log(`Average threat processing time: ${avgThreatTime.toFixed(2)}ms`);
      console.log(`Performance overhead: ${overheadPercent.toFixed(2)}%`);

      expect(overheadPercent).toBeLessThan(1); // Requirement: <1% overhead
    });

    it('should measure memory usage during threat extraction', async () => {
      const initialMemory = process.memoryUsage();

      await processJob(mockJobDataWithThreats);

      const finalMemory = process.memoryUsage();
      const memoryIncreaseMB = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      expect(memoryIncreaseMB).toBeLessThan(10); // Reasonable memory usage
    });
  });

  describe('Scalability Testing', () => {
    it('should handle large content without performance degradation', async () => {
      const largeContent = 'A'.repeat(10000); // 10KB content
      const largeJobData = {
        id: 'perf-test-large',
        data: {
          content: largeContent,
          sanitizationTests: { patterns: ['<script>'] },
          potentialXSS: { scripts: ['evil.js'] },
        },
        options: {},
      };

      const startTime = process.hrtime.bigint();

      await processJob(largeJobData);

      const endTime = process.hrtime.bigint();
      const processingTimeMs = Number(endTime - startTime) / 1000000;

      console.log(`Large content processing time: ${processingTimeMs.toFixed(2)}ms`);
      expect(processingTimeMs).toBeLessThan(500); // Should handle large content reasonably
    });

    it('should maintain performance with complex nested structures', async () => {
      const complexData = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  content: 'Deep nested content',
                  sanitizationTests: { deep: { threat: '<script>' } },
                  potentialXSS: { nested: { scripts: ['evil.js'] } },
                },
              },
            },
          },
        },
      };

      const complexJobData = {
        id: 'perf-test-complex',
        data: {
          content: JSON.stringify(complexData),
        },
        options: {},
      };

      const startTime = process.hrtime.bigint();

      await processJob(complexJobData);

      const endTime = process.hrtime.bigint();
      const processingTimeMs = Number(endTime - startTime) / 1000000;

      console.log(`Complex structure processing time: ${processingTimeMs.toFixed(2)}ms`);
      expect(processingTimeMs).toBeLessThan(200); // Complex structures should still be fast
    });
  });

  describe('Regression Performance Validation', () => {
    it('should ensure no performance regression for legitimate content', async () => {
      // Test various legitimate content types
      const testCases = [
        { content: 'Simple text content', type: 'text' },
        { content: JSON.stringify({ key: 'value' }), type: 'json' },
        { content: 'Content with special chars: àáâãäå', type: 'unicode' },
        { content: 'Very long content '.repeat(100), type: 'long' },
      ];

      for (const testCase of testCases) {
        const jobData = {
          id: `perf-regression-${testCase.type}`,
          data: { content: testCase.content },
          options: {},
        };

        const startTime = process.hrtime.bigint();
        await processJob(jobData);
        const endTime = process.hrtime.bigint();
        const processingTimeMs = Number(endTime - startTime) / 1000000;

        console.log(`${testCase.type} content processing time: ${processingTimeMs.toFixed(2)}ms`);
        expect(processingTimeMs).toBeLessThan(100); // All legitimate content should process quickly
      }
    });

    it('should validate consistent performance across multiple runs', async () => {
      const runTimes = [];

      for (let i = 0; i < 5; i++) {
        const startTime = process.hrtime.bigint();
        await processJob(mockJobData);
        const endTime = process.hrtime.bigint();
        const processingTimeMs = Number(endTime - startTime) / 1000000;
        runTimes.push(processingTimeMs);
      }

      const avgTime = runTimes.reduce((a, b) => a + b) / runTimes.length;
      const variance =
        runTimes.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / runTimes.length;
      const stdDev = Math.sqrt(variance);

      console.log(`Average processing time: ${avgTime.toFixed(2)}ms`);
      console.log(`Standard deviation: ${stdDev.toFixed(2)}ms`);

      expect(stdDev).toBeLessThan(10); // Performance should be consistent
    });
  });
});
