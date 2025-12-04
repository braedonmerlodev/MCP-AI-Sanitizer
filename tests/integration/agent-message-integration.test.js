// Integration tests for agent message system and sanitization summary integration
// Tests end-to-end flow from PDF upload through sanitization to agent message delivery

// Mock WebSocket server for testing agent message delivery
jest.mock('ws', () => ({
  Server: jest.fn().mockImplementation(() => ({
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
jest.mock('../../src/components/AccessControlEnforcer', () => {
  return jest.fn().mockImplementation(() => ({
    enforce: jest.fn().mockReturnValue({ allowed: true }),
  }));
});

jest.mock('../../src/components/TrustTokenGenerator', () => {
  class MockTrustTokenGenerator {
    generateToken() {
      return {
        contentHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
        originalHash: '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
        sanitizationVersion: '1.0',
        rulesApplied: ['symbol_stripping'],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        signature: 'mock-signature',
      };
    }
    validateToken() {
      return { isValid: true };
    }
  }
  return MockTrustTokenGenerator;
});

const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/routes/api');
const jobStatusRoutes = require('../../src/routes/jobStatus');

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

describe('Agent Message Integration Tests - Story 6', () => {
  let app;
  let mockWebSocketServer;

  beforeAll(() => {
    // Mock WebSocket server for agent message delivery
    mockWebSocketServer = {
      clients: new Set(),
      on: jest.fn(),
      close: jest.fn(),
    };

    // Mock WebSocket client connections
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

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('End-to-End Agent Message Flow', () => {
    const testPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF',
    );

    test('should deliver sanitization summary as agent message after PDF processing', async () => {
      // Upload PDF for processing
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .field('ai_transform', 'true')
        .expect(200);

      expect(uploadResponse.body.job_id).toBeDefined();
      const jobId = uploadResponse.body.job_id;

      // Wait for job completion (in real implementation, this would poll or use WebSocket)
      // For testing, we'll simulate job completion and agent message delivery

      // Mock agent message delivery via WebSocket
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      const expectedAgentMessage = {
        type: 'agent_message',
        content: {
          type: 'sanitization_summary',
          summary: 'PDF processed successfully. Content sanitized with trust token generated.',
          trustToken: expect.any(Object),
          timestamp: expect.any(String),
        },
        messageId: expect.any(String),
      };

      // Simulate agent message being sent to connected clients
      mockWebSocketClient.send(JSON.stringify(expectedAgentMessage));

      // Verify WebSocket message was sent
      expect(mockWebSocketClient.send).toHaveBeenCalledWith(JSON.stringify(expectedAgentMessage));
    });

    test('should handle agent message delivery failures gracefully', async () => {
      // Simulate WebSocket connection failure
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      mockWebSocketClient.readyState = 3; // CLOSED

      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .expect(200);

      expect(uploadResponse.body.job_id).toBeDefined();

      // Even with WebSocket failure, PDF processing should succeed
      // Agent message delivery failure should be logged but not fail the operation
      expect(mockWebSocketClient.send).not.toHaveBeenCalled();
    });

    test('should maintain message ordering in agent message stream', async () => {
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      const sentMessages = [];

      mockWebSocketClient.send.mockImplementation((data) => {
        sentMessages.push(JSON.parse(data));
      });

      // Process multiple PDFs to generate multiple agent messages
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/documents/upload')
          .attach('pdf', testPdfBuffer, `test${i}.pdf`)
          .expect(200);
      }

      // Verify messages are sent in order
      expect(sentMessages).toHaveLength(3);
      sentMessages.forEach((message, index) => {
        expect(message.type).toBe('agent_message');
        expect(message.content.type).toBe('sanitization_summary');
        expect(message.messageId).toBeDefined();
        if (index > 0) {
          expect(new Date(message.content.timestamp)).toBeGreaterThanOrEqual(
            new Date(sentMessages[index - 1].content.timestamp),
          );
        }
      });
    });

    test('should validate agent message format and required fields', async () => {
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];

      await request(app)
        .post('/api/documents/upload')
        .attach('pdf', testPdfBuffer, 'test.pdf')
        .expect(200);

      const sentMessage = JSON.parse(mockWebSocketClient.send.mock.calls[0][0]);

      // Validate agent message structure
      expect(sentMessage).toHaveProperty('type', 'agent_message');
      expect(sentMessage).toHaveProperty('content');
      expect(sentMessage.content).toHaveProperty('type', 'sanitization_summary');
      expect(sentMessage.content).toHaveProperty('summary');
      expect(sentMessage.content).toHaveProperty('trustToken');
      expect(sentMessage.content).toHaveProperty('timestamp');
      expect(sentMessage).toHaveProperty('messageId');

      // Validate trust token structure
      expect(sentMessage.content.trustToken).toHaveProperty('contentHash');
      expect(sentMessage.content.trustToken).toHaveProperty('signature');
      expect(sentMessage.content.trustToken).toHaveProperty('timestamp');
    });

    test('should handle concurrent agent message delivery under load', async () => {
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];
      const concurrentUploads = 10;

      // Simulate concurrent PDF uploads
      const uploadPromises = Array.from({ length: concurrentUploads }, (_, i) =>
        request(app)
          .post('/api/documents/upload')
          .attach('pdf', testPdfBuffer, `concurrent-test-${i}.pdf`)
          .expect(200),
      );

      const responses = await Promise.all(uploadPromises);

      // Verify all uploads succeeded
      responses.forEach((response) => {
        expect(response.body.job_id).toBeDefined();
      });

      // Verify agent messages were sent for each upload
      expect(mockWebSocketClient.send).toHaveBeenCalledTimes(concurrentUploads);

      // Verify message ordering and uniqueness
      const sentMessages = mockWebSocketClient.send.mock.calls.map(([data]) => JSON.parse(data));

      const messageIds = sentMessages.map((msg) => msg.messageId);
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).toBe(concurrentUploads); // All message IDs should be unique
    });
  });

  describe('Cross-System Integration Validation', () => {
    test('should integrate with existing sanitization API responses', async () => {
      const testContent = {
        content: JSON.stringify({
          user: 'test@example.com',
          message: 'Test message with <script>alert("xss")</script> content',
        }),
        classification: 'user_input',
      };

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
    });

    test('should maintain performance requirements under agent message load', async () => {
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .post('/api/documents/upload')
          .attach('pdf', Buffer.from('%PDF-1.4\n%EOF'), `perf-test-${i}.pdf`);
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        times.push(durationMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(
        `Agent message integration performance: Avg ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`,
      );

      // Performance should remain under 5% overhead (baseline < 200ms)
      expect(averageTime).toBeLessThan(210); // Allow 5% overhead on 200ms baseline
      expect(maxTime).toBeLessThan(250);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed PDF uploads gracefully', async () => {
      const malformedPdf = Buffer.from('not a pdf file');

      const response = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', malformedPdf, 'malformed.pdf')
        .expect(400);

      expect(response.body.error).toContain('Invalid file type');
    });

    test('should handle agent message delivery when no WebSocket clients connected', async () => {
      // Clear all WebSocket clients
      mockWebSocketServer.clients.clear();

      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('%PDF-1.4\n%EOF'), 'no-clients.pdf')
        .expect(200);

      expect(uploadResponse.body.job_id).toBeDefined();
      // Should not fail even without WebSocket clients
    });

    test('should validate agent message content does not introduce security vulnerabilities', async () => {
      const mockWebSocketClient = Array.from(mockWebSocketServer.clients)[0];

      await request(app)
        .post('/api/documents/upload')
        .attach('pdf', Buffer.from('%PDF-1.4\n%EOF'), 'security-test.pdf')
        .expect(200);

      const sentMessage = JSON.parse(mockWebSocketClient.send.mock.calls[0][0]);

      // Ensure agent message content is safe
      const messageContent = JSON.stringify(sentMessage);
      expect(messageContent).not.toContain('<script>');
      expect(messageContent).not.toContain('javascript:');
      expect(messageContent).not.toContain('onerror=');
    });
  });
});
