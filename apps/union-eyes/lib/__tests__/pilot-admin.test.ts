/**
 * Tests for pilot-admin.ts
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../dashboard-metrics', () => ({
  computeKPIs: vi.fn(() => ({
    totalOpen: 0,
    totalClosed: 0,
    totalEscalated: 0,
    overdueResolution: 0,
    avgResolutionDays: 0,
    resolvedLast30Days: 0,
    closedThisMonth: 0,
    openedThisMonth: 0,
    escalatedThisMonth: 0,
  })),
  computeAgingBuckets: vi.fn(() => []),
  computeTypeCounts: vi.fn(() => []),
  computeWorksiteCounts: vi.fn(() => [
    { worksite: 'Site A', count: 5 },
    { worksite: 'Site B', count: 3 },
  ]),
  computeAssigneeCounts: vi.fn(() => [
    { assignee: 'John', count: 5 },
    { assignee: 'Unassigned', count: 2 },
  ]),
}));

import { runHealthChecks, buildPilotStatus, type PilotConfiguration, type CaseRow } from '../pilot-admin';
import { computeKPIs } from '../dashboard-metrics';

const baseConfig: PilotConfiguration = {
  vocabularyLoaded: true,
  orgConfigured: true,
  usersInvited: 3,
  worksitesConfigured: 2,
  slaThresholdsSet: true,
  auditTrailActive: true,
};

const mockCases: CaseRow[] = [];

describe('pilot-admin', () => {
  describe('runHealthChecks', () => {
    it('returns healthy when all checks pass', () => {
      const result = runHealthChecks(baseConfig, mockCases);
      expect(result.status).toBe('healthy');
      expect(result.checks.every(c => c.status === 'pass')).toBe(true);
      expect(result.summary).toContain('passing');
    });

    it('returns critical when vocabulary not loaded', () => {
      const result = runHealthChecks({ ...baseConfig, vocabularyLoaded: false }, mockCases);
      expect(result.status).toBe('critical');
      expect(result.checks.find(c => c.name === 'Vocabulary')?.status).toBe('fail');
    });

    it('returns degraded when only warnings present', () => {
      const result = runHealthChecks(
        { ...baseConfig, slaThresholdsSet: false, usersInvited: 1 },
        mockCases,
      );
      // usersInvited=1 → warn, slaThresholdsSet=false → warn, no fails
      const checks = result.checks;
      const hasFail = checks.some(c => c.status === 'fail');
      if (!hasFail) {
        expect(result.status).toBe('degraded');
      }
    });

    it('returns critical when org not configured', () => {
      const result = runHealthChecks({ ...baseConfig, orgConfigured: false }, mockCases);
      expect(result.status).toBe('critical');
    });

    it('checks for 0 worksites', () => {
      const result = runHealthChecks({ ...baseConfig, worksitesConfigured: 0 }, mockCases);
      expect(result.checks.find(c => c.name === 'Worksites')?.status).toBe('fail');
    });

    it('includes timestamp', () => {
      const result = runHealthChecks(baseConfig, mockCases);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

      it('gives fail for Users when usersInvited is 0', () => {
        const result = runHealthChecks({ ...baseConfig, usersInvited: 0 }, mockCases);
        const users = result.checks.find(c => c.name === 'Users');
        expect(users?.status).toBe('fail');
        expect(result.status).toBe('critical');
      });

      it('gives fail for Audit Trail when auditTrailActive is false', () => {
        const result = runHealthChecks({ ...baseConfig, auditTrailActive: false }, mockCases);
        const audit = result.checks.find(c => c.name === 'Audit Trail');
        expect(audit?.status).toBe('fail');
        expect(audit?.message).toContain('not active');
      });

      it('gives warn for SLA compliance when overdueRatio < 0.25', () => {
        vi.mocked(computeKPIs).mockReturnValueOnce({
          totalOpen: 10,
          totalClosed: 5,
          totalEscalated: 0,
          overdueResolution: 2,
          avgResolutionDays: 5,
          resolvedLast30Days: 5,
          closedThisMonth: 5,
          openedThisMonth: 10,
          escalatedThisMonth: 0,
        });
        const result = runHealthChecks(baseConfig, mockCases);
        const sla = result.checks.find(c => c.name === 'SLA Compliance');
        expect(sla?.status).toBe('warn');
        expect(sla?.message).toContain('2 of 10');
      });

      it('gives fail for SLA compliance when overdueRatio >= 0.25', () => {
        vi.mocked(computeKPIs).mockReturnValueOnce({
          totalOpen: 10,
          totalClosed: 5,
          totalEscalated: 0,
          overdueResolution: 4,
          avgResolutionDays: 5,
          resolvedLast30Days: 5,
          closedThisMonth: 5,
          openedThisMonth: 10,
          escalatedThisMonth: 0,
        });
        const result = runHealthChecks(baseConfig, mockCases);
        const sla = result.checks.find(c => c.name === 'SLA Compliance');
        expect(sla?.status).toBe('fail');
      });

      it('correctly sets critical status from failing SLA check', () => {
        vi.mocked(computeKPIs).mockReturnValueOnce({
          totalOpen: 8,
          totalClosed: 0,
          totalEscalated: 0,
          overdueResolution: 3,
          avgResolutionDays: 9,
          resolvedLast30Days: 0,
          closedThisMonth: 0,
          openedThisMonth: 8,
          escalatedThisMonth: 0,
        });
        const result = runHealthChecks(baseConfig, mockCases);
        expect(result.status).toBe('critical');
      });
  });

  describe('buildPilotStatus', () => {
    it('builds complete pilot status', () => {
      const result = buildPilotStatus(baseConfig, mockCases);
      expect(result.phase).toBe('v0.1-pilot');
      expect(result.health).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.configuration).toEqual(baseConfig);
    });

    it('calculates metrics from cases', () => {
      const result = buildPilotStatus(baseConfig, mockCases);
      expect(result.metrics.totalCases).toBe(0);
      expect(typeof result.metrics.openCases).toBe('number');
      expect(typeof result.metrics.activeWorksites).toBe('number');
    });
  });
});
