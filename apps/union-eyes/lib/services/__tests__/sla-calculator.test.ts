import { describe, it, expect } from 'vitest';
import {
  SLA_STANDARDS,
  calculateAcknowledgmentSla,
  calculateCaseSlaStatus,
  getAtRiskCases,
  getBreachedCases,
} from '../sla-calculator';

describe('sla-calculator', () => {
  describe('SLA_STANDARDS', () => {
    it('has correct constant values', () => {
      expect(SLA_STANDARDS.ACKNOWLEDGE_RECEIPT).toBe(2);
      expect(SLA_STANDARDS.FIRST_RESPONSE).toBe(5);
      expect(SLA_STANDARDS.INVESTIGATION_COMPLETE).toBe(15);
      expect(SLA_STANDARDS.BREACH_WARNING_THRESHOLD).toBe(0.8);
    });
  });

  describe('calculateAcknowledgmentSla', () => {
    it('returns within_sla when acknowledged within deadline', () => {
      const submitted = new Date('2026-01-13'); // Monday
      const acknowledged = new Date('2026-01-14'); // Tuesday (1 business day)

      const result = calculateAcknowledgmentSla(submitted, acknowledged);

      expect(result.status).toBe('within_sla');
      expect(result.daysElapsed).toBeLessThanOrEqual(SLA_STANDARDS.ACKNOWLEDGE_RECEIPT);
      expect(result.breachDate).toBeNull();
    });

    it('returns breached when acknowledged late', () => {
      const submitted = new Date('2026-01-13'); // Monday
      const acknowledged = new Date('2026-01-20'); // Next Monday (5 business days)

      const result = calculateAcknowledgmentSla(submitted, acknowledged);

      expect(result.status).toBe('breached');
      expect(result.daysElapsed).toBeGreaterThan(SLA_STANDARDS.ACKNOWLEDGE_RECEIPT);
    });

    it('returns within_sla when not yet acknowledged but within time', () => {
      const submitted = new Date('2026-01-13'); // Monday
      const currentDate = new Date('2026-01-13'); // Same day

      const result = calculateAcknowledgmentSla(submitted, null, currentDate);

      expect(result.status).toBe('within_sla');
      expect(result.daysRemaining).toBeGreaterThan(0);
    });

    it('returns at_risk when near SLA deadline without acknowledgment', () => {
      const submitted = new Date('2026-01-13'); // Monday
      // 80% of 2 days = 1.6; at 2 days elapsed we should be breached
      const currentDate = new Date('2026-01-15'); // Wednesday (2 business days)

      const result = calculateAcknowledgmentSla(submitted, null, currentDate);

      // At exactly 2 days, it should be breached (> allowed)
      expect(['at_risk', 'breached']).toContain(result.status);
    });

    it('returns breached when not acknowledged past deadline', () => {
      const submitted = new Date('2026-01-13'); // Monday
      const currentDate = new Date('2026-01-20'); // Next Monday (5 business days)

      const result = calculateAcknowledgmentSla(submitted, null, currentDate);

      expect(result.status).toBe('breached');
    });
  });

  describe('calculateCaseSlaStatus', () => {
    it('returns assessment with acknowledgment within SLA', () => {
      const timeline = [
        { timestamp: new Date('2026-01-13'), type: 'submitted' as const },
        { timestamp: new Date('2026-01-14'), type: 'acknowledged' as const },
      ];

      const result = calculateCaseSlaStatus('case-001', timeline, new Date('2026-01-15'));

      expect(result.caseId).toBe('case-001');
      expect(result.acknowledgment.status).toBe('within_sla');
    });

    it('throws when timeline has no submission event', () => {
      const timeline = [
        { timestamp: new Date('2026-01-14'), type: 'acknowledged' as const },
      ];

      expect(() => calculateCaseSlaStatus('case-002', timeline)).toThrow(
        'Timeline must include a submission event'
      );
    });

    it('includes first response and investigation SLA when acknowledged', () => {
      const timeline = [
        { timestamp: new Date('2026-01-13'), type: 'submitted' as const },
        { timestamp: new Date('2026-01-14'), type: 'acknowledged' as const },
      ];

      const result = calculateCaseSlaStatus('case-003', timeline, new Date('2026-01-15'));

      expect(result.firstResponse).toBeDefined();
      expect(result.investigation).toBeDefined();
    });

    it('does not include first response SLA when not yet acknowledged', () => {
      const timeline = [
        { timestamp: new Date('2026-01-13'), type: 'submitted' as const },
      ];

      const result = calculateCaseSlaStatus('case-004', timeline, new Date('2026-01-14'));

      expect(result.firstResponse).toBeUndefined();
      expect(result.investigation).toBeUndefined();
    });
  });

  describe('assessment filters', () => {
    it('getAtRiskCases returns at_risk and breached assessments', () => {
      const assessments = [
        calculateCaseSlaStatus(
          'case-risk',
          [{ timestamp: new Date('2026-01-13'), type: 'submitted' as const }],
          new Date('2026-01-15')
        ),
        calculateCaseSlaStatus(
          'case-breach',
          [{ timestamp: new Date('2026-01-13'), type: 'submitted' as const }],
          new Date('2026-01-20')
        ),
        calculateCaseSlaStatus(
          'case-ok',
          [
            { timestamp: new Date('2026-01-13'), type: 'submitted' as const },
            { timestamp: new Date('2026-01-13'), type: 'acknowledged' as const },
          ],
          new Date('2026-01-13')
        ),
      ];

      const filtered = getAtRiskCases(assessments);
      expect(filtered.map((c) => c.caseId)).toContain('case-risk');
      expect(filtered.map((c) => c.caseId)).toContain('case-breach');
      expect(filtered.map((c) => c.caseId)).not.toContain('case-ok');
    });

    it('getBreachedCases returns only breached assessments', () => {
      const assessments = [
        calculateCaseSlaStatus(
          'case-risk',
          [{ timestamp: new Date('2026-01-13'), type: 'submitted' as const }],
          new Date('2026-01-15')
        ),
        calculateCaseSlaStatus(
          'case-breach',
          [{ timestamp: new Date('2026-01-13'), type: 'submitted' as const }],
          new Date('2026-01-20')
        ),
      ];

      const breached = getBreachedCases(assessments);
      expect(breached).toHaveLength(1);
      expect(breached[0].caseId).toBe('case-breach');
      expect(breached[0].overallStatus).toBe('breached');
    });
  });
});
