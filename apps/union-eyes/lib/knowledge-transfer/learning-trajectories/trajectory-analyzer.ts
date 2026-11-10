/**
 * Organizational Learning Trajectory Analyzer
 *
 * Analyzes long-term organizational continuity evolution trajectories.
 * Provides resilience forecasting, maturity milestones, and learning momentum assessment.
 *
 * SCOPE: Organizational learning trajectories — NOT workforce analytics.
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import { listReasoningSessions } from '@/lib/knowledge-transfer/reasoning-sessions/session-manager';
import { MIN_COHORT_SIZE } from '@/lib/knowledge-transfer/governance/evidence-basis';
import type {
  LearningTrajectoryReport,
  TrajectoryDataPoint,
  LearningMomentum,
  TrajectoryForecastPoint,
  TrajectoryForecastStatus,
  MaturityMilestone,
} from './trajectory-models';

const MATURITY_MILESTONES: Array<{ label: string; scoreThreshold: number }> = [
  { label: 'First Continuity Baseline', scoreThreshold: 10 },
  { label: 'Emerging Governance Foundation', scoreThreshold: 25 },
  { label: 'Developing Continuity Practice', scoreThreshold: 40 },
  { label: 'Established Governance Posture', scoreThreshold: 55 },
  { label: 'Advanced Continuity Intelligence', scoreThreshold: 70 },
  { label: 'Leading Organizational Resilience', scoreThreshold: 85 },
];

function buildTrajectoryPoints(
  timeline: { capturedAt: string; resilienceScore: number; memoryEntryId: string }[],
  interventionIds: Set<string>,
  totalInteractions: number,
): TrajectoryDataPoint[] {
  let cumulativeInteractions = 0;
  return timeline.map((pt, idx) => {
    cumulativeInteractions = Math.round((idx + 1) * (totalInteractions / Math.max(timeline.length, 1)));
    return {
      capturedAt: pt.capturedAt,
      resilienceScore: pt.resilienceScore,
      cumulativeInteractions,
      hasIntervention: interventionIds.has(pt.memoryEntryId),
    };
  });
}

function computeMomentum(points: TrajectoryDataPoint[]): LearningMomentum {
  if (points.length < 4) return 'insufficient_data';

  const half = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, half);
  const secondHalf = points.slice(half);

  const firstDelta = firstHalf[firstHalf.length - 1].resilienceScore - firstHalf[0].resilienceScore;
  const secondDelta = secondHalf[secondHalf.length - 1].resilienceScore - secondHalf[0].resilienceScore;

  if (Math.abs(secondDelta) < 3 && Math.abs(firstDelta) < 3) return 'stalled';
  if (secondDelta > firstDelta + 3) return 'accelerating';
  if (firstDelta > secondDelta + 3 && secondDelta < 2) return 'decelerating';
  if (secondDelta < -5) return 'stalled';
  return 'steady';
}

/**
 * Builds a forecast only once there are enough resilience timeline points to extrapolate from at all. Two points
 * define a line, not a trend: a linear projection from a two-point history is indistinguishable from noise, so
 * none is offered below MIN_COHORT_SIZE (DEF-0B7-COGB-LEARNING-TRAJECTORY-FORECAST-EXTRAPOLATES-TWO-TYPED-SCORES).
 */
function buildForecast(
  points: TrajectoryDataPoint[],
  momentum: LearningMomentum,
): TrajectoryForecastPoint[] {
  if (points.length < MIN_COHORT_SIZE) return [];

  const latest = points[points.length - 1].resilienceScore;
  const trend = points[points.length - 1].resilienceScore - points[0].resilienceScore;

  // Monthly rate of change based on full span
  const firstDate = new Date(points[0].capturedAt).getTime();
  const lastDate = new Date(points[points.length - 1].capturedAt).getTime();
  const spanMonths = Math.max((lastDate - firstDate) / (30 * 86_400_000), 1);
  const monthlyRate = trend / spanMonths;

  const momentumMultiplier: Record<LearningMomentum, number> = {
    accelerating: 1.3,
    steady: 1.0,
    decelerating: 0.5,
    stalled: 0.1,
    insufficient_data: 0.5,
  };
  const adjustedRate = monthlyRate * momentumMultiplier[momentum];

  const horizons = [3, 6, 12];
  return horizons.map((months) => {
    const projected = latest + adjustedRate * months;
    const clamped = Math.min(Math.max(Math.round(projected), 0), 100);
    const bandWidth = Math.min(months * 3, 20);
    return {
      monthsAhead: months,
      forecastedScore: clamped,
      projectionBand: {
        low: Math.max(0, clamped - bandWidth),
        high: Math.min(100, clamped + bandWidth),
      },
    };
  });
}

function buildMilestones(
  timeline: { resilienceScore: number; capturedAt: string }[],
): MaturityMilestone[] {
  return MATURITY_MILESTONES.map(({ label, scoreThreshold }) => {
    const achievedPoint = timeline.find((t) => t.resilienceScore >= scoreThreshold);
    return {
      label,
      scoreThreshold,
      achieved: !!achievedPoint,
      achievedAt: achievedPoint?.capturedAt ?? null,
    };
  });
}

