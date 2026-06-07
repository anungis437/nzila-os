/**
 * Mitigation Effectiveness Tracker
 *
 * Evaluates whether continuity interventions actually improved organizational resilience.
 * Measures resilience ROI of governance investments over time.
 *
 * Scope: organizational continuity effectiveness ONLY.
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import type {
  MitigationEffectivenessReport,
  MitigationIntervention,
  MitigationOutcome,
  EffectivenessDimension,
  EffectivenessRating,
} from './effectiveness-models';

function rateEffectiveness(scoreChange: number | null): EffectivenessRating {
  if (scoreChange === null) return 'unverified';
  if (scoreChange >= 10) return 'highly_effective';
  if (scoreChange >= 5) return 'moderately_effective';
  if (scoreChange >= 1) return 'marginally_effective';
  if (scoreChange >= -3) return 'ineffective';
  return 'counterproductive';
}

function overallRating(outcomes: MitigationOutcome[]): EffectivenessRating {
  const verified = outcomes.filter((o) => o.effectivenessRating !== 'unverified');
  if (verified.length === 0) return 'unverified';

  const ratings = verified.map((o) => o.effectivenessRating);
  const highlyEffective = ratings.filter((r) => r === 'highly_effective').length;
  const moderatelyEffective = ratings.filter((r) => r === 'moderately_effective').length;
  const ineffective = ratings.filter(
    (r) => r === 'ineffective' || r === 'counterproductive',
  ).length;

  const positiveRatio = (highlyEffective + moderatelyEffective) / verified.length;
  if (positiveRatio >= 0.8) return 'highly_effective';
  if (positiveRatio >= 0.6) return 'moderately_effective';
  if (positiveRatio >= 0.3) return 'marginally_effective';
  if (ineffective / verified.length >= 0.6) return 'ineffective';
  return 'marginally_effective';
}

/**
 * Track mitigation effectiveness by comparing resilience scores before and after interventions.
 */
export async function trackMitigationEffectiveness(
  orgId: string,
): Promise<MitigationEffectivenessReport> {
  const store = await loadCognitionMemory(orgId, { limit: 100 });

  // Collect intervention entries (mitigation + continuity assessments)
  const interventionEntries = store.entries.filter(
    (e) =>
      e.memoryType === 'mitigation_comparison' ||
      e.memoryType === 'continuity_assessment',
  );

  const interventions: MitigationIntervention[] = interventionEntries.map((e) => ({
    id: e.id,
    title: e.title,
    recordedAt: e.createdAt,
    memoryEntryId: e.id,
    resilienceScoreAtRecording: e.resilienceScoreAtCapture,
    tags: e.tags,
  }));

  // Match interventions with subsequent baseline entries to measure impact
  const baselineEntries = store.entries
    .filter((e) => e.resilienceScoreAtCapture !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const outcomes: MitigationOutcome[] = [];
  const unverified: MitigationIntervention[] = [];

  for (const intervention of interventions) {
    const scoreAtIntervention = intervention.resilienceScoreAtRecording;

    // Find next baseline entry after this intervention
    const subsequentBaseline = baselineEntries.find(
      (e) =>
        e.createdAt > intervention.recordedAt &&
        e.id !== intervention.id &&
        e.resilienceScoreAtCapture !== null,
    );

    if (!subsequentBaseline || scoreAtIntervention === null) {
      unverified.push(intervention);
      continue;
    }

    const resilienceAfter = subsequentBaseline.resilienceScoreAtCapture!;
    const scoreChange = resilienceAfter - scoreAtIntervention;
    const daysBetween = Math.round(
      (new Date(subsequentBaseline.createdAt).getTime() -
        new Date(intervention.recordedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const effectiveness = rateEffectiveness(scoreChange);
    const resilienceRoi = scoreChange > 0 ? Math.round(scoreChange * 10) / 10 : null;

    outcomes.push({
      interventionId: intervention.id,
      interventionTitle: intervention.title,
      recordedAt: intervention.recordedAt,
      resilienceAtIntervention: scoreAtIntervention,
      resilienceAfter,
      scoreChange,
      effectivenessRating: effectiveness,
      resilienceRoi,
      daysToObservableEffect: daysBetween,
    });
  }

  // Compute average resilience gain
  const verifiedOutcomes = outcomes.filter((o) => o.scoreChange !== null);
  const totalGain = verifiedOutcomes.reduce((sum, o) => sum + (o.scoreChange ?? 0), 0);
  const averageGain = verifiedOutcomes.length > 0
    ? Math.round((totalGain / verifiedOutcomes.length) * 10) / 10
    : 0;

  // Find most and least effective
  const sortedByChange = [...verifiedOutcomes].sort(
    (a, b) => (b.scoreChange ?? 0) - (a.scoreChange ?? 0),
  );
  const mostEffective = sortedByChange[0] ?? null;
  const ineffectiveInterventions = outcomes.filter(
    (o) => o.effectivenessRating === 'ineffective' || o.effectivenessRating === 'counterproductive',
  );

  // Dimension breakdown by tag categories
  const tagCounts: Record<string, { changes: number[]; label: string }> = {};
  for (const outcome of verifiedOutcomes) {
    const intervention = interventions.find((i) => i.id === outcome.interventionId);
    const tags = intervention?.tags ?? [];
    const primaryTag = tags.find((t) => !['approved', 'deferred', 'rejected', 'pending'].includes(t)) ?? 'general';
    if (!tagCounts[primaryTag]) {
      tagCounts[primaryTag] = { changes: [], label: primaryTag };
    }
    tagCounts[primaryTag].changes.push(outcome.scoreChange ?? 0);
  }

  const dimensionBreakdown: EffectivenessDimension[] = Object.entries(tagCounts).map(
    ([dimension, { changes }]) => {
      const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
      return {
        dimension,
        averageScoreChange: Math.round(avg * 10) / 10,
        interventionCount: changes.length,
        effectivenessRating: rateEffectiveness(avg),
      };
    },
  );

  const overall = overallRating(outcomes);

  const recommendationMap: Record<EffectivenessRating, string> = {
    highly_effective: 'Historical continuity interventions demonstrate strong resilience impact. Continue and expand current governance investment patterns.',
    moderately_effective: 'Most interventions produce positive resilience outcomes. Focus on identifying what distinguishes highly effective interventions.',
    marginally_effective: 'Interventions show modest gains. Review governance process quality and follow-through on mitigation recommendations.',
    ineffective: 'Historical interventions have not produced measurable resilience improvement. Conduct a governance strategy review.',
    counterproductive: 'Some interventions correlate with resilience decline. Urgent governance strategy review recommended.',
    unverified: 'Insufficient follow-up data to assess intervention effectiveness. Establish regular resilience baseline captures.',
  };

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    outcomes,
    dimensionBreakdown,
    averageResilienceGain: averageGain,
    mostEffectiveIntervention: mostEffective,
    ineffectiveInterventions,
    unverifiedInterventions: unverified,
    overallEffectivenessRating: overall,
    continuityRecommendation: recommendationMap[overall] ?? 'Continue building effectiveness history.',
  };
}
