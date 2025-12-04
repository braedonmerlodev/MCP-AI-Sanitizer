// Edge Case Tests for Agent Message System
// Tests boundary conditions, error scenarios, and stress conditions
// Story 6: Agent Message Integration Testing

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/routes/api');
const jobStatusRoutes = require('../../src/routes/jobStatus');

// Mock WebSocket for edge case testing
jest.mock('ws', () => ({
  Server: jest.fn().mockImplementation(() => ({
    clients: new Set(),
    on: jest.fn(),
    close: jest.fn(),
  })),
  WebSocket: jest.fn(),
}));

// Mock external dependencies
jest.mock('../../src/components/MarkdownConverter', () => ({
  MarkdownConverter: jest.fn().mockImplementation(() => ({
    convert: jest.fn().mockReturnValue('# Test PDF Content\n\nThis is test PDF content.'),
  })),
}));

jest.mock('../../src/middleware/AccessValidationMiddleware', () =>
  jest.fn((req, res, next) => next()),
);

jest.mock('../../src/components/AccessControlEnforcer', () => ({
  AccessControlEnforcer: jest.fn().mockImplementation(() => ({
    enforce: jest.fn().mockReturnValue({ allowed: true }),
  })),
}));

jest.mock('../../src/components/TrustTokenGenerator', () => ({
  TrustTokenGenerator: jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockReturnValue({
      contentHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
      originalHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
      sanitizationVersion: '1.0',
      rulesApplied: ['symbol_stripping'],
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      signature: 'mock-signature',
    }),
    validateToken: jest.fn().mockReturnValue({ isValid: true }),
  })),
}));

