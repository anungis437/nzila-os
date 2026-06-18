import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCalculateCaseSlaStatus = vi.hoisted(() => vi.fn());

vi.mock('../sla-calculator', () => ({
  calculateCaseSlaStatus: mockCalculateCaseSlaStatus,
}));

import {
  detectSignals,
  detectAllSignals,
  filterBySeverity,
  filterByType,
  getDashboardStats,
  generateWebhookPayload,
  getActionableSignals,
  groupSignalsByCase,
  getHighestSeverityPerCase,
  SIGNAL_CONFIG,
  type CaseForSignals,
} from '../lro-signals';

describe('lro-signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculateCaseSlaStatus.mockReturnValue({
      caseId: 'case-001',
      acknowledgment: { status: 'within_sla' },
      criticalSlas: [],
      overallStatus: 'within_sla',
    });
  });

  const now = new Date('2026-03-15');

  function makeCaseData(overrides: Partial<CaseForSignals> = {}): CaseForSignals {
    return {
      id: 'case-001',
      title: 'Overtime Pay Dispute',
      memberId: 'member-1',
      memberName: 'Jane Doe',
      currentState: 'submitted',
      priority: 'medium',
      createdAt: new Date('2026-03-01'),
      lastUpdated: new Date('2026-03-14'),
      timeline: [
        { timestamp: new Date('2026-03-01'), type: 'submitted' },
      ],
      ...overrides,
    };
  }

  describe('SIGNAL_CONFIG', () => {
    it('has expected configuration values', () => {
      expect(SIGNAL_CONFIG.STALE_THRESHOLD_DAYS).toBe(7);
      expect(SIGNAL_CONFIG.ACKNOWLEDGMENT_DEADLINE_DAYS).toBe(2);
      expect(SIGNAL_CONFIG.MEMBER_WAITING_THRESHOLD_DAYS).toBe(3);
      expect(SIGNAL_CONFIG.INVESTIGATION_THRESHOLD_DAYS).toBe(10);
    });
  });

  describe('detectSignals — terminal states', () => {
    it('returns empty signals for closed cases', () => {
      const signals = detectSignals(makeCaseData({ currentState: 'closed' }), now);
      expect(signals).toHaveLength(0);
    });

    it('returns empty signals for resolved cases', () => {
      const signals = detectSignals(makeCaseData({ currentState: 'resolved' }), now);
      expect(signals).toHaveLength(0);
    });

    it('returns empty signals for withdrawn cases', () => {
      const signals = detectSignals(makeCaseData({ currentState: 'withdrawn' }), now);
      expect(signals).toHaveLength(0);
    });
  });

  describe('detectSignals — SLA breached', () => {
    it('returns sla_breached signal when acknowledgment SLA breached', () => {
      mockCalculateCaseSlaStatus.mockReturnValue({
        caseId: 'case-001',
        acknowledgment: { status: 'breached' },
        criticalSlas: [],
        overallStatus: 'breached',
      });

      const signals = detectSignals(makeCaseData(), now);
      const slaBreach = signals.find(s => s.type === 'sla_breached');

      expect(slaBreach).toBeDefined();
      expect(slaBreach!.severity).toBe('critical');
    });
  });

  describe('detectSignals — SLA at risk', () => {
    it('returns sla_at_risk signal when SLA approaching breach', () => {
      mockCalculateCaseSlaStatus.mockReturnValue({
        caseId: 'case-001',
        acknowledgment: { status: 'within_sla' },
        criticalSlas: ['acknowledgment'],
        overallStatus: 'at_risk',
      });

      const signals = detectSignals(makeCaseData(), now);
      const atRisk = signals.find(s => s.type === 'sla_at_risk');

      expect(atRisk).toBeDefined();
      expect(atRisk!.severity).toBe('urgent');
    });
  });

  describe('detectSignals — case stale', () => {
    it('returns case_stale signal after 7+ days of no activity', () => {
      const staleCase = makeCaseData({
        currentState: 'investigating',
        lastUpdated: new Date('2026-02-28'), // >7 business days before now
      });

      const signals = detectSignals(staleCase, now);
      const stale = signals.find(s => s.type === 'case_stale');

      expect(stale).toBeDefined();
      expect(stale!.severity).toBe('warning');
    });
  });

  describe('detectSignals — acknowledgment overdue', () => {
    it('returns acknowledgment_overdue when submitted for ≥2 business days', () => {
      const signals = detectSignals(
        makeCaseData({
          currentState: 'submitted',
          createdAt: new Date('2026-03-10'),
          timeline: [{ timestamp: new Date('2026-03-10'), type: 'submitted' }],
        }),
        now
      );
      const overdue = signals.find(s => s.type === 'acknowledgment_overdue');

      expect(overdue).toBeDefined();
      expect(overdue!.severity).toBe('critical');
    });
  });

  describe('detectSignals — member waiting', () => {
    it('returns member_waiting signal when in pending_response for too long', () => {
      const signals = detectSignals(
        makeCaseData({
          currentState: 'pending_response',
          timeline: [
            { timestamp: new Date('2026-03-01'), type: 'submitted' },
            { timestamp: new Date('2026-03-05'), type: 'first_response' },
          ],
        }),
        now
      );
      const waiting = signals.find(s => s.type === 'member_waiting');

      expect(waiting).toBeDefined();
      expect(waiting!.severity).toBe('urgent');
    });
  });

  // ── utility functions ────────────────────────────────────────────────────

  const makeSignal = (type: string, severity: string, caseId = 'case-001') => ({
    id: `${type}-${caseId}`,
    type,
    severity,
    caseId,
    message: `Signal ${type}`,
    detectedAt: now,
    metadata: {},
    actionRequired: severity === 'critical' || severity === 'urgent',
  });

  describe('detectAllSignals', () => {
    it('collects and sorts signals across multiple cases', () => {
      mockCalculateCaseSlaStatus.mockReturnValue({
        caseId: 'c', acknowledgment: { status: 'breached' }, criticalSlas: [], overallStatus: 'breached',
      });
      // Two cases both generating signals — forces the sort callback
      const cases = [
        makeCaseData({ id: 'c1', currentState: 'submitted', createdAt: new Date('2026-02-01'), lastUpdated: new Date('2026-02-01') }),
        makeCaseData({ id: 'c2', currentState: 'investigating', createdAt: new Date('2026-02-01'), lastUpdated: new Date('2026-02-01') }),
      ];
      const result = detectAllSignals(cases, now);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('member_waiting with multiple response events (sort callback)', () => {
    it('picks latest response event from multiple timeline events', () => {
      const signals = detectSignals(
        makeCaseData({
          currentState: 'pending_response',
          timeline: [
            { timestamp: new Date('2026-03-01'), type: 'submitted' },
            { timestamp: new Date('2026-03-03'), type: 'first_response' },
            { timestamp: new Date('2026-03-05'), type: 'other' }, // 2nd response event → sort fires
          ],
        }),
        now
      );
      const waiting = signals.find(s => s.type === 'member_waiting');
      expect(waiting).toBeDefined(); // 10 business days since March 5
    });
  });

  describe('filterBySeverity', () => {
    it('filters by single severity', () => {
      const signals = [makeSignal('sla_breached', 'critical'), makeSignal('case_stale', 'warning')];
      expect(filterBySeverity(signals, 'critical')).toHaveLength(1);
      expect(filterBySeverity(signals, 'warning')).toHaveLength(1);
    });
  });

  describe('filterByType', () => {
    it('filters by signal type', () => {
      const signals = [makeSignal('sla_breached', 'critical'), makeSignal('case_stale', 'warning')];
      expect(filterByType(signals, 'sla_breached')).toHaveLength(1);
      expect(filterByType(signals, 'case_stale')).toHaveLength(1);
    });
  });

  describe('getDashboardStats', () => {
    it('aggregates signal stats', () => {
      const signals = [
        makeSignal('sla_breached', 'critical', 'c1'),
        makeSignal('case_stale', 'warning', 'c2'),
        makeSignal('member_waiting', 'urgent', 'c1'),
      ];
      const stats = getDashboardStats(signals);
      expect(stats.totalCritical).toBe(1);
      expect(stats.totalWarning).toBe(1);
      expect(stats.totalUrgent).toBe(1);
      expect(stats.staleCases).toBe(1);
      expect(stats.memberWaiting).toBe(1);
    });
  });

  describe('generateWebhookPayload', () => {
    it('generates payload from signal', () => {
      const signal = makeSignal('sla_breached', 'critical', 'c1');
      const payload = generateWebhookPayload(signal, 'My Case', 'https://app.example.com');
      expect(payload.event).toBe('signal.created');
      expect(payload.signal).toEqual(signal);
      expect(payload.case.id).toBe('c1');
      expect(payload.case.url).toContain('cases/c1');
    });
  });

  describe('getActionableSignals', () => {
    it('returns only signals requiring action', () => {
      const signals = [
        makeSignal('sla_breached', 'critical'),
        makeSignal('case_stale', 'warning'),
      ];
      const actionable = getActionableSignals(signals);
      expect(actionable.every(s => s.actionRequired)).toBe(true);
    });
  });

  describe('groupSignalsByCase', () => {
    it('groups signals by caseId', () => {
      const signals = [
        makeSignal('sla_breached', 'critical', 'c1'),
        makeSignal('case_stale', 'warning', 'c1'),
        makeSignal('member_waiting', 'urgent', 'c2'),
      ];
      const grouped = groupSignalsByCase(signals);
      expect(grouped.get('c1')).toHaveLength(2);
      expect(grouped.get('c2')).toHaveLength(1);
    });
  });

  describe('getHighestSeverityPerCase', () => {
    it('returns one signal per case with highest severity', () => {
      const signals = [
        makeSignal('sla_breached', 'critical', 'c1'),
        makeSignal('case_stale', 'warning', 'c1'),
        makeSignal('member_waiting', 'urgent', 'c2'),
      ];
      const highest = getHighestSeverityPerCase(signals);
      expect(highest).toHaveLength(2);
      const c1Signal = highest.find(s => s.caseId === 'c1');
      expect(c1Signal?.severity).toBe('critical');
    });
  });
});
