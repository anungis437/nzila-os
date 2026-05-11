/**
 * Adaptive Resilience Engine
 *
 * Produces history-informed, weighted continuity recommendations.
 * Adjusts roadmap priorities based on what has worked historically
 * in this organization.
 *
 * All adaptations expose WHY they changed — full explainability.
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import { buildResilienceRoadmap } from '@/lib/knowledge-transfer/resilience-strategies/strategy-modeler';
import type {
  AdaptiveResilienceResult,
  AdaptedRecommendation,
  ResilienceAdaptationSummary,
  AdaptationReason,
} from './adaptive-models';
import type { CognitionMemoryEntry } from '@/lib/knowledge-transfer/cognition-memory/memory-models';

/** Derive adaptation reason from memory pattern analysis. */
function deriveAdaptationReason(
  strategyType: string,
  positiveEntries: CognitionMemoryEntry[],
  mitigationEntries: CognitionMemoryEntry[],
): { reason: AdaptationReason; evidence: string } {
  // Check if this strategy type appears in successful mitigation history
  const relatedMitigations = mitigationEntries.filter(
    (e) =>
      e.tags.some((t) => t.toLowerCase().includes(strategyType.toLowerCase())) ||
      e.title.toLowerCase().includes(strategyType.toLowerCase()),
  );

  if (relatedMitigations.length >= 2) {
    return {
      reason: 'historically_effective',
      evidence: `${relatedMitigations.length} prior mitigation comparisons reference this strategy area.`,
    };
  }

  if (positiveEntries.length >= 3) {
    return {
      reason: 'score_correlation',
      evidence: `${positiveEntries.length} periods of improving resilience align with this strategy domain.`,
    };
  }

  return {
    reason: 'unproven_approach',
    evidence: 'Insufficient historical data to confirm effectiveness. Applying default weighting.',
  };
}

/**
 * Compute adaptive resilience recommendations adjusted by organizational history.
 */
export async function computeAdaptiveResilience(
  orgId: string,
): Promise<AdaptiveResilienceResult> {
  const [store, roadmap] = await Promise.all([
    loadCognitionMemory(orgId, { limit: 100 }),
    buildResilienceRoadmap(orgId),
  ]);

  const mitigationEntries = store.entries.filter(
    (e) => e.memoryType === 'mitigation_comparison' || e.memoryType === 'continuity_assessment',
  );
  const governanceEntries = store.entries.filter(
    (e) => e.memoryType === 'governance_reasoning' || e.memoryType === 'decision_brief',
  );

  // Identify periods of resilience improvement
  const timeline = store.resilienceTimeline;
  const improvingPeriods = timeline.filter(
    (p) => p.changeFromPrevious !== null && p.changeFromPrevious > 0,
  );
  const decliningPeriods = timeline.filter(
    (p) => p.changeFromPrevious !== null && p.changeFromPrevious < -3,
  );

  const historyStrength = store.entries.length;
  let elevated = 0;
  let deprioritized = 0;
  let unadjusted = 0;

  const adaptedRecommendations: AdaptedRecommendation[] = roadmap.strategies.map((strategy, idx) => {
    const { reason, evidence } = deriveAdaptationReason(
      strategy.strategyType,
      improvingPeriods.map((p) => store.entries.find((e) => e.id === p.memoryEntryId)!).filter(Boolean),
      mitigationEntries,
    );

    let priorityDelta = 0;
    let adjustedGain = strategy.projectedResilienceGain;
    let confidence: AdaptedRecommendation['confidence'] = 'low';

    if (historyStrength < 3) {
      unadjusted++;
      confidence = 'low';
    } else if (reason === 'historically_effective') {
      priorityDelta = 2;
      adjustedGain = Math.min(strategy.projectedResilienceGain + 5, 30);
      elevated++;
      confidence = 'high';
    } else if (reason === 'score_correlation') {
      priorityDelta = 1;
      adjustedGain = Math.min(strategy.projectedResilienceGain + 2, 30);
      elevated++;
      confidence = 'medium';
    } else if (reason === 'unproven_approach' && decliningPeriods.length > improvingPeriods.length) {
      priorityDelta = -1;
      adjustedGain = Math.max(strategy.projectedResilienceGain - 3, 0);
      deprioritized++;
      confidence = 'low';
    } else {
      unadjusted++;
      confidence = 'medium';
    }

    return {
      id: strategy.strategyType,
      headline: strategy.name,
      originalPriority: idx + 1,
      adaptedPriority: Math.max(idx + 1 - priorityDelta, 1),
      priorityDelta,
      adaptationReason: reason,
      historicalEvidence: evidence,
      adjustedResilienceGain: adjustedGain,
      originalResilienceGain: strategy.projectedResilienceGain,
      confidence,
    };
  });

  // Sort by adapted priority
  adaptedRecommendations.sort((a, b) => a.adaptedPriority - b.adaptedPriority);

  let overallConfidence: ResilienceAdaptationSummary['overallConfidence'] = 'insufficient_history';
  if (historyStrength >= 10) overallConfidence = 'high';
  else if (historyStrength >= 5) overallConfidence = 'medium';
  else if (historyStrength >= 2) overallConfidence = 'low';

  const primaryDriver = mitigationEntries.length > 0
    ? `${mitigationEntries.length} mitigation comparison entries informed strategy weighting`
    : improvingPeriods.length > 0
    ? `${improvingPeriods.length} improvement periods used to elevate effective strategies`
    : 'Insufficient history — default weighting applied';

  const narrative = historyStrength < 3
    ? 'Insufficient organizational history to adapt recommendations. As cognition memory grows, recommendations will become increasingly tailored to your organization\'s effectiveness patterns.'
    : `Based on ${historyStrength} cognition entries, ${elevated} strategies were elevated and ${deprioritized} were deprioritized based on historical effectiveness patterns. ${improvingPeriods.length} resilience improvement periods and ${mitigationEntries.length} mitigation records were used to inform adaptation.`;

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    adaptedRecommendations,
    adaptationSummary: {
      elevatedCount: elevated,
      deprioritizedCount: deprioritized,
      unadjustedCount: unadjusted,
      overallConfidence,
      primaryAdaptationDriver: primaryDriver,
    },
    historyEntriesUsed: historyStrength,
    adaptationNarrative: narrative,
  };
}