function estimateMonthsToNext(
  milestones: MaturityMilestone[],
  forecast: TrajectoryForecastPoint[],
  currentScore: number | null,
): number | null {
  if (currentScore === null) return null;
  const nextMilestone = milestones.find((m) => !m.achieved);
  if (!nextMilestone) return null;

  const gap = nextMilestone.scoreThreshold - currentScore;
  if (gap <= 0) return 0;

  const sixMonth = forecast.find((f) => f.monthsAhead === 6);
  if (!sixMonth) return null;

  const sixMonthGain = sixMonth.forecastedScore - currentScore;
  if (sixMonthGain <= 0) return null;

  const rate = sixMonthGain / 6;
  return Math.max(1, Math.round(gap / rate));
}

function momentumNarrative(momentum: LearningMomentum, score: number | null): string {
  const s = score !== null ? ` (current score: ${score})` : '';
  switch (momentum) {
    case 'accelerating': return `Organizational learning is accelerating${s} — governance engagement is producing increasingly rapid resilience improvement.`;
    case 'steady': return `Organizational learning is progressing at a steady pace${s} — consistent governance investment is yielding predictable improvement.`;
    case 'decelerating': return `Learning momentum is decelerating${s} — resilience improvement is slowing. Consider governance investment to reinvigorate the trajectory.`;
    case 'stalled': return `Learning momentum has stalled${s} — governance activity has not translated into recent resilience improvement. Review current governance practices.`;
    case 'insufficient_data': return `Insufficient history to assess learning momentum${s}. Continue building organizational memory to enable trajectory analysis.`;
  }
}

/** Analyze organizational learning trajectory for an organization. */
export async function analyzeLearningTrajectory(orgId: string): Promise<LearningTrajectoryReport> {
  const [store, sessions] = await Promise.all([
    loadCognitionMemory(orgId, { limit: 100 }),
    listReasoningSessions(orgId, { limit: 50 }),
  ]);

  const entries = store.entries;
  const timeline = store.resilienceTimeline;
  const totalEntries = entries.length;
  const sessionCount = sessions.length;
  const totalInteractions = totalEntries + sessionCount;

  // Identify intervention entry IDs (mitigations + governance decisions)
  const interventionIds = new Set(
    entries
      .filter(
        (e) =>
          e.memoryType === 'mitigation_comparison' ||
          e.memoryType === 'governance_reasoning' ||
          e.memoryType === 'decision_brief',
      )
      .map((e) => e.id),
  );

  const trajectoryPoints = buildTrajectoryPoints(timeline, interventionIds, totalInteractions);
  const momentum = computeMomentum(trajectoryPoints);
  const forecast = buildForecast(trajectoryPoints, momentum);
  const milestones = buildMilestones(timeline);

  const currentScore = timeline.length > 0 ? timeline[timeline.length - 1].resilienceScore : null;
  const estimatedMonths = estimateMonthsToNext(milestones, forecast, currentScore);

  // Compute span
  let trajectorySpanDays: number | null = null;
  if (timeline.length >= 2) {
    const first = new Date(timeline[0].capturedAt).getTime();
    const last = new Date(timeline[timeline.length - 1].capturedAt).getTime();
    trajectorySpanDays = Math.round((last - first) / 86_400_000);
  }

  const interactionsPerMonth =
    trajectorySpanDays !== null && trajectorySpanDays > 0
      ? Math.round((totalInteractions / trajectorySpanDays) * 30 * 10) / 10
      : null;

  const forecastStatus: TrajectoryForecastStatus =
    forecast.length > 0 ? 'available' : 'unavailable_insufficient_data';

  return {
    organizationId: orgId,
    analyzedAt: new Date().toISOString(),
    trajectoryPoints,
    momentum,
    momentumNarrative: momentumNarrative(momentum, currentScore),
    forecast,
    forecastStatus,
    milestones,
    trajectorySpanDays,
    interactionsPerMonth,
    estimatedMonthsToNextMilestone: estimatedMonths,
    entriesAnalyzed: totalEntries,
    interpretationGuidance:
      'Learning trajectories are organizational — not individual. Forecasts project a linear extrapolation of ' +
      'organizational history forward and are intended for governance planning purposes, not as a statistical ' +
      `prediction. ${forecastStatus === 'unavailable_insufficient_data'
        ? `No forecast is offered with fewer than ${MIN_COHORT_SIZE} resilience timeline points: the observed ` +
          'trajectoryPoints series is returned in full instead.'
        : ''}`,
    methodologyNote:
      forecastStatus === 'unavailable_insufficient_data'
        ? `Fewer than ${MIN_COHORT_SIZE} resilience timeline points were recorded, so no forecast is produced ` +
          '(a linear projection from a handful of typed scores is not distinguishable from noise). ' +
          'estimatedMonthsToNextMilestone is null for the same reason.'
        : 'forecast is a linear extrapolation from the typed resilience score history, adjusted by a momentum ' +
          "multiplier; each point's projectionBand is a fixed formula (min(monthsAhead * 3, 20)), not an interval " +
          "derived from the data's own variance - it is not a probabilistic or statistical forecast, and " +
          'estimatedMonthsToNextMilestone compounds the same linear assumption.',
  };
}
