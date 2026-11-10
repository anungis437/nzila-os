import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory, listReasoningSessions } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  listReasoningSessions: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({ listReasoningSessions }));

import { analyzeLearningTrajectory } from '../trajectory-analyzer';

const DAY = 86_400_000;

function timelinePoint(score: number, daysAgo: number, id: string) {
  return { resilienceScore: score, capturedAt: new Date(Date.now() - daysAgo * DAY).toISOString(), memoryEntryId: id };
}

describe('lib/knowledge-transfer/learning-trajectories/trajectory-analyzer', () => {
  it('analyzes an accelerating trajectory with milestones and forecast', async () => {
    const timeline = [
      timelinePoint(10, 180, 'm0'),
      timelinePoint(12, 150, 'm1'),
      timelinePoint(15, 120, 'm2'),
      timelinePoint(30, 60, 'm3'),
      timelinePoint(50, 30, 'm4'),
      timelinePoint(70, 1, 'm5'),
    ];
    loadCognitionMemory.mockResolvedValue({
      entries: [
        { id: 'm3', memoryType: 'governance_reasoning', createdAt: new Date().toISOString() },
        { id: 'm4', memoryType: 'mitigation_comparison', createdAt: new Date().toISOString() },
      ],
      resilienceTimeline: timeline,
    } as never);
    listReasoningSessions.mockResolvedValue([{}, {}]);

    const report = await analyzeLearningTrajectory('org-1');
    expect(report.trajectoryPoints.length).toBe(6);
    expect(['accelerating', 'steady']).toContain(report.momentum);
    expect(report.forecast.length).toBe(3);
    expect(report.forecastStatus).toBe('available');
    expect(report.milestones.some((m) => m.achieved)).toBe(true);
    expect(report.trajectorySpanDays).toBeGreaterThan(0);
    expect(report.interactionsPerMonth).not.toBeNull();
    // DEF-0B7-COGB-LEARNING-TRAJECTORY-FORECAST: the band is a fixed formula, not a statistical confidence
    // interval - renamed off 'confidenceRange' and disclosed as such.
    expect(report.forecast[0]).toHaveProperty('projectionBand');
    expect(report.forecast[0]).not.toHaveProperty('confidenceRange');
    expect(report.methodologyNote).toMatch(/linear extrapolation|fixed formula|not .*(probabilistic|statistical)/i);
    expect(report.interpretationGuidance).not.toMatch(/probabilistic/i);
  });

  it('returns insufficient_data momentum and empty forecast with no timeline', async () => {
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: [] } as never);
    listReasoningSessions.mockResolvedValue([]);
    const report = await analyzeLearningTrajectory('org-2');
    expect(report.momentum).toBe('insufficient_data');
    expect(report.forecast).toEqual([]);
    expect(report.forecastStatus).toBe('unavailable_insufficient_data');
    expect(report.trajectorySpanDays).toBeNull();
    expect(report.estimatedMonthsToNextMilestone).toBeNull();
  });

  // DEF-0B7-COGB-LEARNING-TRAJECTORY-FORECAST-EXTRAPOLATES-TWO-TYPED-SCORES: a linear extrapolation from a
  // handful of typed scores is not a forecast - none is offered below MIN_COHORT_SIZE (5) timeline points, and the
  // observed series is returned in full instead of a fabricated projection.
  it('withholds the forecast below the minimum cohort size even with a clear trend', async () => {
    const timeline = [
      timelinePoint(10, 90, 'a'),
      timelinePoint(30, 60, 'b'),
      timelinePoint(50, 30, 'c'),
      timelinePoint(70, 1, 'd'),
    ];
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: timeline } as never);
    listReasoningSessions.mockResolvedValue([]);
    const report = await analyzeLearningTrajectory('org-2b');
    expect(report.trajectoryPoints.length).toBe(4);
    expect(report.forecast).toEqual([]);
    expect(report.forecastStatus).toBe('unavailable_insufficient_data');
    expect(report.estimatedMonthsToNextMilestone).toBeNull();
    expect(report.methodologyNote).toMatch(/fewer than 5|no forecast is produced/i);
  });

  it('handles a stalled trajectory', async () => {
    const timeline = [
      timelinePoint(50, 120, 'a'),
      timelinePoint(50, 90, 'b'),
      timelinePoint(51, 60, 'c'),
      timelinePoint(50, 1, 'd'),
    ];
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: timeline } as never);
    listReasoningSessions.mockResolvedValue([]);
    const report = await analyzeLearningTrajectory('org-3');
    expect(report.momentum).toBe('stalled');
    expect(report.momentumNarrative).toContain('stalled');
  });

  it('handles a decelerating trajectory', async () => {
    const timeline = [
      timelinePoint(20, 120, 'a'),
      timelinePoint(45, 90, 'b'),
      timelinePoint(48, 60, 'c'),
      timelinePoint(49, 1, 'd'),
    ];
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: timeline } as never);
    listReasoningSessions.mockResolvedValue([]);
    const report = await analyzeLearningTrajectory('org-4');
    expect(['decelerating', 'steady', 'stalled']).toContain(report.momentum);
  });
});
