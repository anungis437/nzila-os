import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCalculateCaseSlaStatus = vi.hoisted(() => vi.fn());

vi.mock('../sla-calculator', () => ({
  calculateCaseSlaStatus: mockCalculateCaseSlaStatus,
}));

import {
  generateDefensibilityPack,
  verifyPackIntegrity,
  type TimelineEvent,
  type AuditEntry,
  type StateTransition,
} from '../defensibility-pack';

describe('defensibility-pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculateCaseSlaStatus.mockReturnValue({
      caseId: 'case-001',
      acknowledgment: { status: 'within_sla', daysElapsed: 1, daysRemaining: 1, breachDate: null },
      overallStatus: 'within_sla',
      criticalSlas: [],
    });
  });

  const caseSummary = {
    title: 'Workplace Safety Violation',
    memberId: 'member-1',
    memberName: 'Jane Doe',
    currentState: 'investigating',
    createdAt: new Date('2026-01-10'),
    lastUpdated: new Date('2026-01-20'),
    grievanceType: 'health_safety',
    priority: 'high',
  };

  const timeline: TimelineEvent[] = [
    {
      id: 'evt-1',
      caseId: 'case-001',
      timestamp: new Date('2026-01-10'),
      type: 'submitted',
      description: 'Grievance submitted',
      actorId: 'member-1',
      actorRole: 'member',
      visibilityScope: 'member',
    },
    {
      id: 'evt-2',
      caseId: 'case-001',
      timestamp: new Date('2026-01-11'),
      type: 'acknowledged',
      description: 'Officer acknowledged receipt',
      actorId: 'officer-1',
      actorRole: 'officer',
      visibilityScope: 'staff',
    },
    {
      id: 'evt-3',
      caseId: 'case-001',
      timestamp: new Date('2026-01-12'),
      type: 'other',
      description: 'Internal note',
      actorId: 'system',
      actorRole: 'system',
      visibilityScope: 'system',
    },
  ];

  const auditTrail: AuditEntry[] = [
    {
      id: 'audit-1',
      timestamp: new Date('2026-01-10'),
      userId: 'member-1',
      action: 'case.created',
      resourceType: 'case',
      resourceId: 'case-001',
      sanitizedMetadata: {},
    },
  ];

  const stateTransitions: StateTransition[] = [
    {
      timestamp: new Date('2026-01-11'),
      fromState: 'submitted',
      toState: 'acknowledged',
      actorRole: 'officer',
      validationPassed: true,
    },
  ];

  const options = {
    purpose: 'arbitration' as const,
    requestedBy: 'officer-1',
    exportFormat: 'json' as const,
    caseSummary,
    generatedBy: 'system',
  };

  describe('generateDefensibilityPack', () => {
    it('generates pack with correct metadata', async () => {
      const pack = await generateDefensibilityPack(
        'case-001', timeline, auditTrail, stateTransitions, options
      );

      expect(pack.exportVersion).toBe('1.0.0');
      expect(pack.caseId).toBe('case-001');
      expect(pack.generatedBy).toBe('system');
      expect(pack.exportMetadata.purpose).toBe('arbitration');
    });

    it('filters timeline by visibility — member vs staff', async () => {
      const pack = await generateDefensibilityPack(
        'case-001', timeline, auditTrail, stateTransitions, options
      );

      // member visible includes member + staff scope events
      expect(pack.memberVisibleTimeline.length).toBe(2);
      // staff visible excludes system scope
      expect(pack.staffVisibleTimeline.length).toBe(2);
      // system event should not appear in staff timeline
      expect(pack.staffVisibleTimeline.every(e => e.visibilityScope !== 'system')).toBe(true);
    });

    it('calculates integrity hashes', async () => {
      const pack = await generateDefensibilityPack(
        'case-001', timeline, auditTrail, stateTransitions, options
      );

      expect(pack.integrity.timelineHash).toMatch(/^[0-9a-f]+$/);
      expect(pack.integrity.auditHash).toMatch(/^[0-9a-f]+$/);
      expect(pack.integrity.stateTransitionHash).toMatch(/^[0-9a-f]+$/);
      expect(pack.integrity.combinedHash).toMatch(/^[0-9a-f]+$/);
    });

    it('handles empty timeline', async () => {
      const pack = await generateDefensibilityPack(
        'case-002', [], auditTrail, stateTransitions, options
      );

      expect(pack.slaCompliance).toHaveLength(0);
      expect(pack.memberVisibleTimeline).toHaveLength(0);
    });
  });

  describe('verifyPackIntegrity', () => {
    it('returns valid for unmodified pack', async () => {
      const pack = await generateDefensibilityPack(
        'case-001', timeline, auditTrail, stateTransitions, options
      );

      const result = verifyPackIntegrity(pack);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });
  });
});
