/**
 * CLC Executive Intelligence — Prioritization Engine
 *
 * Ranks heterogeneous strategic signals (patterns, recommendations,
 * briefing cards, divergences) into a unified list of executive
 * priorities using multi-factor scoring.
 *
 * Scoring factors:
 * - Watch level severity
 * - Recommendation urgency
 * - Confidence
 * - Breadth of impact (affected sectors / affiliate types)
 * - Trend velocity (from sector divergence)
 * - Novelty (new vs already-known patterns)
 *
 * @module prioritization
 */

import type {
  ExecutivePriority,
  WatchLevel,
  DecisionIntelligenceOutput,
} from '../contracts/index';
import type { RecommendedAction, ActionTimeframe } from '@nzila/clc-decision-intelligence';

// ── Scoring Constants ───────────────────────────────────────────────────────

const WATCH_LEVEL_SCORES: Record<WatchLevel, number> = {
  critical: 1.0,
  high: 0.75,
  elevated: 0.45,
  monitor: 0.2,
};

const ACTION_URGENCY_SCORES: Record<RecommendedAction, number> = {
  intervene: 1.0,
  escalate: 0.75,
  prepare: 0.45,
  monitor: 0.2,
};

const TIMEFRAME_URGENCY_SCORES: Record<ActionTimeframe, number> = {
  now: 1.0,
  '7_days': 0.75,
  '30_days': 0.5,
  pre_bargaining: 0.35,
  this_quarter: 0.2,
};

const SCORING_WEIGHTS = {
  watchLevel: 0.20,
  actionUrgency: 0.15,
  timeframe: 0.10,
  confidence: 0.15,
  breadth: 0.15,
  velocity: 0.10,
  novelty: 0.15,
} as const;

// ── Scoring Functions ───────────────────────────────────────────────────────

/**
 * Compute the executive priority score for a single candidate.
 * All factor contributions are normalized to [0, 1] before weighting.
 */
export function computeExecutivePriorityScore(params: {
  watchLevel: WatchLevel;
  recommendedAction: RecommendedAction;
  timeframe: ActionTimeframe;
  confidence: number;
  affectedSectorCount: number;
  velocity: number;
  isNovel: boolean;
}): number {
  const watchScore = WATCH_LEVEL_SCORES[params.watchLevel];
  const actionScore = ACTION_URGENCY_SCORES[params.recommendedAction];
  const timeframeScore = TIMEFRAME_URGENCY_SCORES[params.timeframe];
  const confidenceScore = Math.max(0, Math.min(1, params.confidence));
  // Breadth: saturates at 5 sectors
  const breadthScore = Math.min(1, params.affectedSectorCount / 5);
  // Velocity: normalize — values > 3 are high
  const velocityScore = Math.min(1, Math.abs(params.velocity) / 3);
  // Novelty: binary boost
  const noveltyScore = params.isNovel ? 1.0 : 0.3;

  return (
    watchScore * SCORING_WEIGHTS.watchLevel +
    actionScore * SCORING_WEIGHTS.actionUrgency +
    timeframeScore * SCORING_WEIGHTS.timeframe +
    confidenceScore * SCORING_WEIGHTS.confidence +
    breadthScore * SCORING_WEIGHTS.breadth +
    velocityScore * SCORING_WEIGHTS.velocity +
    noveltyScore * SCORING_WEIGHTS.novelty
  );
}

/**
 * Build executive priorities from decision intelligence output.
 *
 * Merges patterns, recommendations, and briefing cards into
 * a single priority list scored by the multi-factor engine.
 */
export function rankExecutivePriorities(
  output: DecisionIntelligenceOutput,
  knownPatternIds?: Set<string>,
): ExecutivePriority[] {
  const priorities: ExecutivePriority[] = [];

  for (const pattern of output.patterns) {
    const rec = output.recommendations.find((r) => r.signalId === pattern.id);
    const divergences = output.sectorDivergence.filter(
      (d) => pattern.affectedSectors.includes(d.sector),
    );
    const maxVelocity = divergences.length > 0
      ? Math.max(...divergences.map((d) => Math.abs(d.velocity)))
      : 0;

    const isNovel = knownPatternIds ? !knownPatternIds.has(pattern.id) : true;

    const watchLevel = pattern.watchLevel as WatchLevel;
    const recommendedAction: RecommendedAction = rec?.recommendedAction ?? 'monitor';
    const timeframe: ActionTimeframe = (rec?.timeframe as ActionTimeframe) ?? 'this_quarter';

    const priorityScore = computeExecutivePriorityScore({
      watchLevel,
      recommendedAction,
      timeframe,
      confidence: pattern.confidence,
      affectedSectorCount: pattern.affectedSectors.length,
      velocity: maxVelocity,
      isNovel,
    });

    const whyItMatters = buildWhyItMatters(pattern.title, pattern.affectedSectors, watchLevel, recommendedAction);

    const sourceTypes: string[] = [pattern.patternType];
    if (isNovel) sourceTypes.push('novel');

    priorities.push({
      id: `EXEC-${pattern.id}`,
      title: pattern.title,
      watchLevel,
      recommendedAction,
      timeframe,
      confidence: pattern.confidence,
      whyItMatters,
      evidenceRefs: pattern.evidenceRefs,
      sourceTypes,
      priorityScore,
    });
  }

  // Add bargaining watch as a priority if active
  if (output.bargainingWatch) {
    const bw = output.bargainingWatch;
    const isNovel = knownPatternIds
      ? !knownPatternIds.has('bargaining-watch')
      : true;

    const bwWatchLevel: WatchLevel = bw.signalStrength === 'strong' ? 'high' : 'elevated';

    const priorityScore = computeExecutivePriorityScore({
      watchLevel: bwWatchLevel,
      recommendedAction: bw.recommendedAction as RecommendedAction,
      timeframe: '7_days',
      confidence: bw.confidence,
      affectedSectorCount: bw.sectors.length,
      velocity: 0,
      isNovel,
    });

    priorities.push({
      id: 'EXEC-BARGAINING-WATCH',
      title: bw.headline,
      watchLevel: bwWatchLevel,
      recommendedAction: bw.recommendedAction as RecommendedAction,
      timeframe: '7_days',
      confidence: bw.confidence,
      whyItMatters: `Pre-bargaining pressure detected across ${bw.sectors.length} sector(s). Early preparation can improve negotiation positioning for affiliates.`,
      evidenceRefs: bw.evidenceRefs,
      sourceTypes: ['bargaining_pressure_signal'],
      priorityScore,
    });
  }

  return priorities.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Select the top N executive priorities.
 */
export function selectTopExecutivePriorities(
  output: DecisionIntelligenceOutput,
  limit: number = 5,
  knownPatternIds?: Set<string>,
): ExecutivePriority[] {
  return rankExecutivePriorities(output, knownPatternIds).slice(0, limit);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildWhyItMatters(
  title: string,
  sectors: string[],
  watchLevel: WatchLevel,
  action: RecommendedAction,
): string {
  const sectorPhrase = sectors.length > 2
    ? `${sectors.length} sectors including ${sectors[0]}`
    : sectors.join(' and ');

  const urgencyPhrase = action === 'intervene'
    ? 'Requires immediate coordinated intervention'
    : action === 'escalate'
      ? 'Warrants executive escalation and review'
      : action === 'prepare'
        ? 'Proactive preparation recommended'
        : 'Should be monitored for escalation';

  return `${title} affects ${sectorPhrase || 'multiple dimensions'}. ${urgencyPhrase}. Watch level: ${watchLevel}.`;
}