describe('Agent Message Edge Cases - Story 6', () => {
  let app;
  let mockWebSocketServer;

  beforeAll(() => {
    // Setup mock WebSocket server
    mockWebSocketServer = {
      clients: new Set(),
      on: jest.fn(),
      close: jest.fn(),
    };

    // Mock WebSocket client
    const mockWebSocketClient = {
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
      readyState: 1, // OPEN
    };

    mockWebSocketServer.clients.add(mockWebSocketClient);
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    app.use('/api/job-status', jobStatusRoutes);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Large Message Handling', () => {
    test('should handle PDF uploads with large file sizes (10MB+)', async () => {
      // Create a large PDF buffer (simulating 10MB)
      const largePdfBuffer = Buffer.alloc(10 * 1024 * 1024, '%PDF-1.4\n%EOF');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', largePdfBuffer, 'large-test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('job_id');

      // Verify agent message was generated for large file
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      expect(mockWebSocketClient.send).toHaveBeenCalled();

      const sentMessage = JSON.parse(mockWebSocketClient.send.mock.calls[0][0]);
      expect(sentMessage.content.summary).toContain('processed successfully');
    });

    test('should handle sanitization of large JSON payloads', async () => {
      // Create large JSON payload (5MB of data)
      const largeData = {
        content: JSON.stringify({
          user: 'test@example.com',
          message: 'x'.repeat(1024 * 1024 * 5), // 5MB string
          metadata: {
            largeArray: Array.from({ length: 10000 }, (_, i) => ({
              id: i,
              data: 'test'.repeat(100),
            })),
          },
        }),
        classification: 'user_input',
      };

      const response = await request(app).post('/api/sanitize/json').send(largeData).expect(200);

      expect(response.body).toHaveProperty('sanitizedContent');
      expect(response.body).toHaveProperty('trustToken');

      // Verify the large content was processed
      const sanitized = JSON.parse(response.body.sanitizedContent);
      expect(sanitized.message).toBeDefined();
      expect(sanitized.metadata.largeArray).toHaveLength(10000);
    });

    test('should maintain performance with large concurrent messages', async () => {
      const largeMessagePromises = Array.from({ length: 5 }, async (_, i) => {
        const largePdfBuffer = Buffer.alloc(5 * 1024 * 1024, `%PDF-1.4\n${i}\n%EOF`);

        const start = process.hrtime.bigint();
        const response = await request(app)
          .post('/api/documents/upload')
          .attach('pdf', largePdfBuffer, `large-concurrent-${i}.pdf`)
          .expect(200);
        const end = process.hrtime.bigint();

        const duration = Number(end - start) / 1_000_000; // ms
        return { response, duration };
      });

      const results = await Promise.all(largeMessagePromises);

      // All requests should succeed
      results.forEach(({ response }) => {
        expect(response.body).toHaveProperty('job_id');
      });

      // Performance should be reasonable (under 5 seconds each for large files)
      results.forEach(({ duration }) => {
        expect(duration).toBeLessThan(5000);
      });

      console.log(
        `Large concurrent messages performance: ${results.map((r) => r.duration.toFixed(2)).join(', ')}ms`,
      );
    });
  });

  describe('Rapid Firing Scenarios', () => {
    test('should handle rapid sequential PDF uploads', async () => {
      const uploadCount = 20;
      const uploadPromises = [];

      for (let i = 0; i < uploadCount; i++) {
        uploadPromises.push(
          request(app)
            .post('/api/documents/upload')
            .attach('pdf', Buffer.from('%PDF-1.4\n%EOF'), `rapid-${i}.pdf`)
            .expect(200),
        );
      }

      const responses = await Promise.all(uploadPromises);

      // All uploads should succeed
      responses.forEach((response) => {
        expect(response.body).toHaveProperty('job_id');
      });

      // All agent messages should be sent
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      expect(mockWebSocketClient.send).toHaveBeenCalledTimes(uploadCount);

      // Verify message ordering
      const messages = mockWebSocketClient.send.mock.calls.map(([data]) => JSON.parse(data));

      // Messages should have unique IDs and proper timestamps
      const messageIds = messages.map((msg) => msg.messageId);
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).toBe(uploadCount);
    });

    test('should handle burst traffic patterns', async () => {
      // Simulate burst traffic: 10 requests in rapid succession
      const burstPromises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/sanitize/json')
          .send({
            content: JSON.stringify({ burst: i, data: 'x'.repeat(1000) }),
            classification: 'user_input',
          })
          .expect(200),
      );

      const startTime = Date.now();
      const responses = await Promise.all(burstPromises);
      const endTime = Date.now();

      const totalDuration = endTime - startTime;

      // All sanitization requests should succeed
      responses.forEach((response) => {
        expect(response.body).toHaveProperty('sanitizedContent');
      });

      // Burst should complete within reasonable time (under 2 seconds for 10 requests)
      expect(totalDuration).toBeLessThan(2000);

      console.log(`Burst traffic completed in ${totalDuration}ms`);
    });

    test('should maintain message ordering under rapid fire conditions', async () => {
      const messageCount = 15;
      const messagePromises = [];

      // Send messages with small delays to test ordering
      for (let i = 0; i < messageCount; i++) {
        messagePromises.push(
          request(app)
            .post('/api/documents/upload')
            .attach('pdf', Buffer.from(`%PDF-1.4\n${i}\n%EOF`), `ordering-${i}.pdf`)
            .expect(200),
        );
        // Small delay to ensure ordering
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await Promise.all(messagePromises);

      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      const messages = mockWebSocketClient.send.mock.calls.map(([data]) => JSON.parse(data));

      // Verify chronological ordering
      for (let i = 1; i < messages.length; i++) {
        const prevTime = new Date(messages[i - 1].content.timestamp);
        const currTime = new Date(messages[i].content.timestamp);
        expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
      }
    });
  });

  describe('Network Interruption Handling', () => {
    test('should handle WebSocket disconnection during message transmission', async () => {
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];

      // Simulate disconnection during message send
      mockWebSocketClient.send.mockImplementationOnce(() => {
        mockWebSocketClient.readyState = 3; // CLOSED
        throw new Error('WebSocket connection lost');
      });

      // System should continue processing even if WebSocket fails
      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('%PDF-1.4\n%EOF'), 'disconnect-test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('job_id');

      // WebSocket send should have been attempted
      expect(mockWebSocketClient.send).toHaveBeenCalled();
    });

    test('should recover from temporary network issues', async () => {
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];

      // Simulate intermittent connection issues
      let callCount = 0;
      mockWebSocketClient.send.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          // Every 3rd call fails
          throw new Error('Temporary network error');
        }
      });

      // Send multiple messages to test recovery
      for (let i = 0; i < 9; i++) {
        await request(app)
          .post('/api/documents/upload')
          .attach('pdf', Buffer.from('%PDF-1.4\n%EOF'), `recovery-${i}.pdf`)
          .expect(200);
      }

      // Should have attempted to send 9 messages
      expect(mockWebSocketClient.send).toHaveBeenCalledTimes(9);
    });

    test('should handle request timeouts gracefully', async () => {
      // Test with a very large payload that might cause timeouts
      const hugePayload = {
        content: JSON.stringify({
          data: 'x'.repeat(1024 * 1024 * 10), // 10MB string
        }),
        classification: 'user_input',
      };

      // Set a reasonable timeout for the test
      const response = await request(app)
        .post('/api/sanitize/json')
        .timeout(10000) // 10 second timeout
        .send(hugePayload);

      // Should either succeed or fail gracefully (not hang)
      expect([200, 413, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('sanitizedContent');
      }
    });
  });

  describe('Malformed Data Handling', () => {
    test('should handle corrupted PDF files', async () => {
      const corruptedPdf = Buffer.from('This is not a PDF file at all!');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', corruptedPdf, 'corrupted.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/Invalid file type|corrupted|malformed/i);
    });

    test('should handle invalid JSON in sanitization requests', async () => {
      const invalidJsonPayloads = [
        { content: '{invalid json', classification: 'user_input' },
        { content: '{"incomplete":', classification: 'user_input' },
        { content: 'null', classification: 'user_input' },
        { content: 'undefined', classification: 'user_input' },
      ];

      for (const payload of invalidJsonPayloads) {
        const response = await request(app).post('/api/sanitize/json').send(payload).expect(200); // Should handle gracefully, not crash

        // Should still return a response (may be error response or sanitized version)
        expect(response.body).toBeDefined();
      }
    });

    test('should handle extreme edge cases in message content', async () => {
      const edgeCasePayloads = [
        { content: JSON.stringify({ empty: '' }), classification: 'user_input' },
        {
          content: JSON.stringify({ nested: { deep: { very: { deeply: { nested: 'value' } } } } }),
          classification: 'user_input',
        },
        { content: JSON.stringify({ unicode: '🚀📦🔒🛡️' }), classification: 'user_input' },
        { content: JSON.stringify({ special: '<>&"\'\n\t\r' }), classification: 'user_input' },
      ];

      for (const payload of edgeCasePayloads) {
        const response = await request(app).post('/api/sanitize/json').send(payload).expect(200);

        expect(response.body).toHaveProperty('sanitizedContent');
        expect(response.body).toHaveProperty('trustToken');

        // Verify sanitization worked
        const sanitized = JSON.parse(response.body.sanitizedContent);
        expect(sanitized).toBeDefined();
      }
    });

    test('should handle concurrent malformed requests', async () => {
      const malformedRequests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/sanitize/json')
          .send({ content: '{malformed json', classification: 'user_input' })
          .expect(200),
      );

      const responses = await Promise.all(malformedRequests);

      // All requests should be handled gracefully
      responses.forEach((response) => {
        expect(response.body).toBeDefined();
      });
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle minimum valid PDF', async () => {
      const minimalPdf = Buffer.from('%PDF-1.4\n%EOF');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', minimalPdf, 'minimal.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('job_id');
    });

    test('should handle maximum file size boundary', async () => {
      // Test exactly at the 10MB limit
      const maxSizePdf = Buffer.alloc(10 * 1024 * 1024 - 100, '%PDF-1.4\n');
      maxSizePdf.write('%EOF', maxSizePdf.length - 4);

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', maxSizePdf, 'max-size.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('job_id');
    });

    test('should reject files over size limit', async () => {
      // Test over the 10MB limit
      const oversizedPdf = Buffer.alloc(11 * 1024 * 1024, '%PDF-1.4\n%EOF');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', oversizedPdf, 'oversized.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('File too large');
    });

    test('should handle empty and whitespace-only content', async () => {
      const emptyPayloads = [
        { content: '', classification: 'user_input' },
        { content: '   ', classification: 'user_input' },
        { content: '\n\t\r', classification: 'user_input' },
        { content: JSON.stringify({ empty: '', whitespace: '   ' }), classification: 'user_input' },
      ];

      for (const payload of emptyPayloads) {
        const response = await request(app).post('/api/sanitize/json').send(payload).expect(200);

        expect(response.body).toHaveProperty('sanitizedContent');
      }
    });

    test('should handle maximum concurrent connections', async () => {
      // Test with high concurrency (simulating many simultaneous users)
      const concurrentRequests = 25; // Higher than typical load test

      const concurrentPromises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .post('/api/sanitize/json')
          .send({
            content: JSON.stringify({ concurrent: i, data: `test-${i}` }),
            classification: 'user_input',
          })
          .expect(200),
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentPromises);
      const endTime = Date.now();

      const totalDuration = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.body).toHaveProperty('sanitizedContent');
      });

      // Should complete within reasonable time
      expect(totalDuration).toBeLessThan(5000); // 5 seconds for 25 concurrent requests

      console.log(`High concurrency test: ${concurrentRequests} requests in ${totalDuration}ms`);
    });
  });

  describe('Stress Testing', () => {
    test('should maintain stability under prolonged load', async () => {
      const testDuration = 30000; // 30 seconds
      const startTime = Date.now();
      let requestCount = 0;

      // Send requests continuously for the test duration
      while (Date.now() - startTime < testDuration) {
        await request(app)
          .post('/api/sanitize/json')
          .send({
            content: JSON.stringify({ stress: requestCount++, time: Date.now() }),
            classification: 'user_input',
          })
          .expect(200);

        // Small delay to prevent overwhelming the test
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const actualDuration = Date.now() - startTime;
      console.log(`Stress test completed: ${requestCount} requests in ${actualDuration}ms`);

      // Should have completed a reasonable number of requests
      expect(requestCount).toBeGreaterThan(10);
      expect(actualDuration).toBeGreaterThanOrEqual(testDuration - 1000); // Allow 1s variance
    });

    test('should handle memory-intensive operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      const memoryTestPromises = Array.from({ length: 10 }, async (_, i) => {
        const largeContent = 'x'.repeat(1024 * 1024); // 1MB string
        return request(app)
          .post('/api/sanitize/json')
          .send({
            content: JSON.stringify({ large: largeContent, index: i }),
            classification: 'user_input',
          })
          .expect(200);
      });

      await Promise.all(memoryTestPromises);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB

      console.log(`Memory stress test: ${memoryIncrease / 1024 / 1024}MB increase`);
    });

    test('should recover from error bursts', async () => {
      // Mix of valid and invalid requests
      const mixedRequests = Array.from({ length: 20 }, (_, i) => {
        const isValid = i % 4 !== 0; // 25% error rate

        if (isValid) {
          return request(app)
            .post('/api/sanitize/json')
            .send({
              content: JSON.stringify({ valid: i }),
              classification: 'user_input',
            })
            .expect(200);
        } else {
          return request(app)
            .post('/api/documents/upload')
            .attach('pdf', Buffer.from('invalid'), `invalid-${i}.pdf`)
            .expect(400);
        }
      });

      const responses = await Promise.all(mixedRequests);

      // Count successes and failures
      const successCount = responses.filter((r) => r.status === 200).length;
      const failureCount = responses.filter((r) => r.status === 400).length;

      expect(successCount).toBe(15); // 75% success
      expect(failureCount).toBe(5); // 25% failure

      console.log(`Error burst recovery: ${successCount} successes, ${failureCount} failures`);
    });
  });
});
