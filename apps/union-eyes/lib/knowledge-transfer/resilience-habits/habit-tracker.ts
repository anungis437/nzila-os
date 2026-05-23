/**
 * Resilience Habit Formation Tracker
 *
 * Measures how consistently an organization engages in continuity-strengthening behaviors.
 * Tracks review cadence, mitigation follow-through, documentation discipline, and more.
 *
 * SCOPE: Organizational habits — NOT individual performance measurement.
 * Outputs are developmental and organizational, not disciplinary.
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import { listReasoningSessions } from '@/lib/knowledge-transfer/reasoning-sessions/session-manager';
import type {
  ResilienceHabitProfile,
  HabitDimensionScore,
  ResilienceHabitDimension,
  HabitTier,
} from './habit-models';

function habitTier(score: number): HabitTier {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'developing';
  if (score >= 15) return 'emerging';
  return 'absent';
}

function scoreReviewCadence(
  totalInteractions: number,
  avgDaysBetween: number | null,
): HabitDimensionScore {
  let score = 0;
  if (avgDaysBetween !== null) {
    score = avgDaysBetween <= 7 ? 90 :
            avgDaysBetween <= 14 ? 75 :
            avgDaysBetween <= 30 ? 55 :
            avgDaysBetween <= 60 ? 35 :
            avgDaysBetween <= 90 ? 20 : 10;
  } else if (totalInteractions >= 3) {
    score = 20; // Has interactions but no calculable interval
  }

  const obs = avgDaysBetween !== null
    ? `Average ${avgDaysBetween} days between governance activities.`
    : totalInteractions > 0
      ? `${totalInteractions} governance interactions recorded — cadence interval undetermined.`
      : 'No governance activity recorded.';

  return {
    dimension: 'review_cadence',
    label: 'Review Cadence',
    score,
    tier: habitTier(score),
    observation: obs,
    evidence: `Derived from ${totalInteractions} activity timestamps.`,
    recommendation: score < 55
      ? 'Establish a regular continuity review schedule — bi-weekly or monthly governance check-ins build organizational resilience habits.'
      : 'Maintain current review cadence and consider formalizing governance review schedules.',
  };
}

function scoreMitigationFollowThrough(mitCount: number, assessmentCount: number): HabitDimensionScore {
  const ratio = assessmentCount > 0 ? mitCount / assessmentCount : mitCount > 0 ? 1 : 0;
  const score = assessmentCount === 0 && mitCount === 0 ? 0 :
                mitCount === 0 ? 5 :
                Math.min(Math.round(ratio * 80) + 10, 95);

  return {
    dimension: 'mitigation_follow_through',
    label: 'Mitigation Follow-Through',
    score,
    tier: habitTier(score),
    observation: assessmentCount > 0
      ? `${mitCount} mitigations documented for ${assessmentCount} continuity assessments (${Math.round(ratio * 100)}% follow-through).`
      : mitCount > 0
        ? `${mitCount} mitigation comparisons recorded without paired continuity assessments.`
        : 'No mitigation follow-through documented.',
    evidence: `${mitCount} mitigation_comparison entries, ${assessmentCount} continuity_assessment entries.`,
    recommendation: score < 60
      ? 'Document mitigations for each identified continuity risk to build a traceable governance record.'
      : 'Strong mitigation documentation habit — continue and expand to include effectiveness outcomes.',
  };
}

function scoreDocumentationDiscipline(govCount: number, totalEntries: number, sessionCount: number): HabitDimensionScore {
  const totalDocs = govCount + totalEntries;
  const score = totalDocs === 0 ? 0 :
                Math.min(
                  (govCount >= 5 ? 35 : govCount * 6) +
                  (totalEntries >= 10 ? 35 : totalEntries * 3) +
                  (sessionCount >= 4 ? 30 : sessionCount * 6),
                  100
                );

  return {
    dimension: 'documentation_discipline',
    label: 'Documentation Discipline',
    score,
    tier: habitTier(score),
    observation: `${totalEntries} memory entries and ${govCount} governance decisions documented. ${sessionCount} reasoning sessions in record.`,
    evidence: `${govCount} governance_reasoning/decision_brief entries, ${totalEntries} total cognition entries, ${sessionCount} sessions.`,
    recommendation: score < 60
      ? 'Increase governance documentation — capture decisions, assessments, and reasoning sessions to build organizational knowledge.'
      : 'Documentation discipline is a strength — ensure records are reviewed and acted upon regularly.',
  };
}

function scoreGovernanceResponsiveness(
  timeline: { resilienceScore: number; changeFromPrevious: number | null }[],
  sessionCount: number,
): HabitDimensionScore {
  if (timeline.length < 2 && sessionCount === 0) {
    return {
      dimension: 'governance_responsiveness',
      label: 'Governance Responsiveness',
      score: 0,
      tier: 'absent',
      observation: 'Insufficient history to assess governance responsiveness.',
      evidence: 'No resilience timeline data and no sessions.',
      recommendation: 'Begin capturing governance responses to continuity events to build responsiveness history.',
    };
  }

  // Look for positive response after negative changes
  let responsiveActions = 0;
  let declinesWithoutResponse = 0;
  for (let i = 1; i < timeline.length; i++) {
    const change = timeline[i].changeFromPrevious;
    if (change !== null && change < -3) {
      // Check if there's a recovery in the next point
      const nextChange = timeline[i + 1]?.changeFromPrevious ?? null;
      if (nextChange !== null && nextChange > 0) responsiveActions++;
      else declinesWithoutResponse++;
    }
  }

  const declines = responsiveActions + declinesWithoutResponse;
  const responseRate = declines > 0 ? responsiveActions / declines : sessionCount > 0 ? 0.5 : 0;
  const score = Math.min(
    Math.round(responseRate * 60) + Math.min(sessionCount * 8, 40),
    100
  );

  return {
    dimension: 'governance_responsiveness',
    label: 'Governance Responsiveness',
    score,
    tier: habitTier(score),
    observation: declines > 0
      ? `${responsiveActions} of ${declines} resilience declines were followed by governance recovery actions.`
      : `${sessionCount} reasoning sessions demonstrate proactive governance engagement.`,
    evidence: `${responsiveActions} recovery patterns, ${declinesWithoutResponse} unaddressed declines, ${sessionCount} sessions.`,
    recommendation: score < 55
      ? 'Develop a governance response protocol for resilience score declines — timely responses prevent deterioration.'
      : 'Governance responsiveness is solid — formalize the response protocol for sustained reliability.',
  };
}

function scoreContinuityPlanning(
  totalEntries: number,
  sessionCount: number,
  trend: string,
): HabitDimensionScore {
  const planningSignals = totalEntries + sessionCount * 2;
  const score = trend === 'improving'
    ? Math.min(planningSignals * 5, 90)
    : trend === 'stable'
      ? Math.min(planningSignals * 4, 75)
      : Math.min(planningSignals * 2, 50);

  return {
    dimension: 'continuity_planning',
    label: 'Continuity Planning',
    score,
    tier: habitTier(score),
    observation: `${sessionCount} planning sessions and ${totalEntries} continuity memory captures — planning engagement is ${score >= 60 ? 'active' : score >= 30 ? 'moderate' : 'limited'}.`,
    evidence: `${totalEntries} memory entries, ${sessionCount} reasoning sessions, resilience trend: ${trend}.`,
    recommendation: score < 55
      ? 'Deepen continuity planning with regular scenario analysis and governance sessions to build planning muscle.'
      : 'Strong planning habit — expand to include scenario simulation and multi-horizon forecasting.',
  };
}

function scoreResilienceAssessment(
  timelineLength: number,
  baselineCount: number,
): HabitDimensionScore {
  const score = Math.min(
    (timelineLength >= 10 ? 50 : timelineLength * 5) +
    (baselineCount >= 5 ? 30 : baselineCount * 6) +
    (timelineLength >= 5 ? 20 : 0),
    100
  );

  return {
    dimension: 'resilience_assessment',
    label: 'Resilience Assessment',
    score,
    tier: habitTier(score),
    observation: `${timelineLength} resilience measurements and ${baselineCount} baseline captures recorded.`,
    evidence: `${timelineLength} resilience timeline points, ${baselineCount} resilience_baseline entries.`,
    recommendation: score < 50
      ? 'Establish regular resilience scoring checkpoints to build assessment history and enable trend analysis.'
      : 'Assessment discipline is strong — connect scores to specific governance interventions for causal insight.',
  };
}

function computeConsistencyScore(
  dimensions: HabitDimensionScore[],
): number {
  if (dimensions.length === 0) return 0;
  const scores = dimensions.map((d) => d.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  const std = Math.sqrt(variance);
  // Low std = more consistent (higher score). High std = inconsistent (lower score).
  return Math.max(0, Math.round(100 - std));
}

function avgDaysBetween(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort();
  let totalMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalMs += new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
  }
  return Math.round(totalMs / (sorted.length - 1) / 86_400_000);
}

function resilienceTrend(scores: number[]): string {
  if (scores.length < 2) return 'insufficient_data';
  const delta = scores[scores.length - 1] - scores[0];
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const std = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length);
  if (std > 15) return 'volatile';
  if (delta >= 8) return 'improving';
  if (delta <= -8) return 'declining';
  return 'stable';
}

/** Track organizational resilience habit formation from organizational history. */
export async function trackResilienceHabits(orgId: string): Promise<ResilienceHabitProfile> {
  const [store, sessions] = await Promise.all([
    loadCognitionMemory(orgId, { limit: 100 }),
    listReasoningSessions(orgId, { limit: 50 }),
  ]);

  const entries = store.entries;
  const timeline = store.resilienceTimeline;
  const totalEntries = entries.length;
  const sessionCount = sessions.length;

  const mitCount = entries.filter((e) => e.memoryType === 'mitigation_comparison').length;
  const assessmentCount = entries.filter((e) => e.memoryType === 'continuity_assessment').length;
  const govCount = entries.filter(
    (e) => e.memoryType === 'governance_reasoning' || e.memoryType === 'decision_brief',
  ).length;
  const baselineCount = entries.filter((e) => e.memoryType === 'resilience_baseline').length;

  const allDates = [...entries.map((e) => e.createdAt), ...sessions.map((s) => s.createdAt)];
  const avgDays = avgDaysBetween(allDates);
  const scores = timeline.map((t) => t.resilienceScore);
  const trend = resilienceTrend(scores);

  const dimensions: HabitDimensionScore[] = [
    scoreReviewCadence(totalEntries + sessionCount, avgDays),
    scoreMitigationFollowThrough(mitCount, assessmentCount),
    scoreDocumentationDiscipline(govCount, totalEntries, sessionCount),
    scoreGovernanceResponsiveness(timeline as { resilienceScore: number; changeFromPrevious: number | null }[], sessionCount),
    scoreContinuityPlanning(totalEntries, sessionCount, trend),
    scoreResilienceAssessment(timeline.length, baselineCount),
  ];

  const overallHabitScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
  );

  const sorted = [...dimensions].sort((a, b) => b.score - a.score);
  const strongestHabit: ResilienceHabitDimension | null = sorted[0]?.score >= 60 ? sorted[0].dimension : null;
  const developmentPriority: ResilienceHabitDimension | null = sorted[sorted.length - 1]?.score < 60
    ? sorted[sorted.length - 1].dimension
    : null;

  const consistencyScore = computeConsistencyScore(dimensions);
  const overallTier = habitTier(overallHabitScore);

  const tierDesc: Record<HabitTier, string> = {
    strong: 'strong organizational resilience habits',
    developing: 'developing resilience habits with room to grow',
    emerging: 'emerging resilience habits in early formation',
    absent: 'limited resilience habit formation — governance investment is needed',
  };

  const habitNarrative = `This organization demonstrates ${tierDesc[overallTier]}. Overall habit score: ${overallHabitScore}/100. Consistency across dimensions: ${consistencyScore}/100. ${strongestHabit ? `Strongest habit: ${dimensions.find((d) => d.dimension === strongestHabit)?.label}.` : ''} ${developmentPriority ? `Development priority: ${dimensions.find((d) => d.dimension === developmentPriority)?.label}.` : ''}`;

  return {
    organizationId: orgId,
    analyzedAt: new Date().toISOString(),
    overallHabitScore,
    overallTier,
    dimensions,
    strongestHabit,
    developmentPriority,
    habitNarrative,
    consistencyScore,
    entriesAnalyzed: totalEntries,
    interpretationGuidance:
      'Resilience habits are measured at the organizational level — these are organizational continuity practices, not individual performance metrics. All insights are intended to support organizational development.',
  };
}
