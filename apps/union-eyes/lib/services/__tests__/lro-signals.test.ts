import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCalculateCaseSlaStatus = vi.hoisted(() => vi.fn());

vi.mock('../sla-calculator', () => ({
  calculateCaseSlaStatus: mockCalculateCaseSlaStatus,
}));

import { detectSignals, SIGNAL_CONFIG, type CaseForSignals } from '../lro-signals';

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
});
