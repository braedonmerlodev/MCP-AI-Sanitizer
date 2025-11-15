const { performance } = require('node:perf_hooks');
const app = require('../../app');
const request = require('supertest');

describe('Performance Validation', () => {
  const testContent = 'Test content for performance measurement ' + 'x'.repeat(1000);
  const iterations = 100;

  describe('Sync Operation Baseline', () => {
    it('should measure baseline performance for sync sanitize/json', async () => {
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await request(app)
          .post('/api/sanitize/json')
          .send({ content: testContent, async: false })
          .expect(200);

        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(
        `Sync baseline - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`,
      );

      // Store baseline for comparison
      globalThis.syncBaseline = avgTime;
    });
  });

  describe('Async Detection Overhead', () => {
    it('should measure performance impact of async detection', async () => {
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await request(app)
          .post('/api/sanitize/json')
          .send({ content: testContent }) // No async param - should trigger sync
          .expect(200);

        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const overhead = ((avgTime - globalThis.syncBaseline) / globalThis.syncBaseline) * 100;

      console.log(`Async detection overhead: ${overhead.toFixed(2)}%`);

      // Validate <5% overhead
      expect(overhead).toBeLessThan(5);
    });
  });

  describe('Large File Async Processing', () => {
    it('should handle large file async submission efficiently', async () => {
      const largeContent = 'x'.repeat(15 * 1024 * 1024); // 15MB content

      const start = performance.now();

      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content: largeContent, async: true })
        .expect(200);

      const end = performance.now();
      const submissionTime = end - start;

      console.log(`Large file async submission: ${submissionTime.toFixed(2)}ms`);

      expect(response.body.taskId).toBeDefined();
      expect(response.body.status).toBe('processing');
      expect(submissionTime).toBeLessThan(200); // Should submit within 200ms
    });
  });

  describe('Job Status Polling Performance', () => {
    it('should handle job status polling efficiently', async () => {
      // First create a job
      const response = await request(app)
        .post('/api/sanitize/json')
        .send({ content: testContent, async: true })
        .expect(200);

      const taskId = response.body.taskId;
      const times = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();

        await request(app).get(`/api/jobs/${taskId}`).expect(200);

        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`Job status polling - Avg: ${avgTime.toFixed(2)}ms`);

      expect(avgTime).toBeLessThan(50); // Should respond within 50ms
    });
  });
});
