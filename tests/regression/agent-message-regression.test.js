// Automated Regression Test Suite for Agent Message Functionality
// These tests ensure that agent message features continue working after code changes
// Run these tests as part of CI/CD pipeline to catch regressions early

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/routes/api');
const jobStatusRoutes = require('../../src/routes/jobStatus');

// Mock WebSocket for regression testing
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

describe('Agent Message Regression Test Suite - Story 6', () => {
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

  describe('Regression: PDF Processing Agent Message Generation', () => {
    const testPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
    );

    test('REGRESSION: PDF upload should trigger agent message generation', async () => {
      // This test ensures that PDF uploads continue to generate agent messages
      // Regression protection: If agent message generation is broken, this will fail

      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('job_id');

      // Verify agent message was queued for sending
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      expect(mockWebSocketClient.send).toHaveBeenCalled();

      const sentMessage = JSON.parse(mockWebSocketClient.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('agent_message');
      expect(sentMessage.content.type).toBe('sanitization_summary');
    });

    test('REGRESSION: Agent message should contain required sanitization data', async () => {
      // Regression protection: Ensures agent messages always include critical sanitization info

      await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .expect(200);

      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      const sentMessage = JSON.parse(mockWebSocketClient.send.mock.calls[0][0]);

      // Verify all required fields are present
      expect(sentMessage).toHaveProperty('type', 'agent_message');
      expect(sentMessage).toHaveProperty('content');
      expect(sentMessage.content).toHaveProperty('type', 'sanitization_summary');
      expect(sentMessage.content).toHaveProperty('summary');
      expect(sentMessage.content).toHaveProperty('trustToken');
      expect(sentMessage.content).toHaveProperty('timestamp');
      expect(sentMessage).toHaveProperty('messageId');
    });

    test('REGRESSION: Agent message trust token should be valid', async () => {
      // Regression protection: Ensures trust tokens in agent messages remain valid

      await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .expect(200);

      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      const sentMessage = JSON.parse(mockWebSocketClient.send.mock.calls[0][0]);

      const trustToken = sentMessage.content.trustToken;
      expect(trustToken).toHaveProperty('contentHash');
      expect(trustToken).toHaveProperty('signature');
      expect(trustToken).toHaveProperty('timestamp');
      expect(trustToken).toHaveProperty('expiresAt');

      // Verify signature format (basic check)
      expect(typeof trustToken.signature).toBe('string');
      expect(trustToken.signature.length).toBeGreaterThan(0);
    });
  });

  describe('Regression: Sanitization API Agent Message Integration', () => {
    test('REGRESSION: Sanitization requests should not interfere with agent messages', async () => {
      // Regression protection: Ensures sanitization API changes don't break agent message system

      const testContent = {
        content: JSON.stringify({
          user: 'test@example.com',
          message: 'Test message with <script>alert("xss")</script> content',
        }),
        classification: 'user_input',
      };

      // Perform sanitization request
      const sanitizeResponse = await request(app)
        .post('/api/sanitize/json')
        .send(testContent)
        .expect(200);

      expect(sanitizeResponse.body).toHaveProperty('sanitizedContent');
      expect(sanitizeResponse.body).toHaveProperty('trustToken');

      // Verify sanitization worked
      const sanitized = JSON.parse(sanitizeResponse.body.sanitizedContent);
      expect(sanitized.message).not.toContain('<script>');
      expect(sanitized.message).not.toContain('alert("xss")');

      // Ensure no agent messages were triggered by sanitization alone
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      expect(mockWebSocketClient.send).not.toHaveBeenCalled();
    });

    test('REGRESSION: Trust token validation should work in agent message context', async () => {
      // Regression protection: Ensures trust token validation continues working

      const testContent = {
        content: JSON.stringify({ test: 'data' }),
        classification: 'user_input',
      };

      const response1 = await request(app).post('/api/sanitize/json').send(testContent).expect(200);

      const trustToken = response1.body.trustToken;

      // Reuse the trust token
      const response2 = await request(app)
        .post('/api/sanitize/json')
        .send({
          content: testContent.content,
          trustToken: trustToken,
        })
        .expect(200);

      expect(response2.body.metadata.reused).toBe(true);
      expect(response2.body.sanitizedContent).toBe(response1.body.sanitizedContent);
    });
  });

  describe('Regression: Message Ordering and Sequencing', () => {
    test('REGRESSION: Agent messages should maintain chronological ordering', async () => {
      // Regression protection: Ensures message ordering logic doesn't break

      // Send multiple PDF uploads
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/documents/upload')
          .attach('pdf', testPdfBuffer, `test${i}.pdf`)
          .expect(200);
      }

      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      expect(mockWebSocketClient.send).toHaveBeenCalledTimes(3);

      // Verify messages are sent in order
      const messages = mockWebSocketClient.send.mock.calls.map(([data]) => JSON.parse(data));

      // Check timestamps are in ascending order
      for (let i = 1; i < messages.length; i++) {
        const prevTime = new Date(messages[i - 1].content.timestamp);
        const currTime = new Date(messages[i].content.timestamp);
        expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
      }
    });

    test('REGRESSION: Message IDs should be unique', async () => {
      // Regression protection: Ensures message ID generation remains unique

      // Send multiple requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/documents/upload')
          .attach('pdf', testPdfBuffer, `test${i}.pdf`)
          .expect(200);
      }

      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      const messages = mockWebSocketClient.send.mock.calls.map(([data]) => JSON.parse(data));

      const messageIds = messages.map((msg) => msg.messageId);
      const uniqueIds = new Set(messageIds);

      expect(uniqueIds.size).toBe(messageIds.length); // All IDs should be unique
      expect(messageIds.length).toBe(5);
    });
  });

  describe('Regression: Error Handling and Resilience', () => {
    test('REGRESSION: System should handle malformed PDF uploads gracefully', async () => {
      // Regression protection: Ensures error handling for invalid PDFs doesn't break

      const malformedPdf = Buffer.from('not a pdf file');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', malformedPdf, 'malformed.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid file type');

      // Ensure no agent messages are sent for failed uploads
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      expect(mockWebSocketClient.send).not.toHaveBeenCalled();
    });

    test('REGRESSION: WebSocket failures should not crash the system', async () => {
      // Regression protection: Ensures WebSocket failures are handled gracefully

      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      mockWebSocketClient.send.mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      });

      // System should still process the request even if WebSocket fails
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('job_id');

      // WebSocket send was attempted (and failed)
      expect(mockWebSocketClient.send).toHaveBeenCalled();
    });

    test('REGRESSION: Concurrent requests should not cause race conditions', async () => {
      // Regression protection: Ensures concurrent processing doesn't cause issues

      const concurrentUploads = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/documents/upload')
          .attach('pdf', testPdfBuffer, `concurrent-${i}.pdf`)
          .expect(200),
      );

      const responses = await Promise.all(concurrentUploads);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.body).toHaveProperty('job_id');
      });

      // All agent messages should be sent
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      expect(mockWebSocketClient.send).toHaveBeenCalledTimes(10);
    });
  });

  describe('Regression: Performance Baselines', () => {
    test('REGRESSION: Agent message generation should maintain performance', async () => {
      // Regression protection: Ensures performance doesn't degrade

      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .post('/api/documents/upload')
          .attach('pdf', testPdfBuffer, `perf-test-${i}.pdf`);
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // Performance should not exceed baseline (allowing some variance for CI)
      expect(averageTime).toBeLessThan(500); // Baseline: < 500ms average
      expect(maxTime).toBeLessThan(1000); // Baseline: < 1000ms max

      console.log(
        `Regression performance test: Avg ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );
    });

    test('REGRESSION: Memory usage should not grow unbounded', async () => {
      // Regression protection: Ensures no memory leaks in agent message processing

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple operations
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post('/api/documents/upload')
          .attach('pdf', testPdfBuffer, `memory-test-${i}.pdf`)
          .expect(200);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB for 20 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory regression test: ${memoryIncrease / 1024 / 1024}MB increase`);
    });
  });

  describe('Regression: API Contract Stability', () => {
    test('REGRESSION: Agent message API contract should remain stable', async () => {
      // Regression protection: Ensures API contracts don't break

      await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'contract-test.pdf')
        .expect(200);

      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      const sentMessage = JSON.parse(mockWebSocketClient.send.mock.calls[0][0]);

      // Verify exact API contract structure
      expect(sentMessage).toEqual(
        expect.objectContaining({
          type: 'agent_message',
          content: expect.objectContaining({
            type: 'sanitization_summary',
            summary: expect.any(String),
            trustToken: expect.objectContaining({
              contentHash: expect.any(String),
              signature: expect.any(String),
              timestamp: expect.any(String),
              expiresAt: expect.any(String),
            }),
            timestamp: expect.any(String),
          }),
          messageId: expect.any(String),
        }),
      );
    });

    test('REGRESSION: Job status API should remain compatible', async () => {
      // Regression protection: Ensures job status tracking works

      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'job-test.pdf')
        .expect(200);

      const jobId = uploadResponse.body.job_id;

      const statusResponse = await request(app).get(`/api/job-status/${jobId}`).expect(200);

      expect(statusResponse.body).toHaveProperty('status');
      expect(statusResponse.body).toHaveProperty('job_id', jobId);
    });
  });
});
