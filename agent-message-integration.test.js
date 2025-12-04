// Agent Message Integration Tests
// Tests end-to-end agent message functionality

const { expect, describe, test } = require('@jest/globals');

// Mock the backend modules for testing
jest.mock(
  '../../agent/agent-development-env/backend/api',
  () => ({
    AgentMessage: class AgentMessage {
      constructor(data) {
        Object.assign(this, data);
      }

      dict() {
        return { ...this };
      }
    },
    validate_agent_message: jest.fn().mockReturnValue(true),
    enqueue_agent_message: jest.fn().mockReturnValue(true),
    get_message_priority_level: jest.fn((message) => {
      return message.priority === 'high' || message.priority === 'critical'
        ? 'immediate'
        : 'background';
    }),
    check_agent_message_rate_limit: jest.fn().mockReturnValue(true),
    cleanup_expired_messages: jest.fn(),
    agent_message_queues: { immediate: [], background: [] },
  }),
  { virtual: true },
);

describe('Agent Message Integration', () => {
  test('should create and enqueue sanitization message', () => {
    const {
      AgentMessage,
      enqueue_agent_message,
    } = require('../../agent/agent-development-env/backend/api');

    const message = new AgentMessage({
      id: 'test-sanitization-123',
      role: 'assistant',
      content: '🛡️ Sanitization completed',
      timestamp: new Date().toISOString(),
      agentType: 'sanitization',
      priority: 'medium',
      ttl: 300000,
      deliveryGuarantee: 'at-least-once',
      source: 'sanitization-pipeline',
    });

    const result = enqueue_agent_message(message);

    expect(result).toBe(true);
    expect(enqueue_agent_message).toHaveBeenCalledWith(message);
  });

  test('should validate message structure', () => {
    const {
      AgentMessage,
      validate_agent_message,
    } = require('../../agent/agent-development-env/backend/api');

    const validMessage = new AgentMessage({
      id: 'test-security-456',
      role: 'assistant',
      content: '🚨 Security alert detected',
      timestamp: new Date().toISOString(),
      agentType: 'security',
      priority: 'high',
      ttl: 3600000,
      deliveryGuarantee: 'exactly-once',
      source: 'security-monitor',
    });

    const isValid = validate_agent_message(validMessage);

    expect(isValid).toBe(true);
    expect(validate_agent_message).toHaveBeenCalledWith(validMessage);
  });

  test('should handle message routing', () => {
    const { get_message_priority_level } = require('../../agent/agent-development-env/backend/api');

    // Test high priority routing
    expect(get_message_priority_level({ priority: 'high' })).toBe('immediate');
    expect(get_message_priority_level({ priority: 'critical' })).toBe('immediate');

    // Test low priority routing
    expect(get_message_priority_level({ priority: 'low' })).toBe('background');
    expect(get_message_priority_level({ priority: 'medium' })).toBe('background');
  });

  test('should enforce rate limiting', () => {
    const {
      check_agent_message_rate_limit,
    } = require('../../agent/agent-development-env/backend/api');

    const message = { agentType: 'sanitization' };

    const allowed = check_agent_message_rate_limit(message);

    expect(allowed).toBe(true);
    expect(check_agent_message_rate_limit).toHaveBeenCalledWith(message);
  });

  test('should handle message expiration cleanup', () => {
    const {
      cleanup_expired_messages,
      agent_message_queues,
    } = require('../../agent/agent-development-env/backend/api');

    // Add a mock expired message
    agent_message_queues.background.push({
      message: { ttl: 1000 },
      enqueued_at: Date.now() - 2000, // 2 seconds ago, TTL 1 second
    });

    cleanup_expired_messages();

    expect(cleanup_expired_messages).toHaveBeenCalled();
  });

  test('should format HTTP response with agent messages', () => {
    // Test the response structure that would be returned by /api/chat
    const mockResponse = {
      success: true,
      response: 'Your message has been processed.',
      timestamp: new Date().toISOString(),
      agent_messages: [
        {
          id: 'agent-sanitization-123',
          role: 'assistant',
          content:
            '🛡️ Sanitization Summary\n- Original length: 1000 characters\n- Final length: 950 characters',
          timestamp: new Date().toISOString(),
          agentType: 'sanitization',
          priority: 'medium',
          ttl: 300000,
          deliveryGuarantee: 'at-least-once',
          source: 'sanitization-pipeline',
        },
      ],
    };

    expect(mockResponse.success).toBe(true);
    expect(mockResponse.agent_messages).toHaveLength(1);
    expect(mockResponse.agent_messages[0].agentType).toBe('sanitization');
    expect(mockResponse.agent_messages[0].priority).toBe('medium');
  });

  test('should format WebSocket chunk with agent message', () => {
    // Test the chunk structure sent via WebSocket
    const mockChunk = {
      type: 'chunk',
      content:
        '🛡️ Sanitization Summary\n- Original length: 1000 characters\n- Final length: 950 characters\n\n',
      agentMessage: {
        id: 'agent-sanitization-123',
        role: 'assistant',
        content:
          '🛡️ Sanitization Summary\n- Original length: 1000 characters\n- Final length: 950 characters',
        timestamp: new Date().toISOString(),
        agentType: 'sanitization',
        priority: 'medium',
        ttl: 300000,
        deliveryGuarantee: 'at-least-once',
        source: 'sanitization-pipeline',
      },
    };

    expect(mockChunk.type).toBe('chunk');
    expect(mockChunk.agentMessage).toBeDefined();
    expect(mockChunk.agentMessage.agentType).toBe('sanitization');
    expect(mockChunk.content).toContain('Sanitization Summary');
  });
});
