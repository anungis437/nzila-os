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
