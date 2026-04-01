import { describe, it, expect } from 'vitest';

import {
  calculatePilotHealth,
  calculatePilotHealthBreakdown,
  getHealthScoreStatus,
  calculateMilestoneHealth,
  predictPilotSuccess,
  generateHealthReport,
} from '../health-scoring';
import type {
  PilotMetrics,
  PilotMilestone,
} from '@/types/marketing';

function makeMilestones(
  statuses: PilotMilestone['status'][],
  opts?: { pastTarget?: boolean },
): PilotMilestone[] {
  return statuses.map((status, i) => ({
    name: `MS${i}`,
    description: `Milestone ${i}`,
    status,
    targetDate: opts?.pastTarget && status !== 'complete' ? new Date('2020-01-01') : undefined,
  }));
}

function makeMetrics(overrides: Partial<PilotMetrics> = {}): PilotMetrics {
  return {
    id: 'pm-1',
    pilotId: 'p-1',
    organizationId: 'o-1',
    enrollmentDate: new Date(),
    daysActive: 60,
    organizerAdoptionRate: 80,
    memberEngagementRate: 40,
    casesManaged: 100,
    avgTimeToResolution: 720, // 30 days in hours
    healthScore: 0,
    milestones: makeMilestones(['complete', 'complete', 'pending', 'pending']),
    lastCalculated: new Date(),
    ...overrides,
  };
}

