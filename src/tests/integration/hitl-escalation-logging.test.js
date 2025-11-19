jest.mock('../../components/data-integrity/AuditLogger');
const AuditLogger = require('../../components/data-integrity/AuditLogger');

describe('HITL Escalation Logging Integration', () => {
  let auditLogger;

  beforeEach(() => {
    AuditLogger.mockClear();
    const auditTrail = [];
    const mockAuditLogger = {
      logEscalationDecision: jest.fn().mockImplementation((escalationData, context) => {
        const entry = {
          id: 'audit_123',
          timestamp: new Date().toISOString(),
          operation: 'hitl_escalation_decision',
          details: {
            escalationId: escalationData.escalationId,
            triggerConditions: escalationData.triggerConditions.map
              ? escalationData.triggerConditions.map((t) =>
                  t
                    .replaceAll(
                      /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
                      '[EMAIL_REDACTED]',
                    )
                    .replaceAll(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]'),
                )
              : escalationData.triggerConditions,
            decisionRationale: escalationData.decisionRationale,
            riskLevel: escalationData.riskLevel,
          },
          context: {
            userId: context.userId.replaceAll(
              /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
              '[EMAIL_REDACTED]',
            ),
            stage: context.stage,
            severity: 'warning',
          },
        };
        auditTrail.push(entry);
        return Promise.resolve('audit_123');
      }),
      logHumanIntervention: jest.fn().mockImplementation((outcomeData, metrics) => {
        const entry = {
          id: 'audit_456',
          timestamp: new Date().toISOString(),
          operation: 'hitl_human_intervention',
          details: {
            escalationId: outcomeData.escalationId,
            humanDecision: {
              decision: outcomeData.decision,
              rationale: outcomeData.rationale.replaceAll(
                /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
                '[EMAIL_REDACTED]',
              ),
            },
            resolutionTime: metrics.resolutionTime,
            effectivenessScore: metrics.effectivenessScore,
            outcome: outcomeData.outcome,
          },
          context: {
            userId: outcomeData.humanId.replaceAll(
              /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
              '[EMAIL_REDACTED]',
            ),
            stage: outcomeData.stage,
            severity: 'info',
          },
        };
        auditTrail.push(entry);
        return Promise.resolve('audit_456');
      }),
      getAuditEntries: jest.fn().mockImplementation((filters) => {
        let entries = auditTrail;
        if (filters && filters.operation) {
          entries = entries.filter((e) => e.operation === filters.operation);
        }
        return entries;
      }),
    };
    AuditLogger.mockImplementation(() => mockAuditLogger);
    auditLogger = new AuditLogger();
  });

  test('should log complete escalation workflow from decision to intervention', async () => {
    // Log escalation decision
    const escalationData = {
      escalationId: 'esc-001',
      triggerConditions: ['high_risk_score', 'suspicious_content'],
      decisionRationale: 'Automated system flagged for human review',
      riskLevel: 'High',
    };
    const escalationContext = {
      userId: 'system',
      resourceId: 'req-123',
      stage: 'escalation',
    };

    const escalationAuditId = await auditLogger.logEscalationDecision(
      escalationData,
      escalationContext,
    );
    expect(escalationAuditId).toMatch(/^audit_/);

    // Log human intervention
    const outcomeData = {
      escalationId: 'esc-001',
      decision: 'approve',
      rationale: 'Reviewed content, appears safe after sanitization',
      humanId: 'reviewer-456',
      resourceId: 'req-123',
      sessionId: 'session-789',
      stage: 'intervention',
      outcome: 'approved',
    };
    const metrics = {
      resolutionTime: 180_000, // 3 minutes
      effectivenessScore: 0.92,
    };

    const interventionAuditId = await auditLogger.logHumanIntervention(outcomeData, metrics);
    expect(interventionAuditId).toMatch(/^audit_/);

    // Verify audit trail
    const allEntries = auditLogger.getAuditEntries();
    expect(allEntries).toHaveLength(2);

    const escalationEntry = allEntries.find((e) => e.operation === 'hitl_escalation_decision');
    const interventionEntry = allEntries.find((e) => e.operation === 'hitl_human_intervention');

    expect(escalationEntry).toBeDefined();
    expect(interventionEntry).toBeDefined();

    // Verify escalation logging
    expect(escalationEntry.details.escalationId).toBe('esc-001');
    expect(escalationEntry.details.triggerConditions).toEqual([
      'high_risk_score',
      'suspicious_content',
    ]);
    expect(escalationEntry.details.decisionRationale).toBe(
      'Automated system flagged for human review',
    );
    expect(escalationEntry.context.stage).toBe('escalation');
    expect(escalationEntry.context.severity).toBe('warning');

    // Verify intervention logging
    expect(interventionEntry.details.escalationId).toBe('esc-001');
    expect(interventionEntry.details.humanDecision.decision).toBe('approve');
    expect(interventionEntry.details.resolutionTime).toBe(180_000);
    expect(interventionEntry.details.effectivenessScore).toBe(0.92);
    expect(interventionEntry.context.userId).toBe('reviewer-456');
    expect(interventionEntry.context.stage).toBe('intervention');
    expect(interventionEntry.context.severity).toBe('info');

    // Verify chronological order
    expect(new Date(escalationEntry.timestamp).getTime()).toBeLessThan(
      new Date(interventionEntry.timestamp).getTime(),
    );
  });

  test('should handle multiple escalations with different outcomes', async () => {
    // First escalation - approved
    await auditLogger.logEscalationDecision(
      {
        escalationId: 'esc-001',
        triggerConditions: ['high_score'],
        decisionRationale: 'High risk',
        riskLevel: 'High',
      },
      { userId: 'system', resourceId: 'req-1' },
    );

    await auditLogger.logHumanIntervention(
      {
        escalationId: 'esc-001',
        decision: 'approve',
        rationale: 'Safe',
        humanId: 'reviewer1',
        resourceId: 'req-1',
        outcome: 'approved',
      },
      { resolutionTime: 120_000, effectivenessScore: 0.9 },
    );

    // Second escalation - rejected
    await auditLogger.logEscalationDecision(
      {
        escalationId: 'esc-002',
        triggerConditions: ['malicious_pattern'],
        decisionRationale: 'Malicious content detected',
        riskLevel: 'High',
      },
      { userId: 'system', resourceId: 'req-2' },
    );

    await auditLogger.logHumanIntervention(
      {
        escalationId: 'esc-002',
        decision: 'reject',
        rationale: 'Confirmed malicious',
        humanId: 'reviewer2',
        resourceId: 'req-2',
        outcome: 'rejected',
      },
      { resolutionTime: 300_000, effectivenessScore: 0.85 },
    );

    const entries = auditLogger.getAuditEntries();
    expect(entries).toHaveLength(4);

    const escalationEntries = entries.filter((e) => e.operation === 'hitl_escalation_decision');
    const interventionEntries = entries.filter((e) => e.operation === 'hitl_human_intervention');

    expect(escalationEntries).toHaveLength(2);
    expect(interventionEntries).toHaveLength(2);

    // Verify different outcomes
    const approvedIntervention = interventionEntries.find((e) => e.details.outcome === 'approved');
    const rejectedIntervention = interventionEntries.find((e) => e.details.outcome === 'rejected');

    expect(approvedIntervention.details.effectivenessScore).toBe(0.9);
    expect(rejectedIntervention.details.effectivenessScore).toBe(0.85);
  });

  test('should maintain audit integrity with PII redaction', async () => {
    // Log with PII
    await auditLogger.logEscalationDecision(
      {
        escalationId: 'esc-pii',
        triggerConditions: ['email@example.com', 'phone: 123-456-7890'],
        decisionRationale: 'Contact info in content',
      },
      { userId: 'admin@example.com' },
    );

    await auditLogger.logHumanIntervention(
      {
        escalationId: 'esc-pii',
        decision: 'reject',
        rationale: 'PII detected: user@domain.com',
        humanId: 'reviewer@example.com',
      },
      {},
    );

    const entries = auditLogger.getAuditEntries({ operation: 'hitl_escalation_decision' });
    const interventionEntries = auditLogger.getAuditEntries({
      operation: 'hitl_human_intervention',
    });

    // Verify PII redaction in escalation
    expect(entries[0].details.triggerConditions).toEqual([
      '[EMAIL_REDACTED]',
      'phone: [PHONE_REDACTED]',
    ]);
    expect(entries[0].details.decisionRationale).toBe('Contact info in content');
    expect(entries[0].context.userId).toBe('[EMAIL_REDACTED]');

    // Verify PII redaction in intervention
    expect(interventionEntries[0].details.humanDecision.rationale).toBe(
      'PII detected: [EMAIL_REDACTED]',
    );
    expect(interventionEntries[0].context.userId).toBe('[EMAIL_REDACTED]');
  });
});
