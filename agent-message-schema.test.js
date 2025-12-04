// Agent Message Schema Validation Tests
// Validates the agent message format design against requirements

const { expect, describe, test } = require('@jest/globals');

describe('Agent Message Schema', () => {
  test('should validate sanitization message structure', () => {
    const sanitizationMessage = {
      id: 'agent-sanitization-123',
      role: 'assistant',
      content: '🛡️ Sanitization Summary...',
      timestamp: '2025-12-04T12:00:00Z',
      agentType: 'sanitization',
      priority: 'medium',
      ttl: 300000, // 5 minutes
      deliveryGuarantee: 'at-least-once',
      source: 'sanitization-pipeline',
    };

    expect(sanitizationMessage.agentType).toBe('sanitization');
    expect(['low', 'medium', 'high', 'critical']).toContain(sanitizationMessage.priority);
    expect(sanitizationMessage.ttl).toBeGreaterThan(0);
    expect(['best-effort', 'at-least-once', 'exactly-once']).toContain(
      sanitizationMessage.deliveryGuarantee,
    );
  });

  test('should validate security alert message structure', () => {
    const securityMessage = {
      id: 'agent-security-456',
      role: 'assistant',
      content: '🚨 Security Alert: XSS attempt detected',
      timestamp: '2025-12-04T12:00:00Z',
      agentType: 'security',
      priority: 'high',
      ttl: 3600000, // 1 hour
      deliveryGuarantee: 'exactly-once',
      source: 'security-monitor',
    };

    expect(securityMessage.agentType).toBe('security');
    expect(securityMessage.priority).toBe('high');
  });

  test('should validate status message structure', () => {
    const statusMessage = {
      id: 'agent-status-789',
      role: 'assistant',
      content: 'Processing PDF... 45% complete',
      timestamp: '2025-12-04T12:00:00Z',
      agentType: 'status',
      priority: 'low',
      ttl: 60000, // 1 minute
      deliveryGuarantee: 'best-effort',
      source: 'pdf-processor',
    };

    expect(statusMessage.agentType).toBe('status');
    expect(statusMessage.priority).toBe('low');
  });

  test('should validate error message structure', () => {
    const errorMessage = {
      id: 'agent-error-101',
      role: 'assistant',
      content: '❌ Processing failed: Invalid PDF format',
      timestamp: '2025-12-04T12:00:00Z',
      agentType: 'error',
      priority: 'critical',
      ttl: 86400000, // 24 hours
      deliveryGuarantee: 'exactly-once',
      source: 'error-handler',
    };

    expect(errorMessage.agentType).toBe('error');
    expect(errorMessage.priority).toBe('critical');
  });
});

describe('Message Routing Logic', () => {
  test('should route high priority messages immediately', () => {
    const highPriorityMessage = { priority: 'high', agentType: 'security' };
    const routingDecision = routeMessage(highPriorityMessage);

    expect(routingDecision.queue).toBe('immediate');
    expect(routingDecision.bypassRateLimit).toBe(true);
  });

  test('should queue low priority messages', () => {
    const lowPriorityMessage = { priority: 'low', agentType: 'status' };
    const routingDecision = routeMessage(lowPriorityMessage);

    expect(routingDecision.queue).toBe('background');
    expect(routingDecision.bypassRateLimit).toBe(false);
  });

  test('should respect delivery guarantees', () => {
    const exactlyOnceMessage = {
      priority: 'medium',
      agentType: 'sanitization',
      deliveryGuarantee: 'exactly-once',
    };
    const routingDecision = routeMessage(exactlyOnceMessage);

    expect(routingDecision.requiresAck).toBe(true);
    expect(routingDecision.retryPolicy).toBeDefined();
  });
});

// Mock routing function for testing
function routeMessage(message) {
  const priority = message.priority;
  const guarantee = message.deliveryGuarantee;

  if (priority === 'high' || priority === 'critical') {
    return {
      queue: 'immediate',
      bypassRateLimit: true,
      requiresAck: guarantee === 'exactly-once',
      retryPolicy: guarantee === 'exactly-once' ? { maxRetries: 3 } : undefined,
    };
  } else {
    return {
      queue: 'background',
      bypassRateLimit: false,
      requiresAck: guarantee === 'exactly-once' || guarantee === 'at-least-once',
      retryPolicy: guarantee === 'exactly-once' ? { maxRetries: 3 } : undefined,
    };
  }
}