describe('health-scoring', () => {
  describe('calculatePilotHealthBreakdown', () => {
    it('returns all breakdown fields', () => {
      const result = calculatePilotHealthBreakdown(makeMetrics());
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('adoption');
      expect(result).toHaveProperty('engagement');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('effectiveness');
      expect(result).toHaveProperty('progress');
    });

    it('caps adoption at 100 when rate exceeds target', () => {
      const result = calculatePilotHealthBreakdown(
        makeMetrics({ organizerAdoptionRate: 120 }),
      );
      expect(result.adoption).toBeLessThanOrEqual(100);
    });

    it('caps engagement at 100 when rate exceeds target', () => {
      const result = calculatePilotHealthBreakdown(
        makeMetrics({ memberEngagementRate: 80 }),
      );
      expect(result.engagement).toBeLessThanOrEqual(100);
    });

    it('caps usage at 100 for very high case rates', () => {
      const result = calculatePilotHealthBreakdown(
        makeMetrics({ casesManaged: 10000, daysActive: 30 }),
      );
      expect(result.usage).toBeLessThanOrEqual(100);
    });

    it('gives 100 effectiveness when resolution <= 30 days', () => {
      const result = calculatePilotHealthBreakdown(
        makeMetrics({ avgTimeToResolution: 600 }), // 25 days
      );
      expect(result.effectiveness).toBe(100);
    });

    it('decreases effectiveness for resolution > 30 days', () => {
      const result = calculatePilotHealthBreakdown(
        makeMetrics({ avgTimeToResolution: 1440 }), // 60 days
      );
      expect(result.effectiveness).toBeLessThan(100);
    });

    it('clamps effectiveness to 0 minimum', () => {
      const result = calculatePilotHealthBreakdown(
        makeMetrics({ avgTimeToResolution: 72000 }), // 3000 days
      );
      expect(result.effectiveness).toBeGreaterThanOrEqual(0);
    });

    it('calculates progress from milestone completion', () => {
      const result = calculatePilotHealthBreakdown(
        makeMetrics({
          milestones: makeMilestones(['complete', 'complete', 'complete', 'pending']),
        }),
      );
      expect(result.progress).toBe(75);
    });

    it('overall is rounded', () => {
      const result = calculatePilotHealthBreakdown(makeMetrics());
      expect(result.overall).toBe(Math.round(result.overall));
    });
  });

  describe('calculatePilotHealth', () => {
    it('returns overall score matching breakdown', () => {
      const metrics = makeMetrics();
      const health = calculatePilotHealth(metrics);
      const breakdown = calculatePilotHealthBreakdown(metrics);
      expect(health).toBe(breakdown.overall);
    });
  });

  describe('getHealthScoreStatus', () => {
    it('returns excellent for score >= 85', () => {
      const result = getHealthScoreStatus(90);
      expect(result.status).toBe('excellent');
      expect(result.label).toBe('Excellent');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('returns good for score 70-84', () => {
      const result = getHealthScoreStatus(75);
      expect(result.status).toBe('good');
      expect(result.label).toBe('Good');
    });

    it('returns needs-attention for score 50-69', () => {
      const result = getHealthScoreStatus(55);
      expect(result.status).toBe('needs-attention');
      expect(result.label).toBe('Needs Attention');
    });

    it('returns critical for score < 50', () => {
      const result = getHealthScoreStatus(30);
      expect(result.status).toBe('critical');
      expect(result.label).toBe('Critical');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('boundary: 85 is excellent', () => {
      expect(getHealthScoreStatus(85).status).toBe('excellent');
    });

    it('boundary: 70 is good', () => {
      expect(getHealthScoreStatus(70).status).toBe('good');
    });

    it('boundary: 50 is needs-attention', () => {
      expect(getHealthScoreStatus(50).status).toBe('needs-attention');
    });

    it('boundary: 49 is critical', () => {
      expect(getHealthScoreStatus(49).status).toBe('critical');
    });
  });

  describe('calculateMilestoneHealth', () => {
    it('counts completed milestones', () => {
      const result = calculateMilestoneHealth(
        makeMilestones(['complete', 'complete', 'pending']),
      );
      expect(result.completed).toBe(2);
    });

    it('counts blocked milestones', () => {
      const result = calculateMilestoneHealth(
        makeMilestones(['blocked', 'complete']),
      );
      expect(result.blocked).toBe(1);
    });

    it('counts at-risk milestones (past target date, not complete)', () => {
      const result = calculateMilestoneHealth(
        makeMilestones(['pending'], { pastTarget: true }),
      );
      expect(result.atRisk).toBe(1);
    });

    it('counts on-track milestones (no target date or future)', () => {
      const result = calculateMilestoneHealth(
        makeMilestones(['pending', 'in-progress']),
      );
      expect(result.onTrack).toBe(2);
    });

    it('handles empty milestones array', () => {
      const result = calculateMilestoneHealth([]);
      expect(result).toEqual({ onTrack: 0, atRisk: 0, blocked: 0, completed: 0 });
    });
  });

  describe('predictPilotSuccess', () => {
    it('returns uncertain with low confidence for < 30 days', () => {
      const result = predictPilotSuccess(makeMetrics({ daysActive: 10 }));
      expect(result.likelihood).toBe('uncertain');
      expect(result.confidence).toBe(30);
    });

    it('returns very-likely when all three indicators strong', () => {
      const result = predictPilotSuccess(
        makeMetrics({
          daysActive: 60,
          organizerAdoptionRate: 80,
          memberEngagementRate: 40,
          avgTimeToResolution: 600,
          casesManaged: 100,
          milestones: makeMilestones(['complete', 'complete', 'pending', 'pending']),
        }),
      );
      expect(result.likelihood).toBe('very-likely');
      expect(result.confidence).toBe(85);
    });

    it('returns likely when adoption OR (engagement AND effectiveness)', () => {
      // Strong adoption alone + weak engagement
      const result = predictPilotSuccess(
        makeMetrics({
          daysActive: 60,
          organizerAdoptionRate: 80,
          memberEngagementRate: 10,
          avgTimeToResolution: 7200, // very slow
        }),
      );
      expect(result.likelihood).toBe('likely');
    });

    it('returns unlikely for very low adoption or engagement', () => {
      const result = predictPilotSuccess(
        makeMetrics({
          daysActive: 60,
          organizerAdoptionRate: 20,
          memberEngagementRate: 5,
          avgTimeToResolution: 7200,
          casesManaged: 1,
        }),
      );
      expect(result.likelihood).toBe('unlikely');
    });

    it('returns uncertain for mixed signals', () => {
      const result = predictPilotSuccess(
        makeMetrics({
          daysActive: 60,
          organizerAdoptionRate: 40, // just above unlikely threshold
          memberEngagementRate: 15, // above 30% threshold for engagement score check
          avgTimeToResolution: 7200, // low effectiveness
          casesManaged: 5,
        }),
      );
      expect(result.likelihood).toBe('uncertain');
    });
  });

  describe('generateHealthReport', () => {
    it('returns all report fields', () => {
      const report = generateHealthReport(makeMetrics());
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('breakdown');
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('milestones');
      expect(report).toHaveProperty('prediction');
      expect(report).toHaveProperty('keyMetrics');
    });

    it('summary includes overall score', () => {
      const report = generateHealthReport(makeMetrics());
      expect(report.summary).toContain(`${report.breakdown.overall}/100`);
    });

    it('keyMetrics includes expected labels', () => {
      const report = generateHealthReport(makeMetrics());
      const labels = report.keyMetrics.map((k) => k.label);
      expect(labels).toContain('Days Active');
      expect(labels).toContain('Organizer Adoption');
      expect(labels).toContain('Member Engagement');
      expect(labels).toContain('Cases Managed');
      expect(labels).toContain('Avg Resolution Time');
    });

    it('keyMetrics values are strings', () => {
      const report = generateHealthReport(makeMetrics());
      report.keyMetrics.forEach((m) => {
        expect(typeof m.value).toBe('string');
      });
    });
  });
});
