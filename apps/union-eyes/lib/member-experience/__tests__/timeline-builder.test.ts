import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getHumanExplainer } = vi.hoisted(() => ({ getHumanExplainer: vi.fn() }));
vi.mock('@/lib/member-experience/human-explainers', () => ({ getHumanExplainer }));

import {
  buildCaseTimeline,
  calculateCaseProgress,
  estimateTimeRemaining,
  generateStatusUpdateMessage,
  getCaseJourneySummary,
  isStageDelayed,
} from '../timeline-builder';
import type { TimelineContext, TimelineStage } from '../timeline-builder';

function explanation(overrides: Record<string, unknown> = {}) {
  return {
    title: 'In Review',
    explanation: 'Your case is being reviewed.',
    expectedTimeline: '5-10 days',
    nextSteps: ['Wait for steward'],
    empathyMessage: 'We are here to help.',
    ...overrides,
  };
}

const context: TimelineContext = {
  caseId: 'case-1',
  currentStatus: 'review',
  statusHistory: [
    { status: 'submitted', timestamp: new Date('2026-01-01T00:00:00Z') },
    { status: 'review', timestamp: new Date('2026-01-03T00:00:00Z') },
    { status: 'closed', timestamp: new Date('2026-01-10T00:00:00Z') },
  ],
  priority: 'high',
  assignedSteward: { id: 's1', name: 'Sam' },
  caseType: 'grievance',
};

function stage(overrides: Partial<TimelineStage> = {}): TimelineStage {
  return {
    id: 's',
    status: 'review',
    title: 'In Review',
    description: 'd',
    timestamp: new Date(),
    daysInStage: 3,
    isCurrentStage: true,
    isPastStage: false,
    isFutureStage: false,
    explanation: explanation() as never,
    ...overrides,
  };
}

describe('lib/member-experience/timeline-builder', () => {
  beforeEach(() => getHumanExplainer.mockReset());

  describe('buildCaseTimeline', () => {
    it('builds one stage per status with current/past/future flags', () => {
      getHumanExplainer.mockReturnValue(explanation());
      const stages = buildCaseTimeline(context);
      expect(stages).toHaveLength(3);
      expect(stages[0].isPastStage).toBe(true);
      expect(stages[1].isCurrentStage).toBe(true);
      expect(stages[2].isFutureStage).toBe(true);
    });
  });

  describe('estimateTimeRemaining', () => {
    it('handles missing timeline', () => {
      expect(estimateTimeRemaining(stage({ explanation: explanation({ expectedTimeline: undefined }) as never }))).toBe(
        'Timeline varies by case',
      );
    });
    it('computes remaining days from a range', () => {
      const result = estimateTimeRemaining(stage({ daysInStage: 1, explanation: explanation({ expectedTimeline: '5-10 days' }) as never }));
      expect(result).toContain('remaining');
    });
    it('handles hours and weeks units', () => {
      expect(estimateTimeRemaining(stage({ daysInStage: 0, explanation: explanation({ expectedTimeline: '24-48 hours' }) as never }))).toBeTruthy();
      expect(estimateTimeRemaining(stage({ daysInStage: 0, explanation: explanation({ expectedTimeline: '2-3 weeks' }) as never }))).toContain('week');
    });
  });

  describe('isStageDelayed', () => {
    it('is false without timeline, true when well over max', () => {
      expect(isStageDelayed(stage({ explanation: explanation({ expectedTimeline: undefined }) as never }))).toBe(false);
      expect(isStageDelayed(stage({ daysInStage: 100, explanation: explanation({ expectedTimeline: '5-10 days' }) as never }))).toBe(true);
    });
  });

  describe('calculateCaseProgress', () => {
    it('returns 100 when no current stage', () => {
      expect(calculateCaseProgress([stage({ isCurrentStage: false, isPastStage: true })])).toBe(100);
    });
    it('returns a bounded percentage with a current stage', () => {
      const stages = [stage({ isPastStage: true, isCurrentStage: false }), stage({ isCurrentStage: true })];
      const p = calculateCaseProgress(stages);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    });
  });

  describe('getCaseJourneySummary', () => {
    it('summarizes the journey', () => {
      getHumanExplainer.mockReturnValue(explanation());
      const summary = getCaseJourneySummary(context);
      expect(summary.currentStageTitle).toBe('In Review');
      expect(typeof summary.isOnTrack).toBe('boolean');
    });
  });

  describe('generateStatusUpdateMessage', () => {
    it('produces a human message with next steps and timeline', () => {
      getHumanExplainer.mockReturnValue(explanation());
      const msg = generateStatusUpdateMessage('submitted', 'review', { priority: 'high' });
      expect(msg).toContain('In Review');
      expect(msg).toContain('Next steps');
      expect(msg).toContain('Expected timeline');
    });
  });
});
