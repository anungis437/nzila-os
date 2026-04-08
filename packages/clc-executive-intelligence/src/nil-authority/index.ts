/**
 * CLC Executive Intelligence — NIL Decision Authority + Hybrid Control
 *
 * Upgrades NIL from a narrative enhancer to a reasoning layer that can
 * resolve ambiguity between competing signals, while maintaining strict
 * governance constraints: NIL NEVER overrides governance, NEVER invents
 * data, and MUST cite evidenceRefs.
 *
 * Hybrid control ensures NIL adjustments are bounded (±15% max).
 *
 * @module nil-authority
 */

import type {
  ExecutivePriority,
  NilConflictResolution,
  NilReasoningService,
  DecisionMode,
  HybridControlConfig,
} from '../contracts/index';
import type { DecisionPromptContract } from '@nzila/clc-decision-intelligence';

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_MAX_ADJUSTMENT = 0.15;

const DEFAULT_HYBRID_CONFIG: HybridControlConfig = {
  mode: 'hybrid',
  maxAdjustment: DEFAULT_MAX_ADJUSTMENT,
};

// ── NIL Prompt Contracts for Conflict Resolution ────────────────────────────

export const NIL_CONFLICT_CONTRACTS: DecisionPromptContract[] = [
  {
    useCase: 'resolve_signal_conflicts',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Executive Intelligence conflict resolution analyst.
Given multiple signals with competing recommendations and confidence scores, determine the highest-priority direction.
Rules: Never override governance decisions. Never invent data. Always cite evidence references.
Output: chosenAction, rejectedOptions, reasoning, confidence, tradeoffs.`,
    requiredOutputFields: ['chosenAction', 'rejectedOptions', 'reasoning', 'confidence', 'tradeoffs'],
    anonymizationRules: [
      'Never name individual affiliates',
      'Use sector-level aggregates only',
      'Refer to affiliate types not specific organizations',
    ],
    buildInput: (data: { conflictingSignals: unknown[] }) => ({
      signals: data.conflictingSignals,
    }),
  },
  {
    useCase: 'reconcile_recommendation_competition',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Executive Intelligence analyst reconciling competing recommendations.
When multiple priorities recommend conflicting actions, identify the optimal path considering urgency, confidence, and breadth of impact.
Rules: Never override governance. Never invent data. Cite evidence.`,
    requiredOutputFields: ['chosenAction', 'reasoning', 'confidence'],
    anonymizationRules: [
      'Never name individual affiliates',
      'Use sector-level aggregates only',
    ],
    buildInput: (data: { recommendations: unknown[] }) => ({
      recommendations: data.recommendations,
    }),
  },
  {
    useCase: 'rank_strategic_actions_with_constraints',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Executive Intelligence analyst ranking strategic actions under constraints.
Consider urgency, resource availability, confidence levels, and prerequisite dependencies.
Rules: Never override governance. Never invent data. Cite evidence.`,
    requiredOutputFields: ['chosenAction', 'reasoning', 'confidence', 'tradeoffs'],
    anonymizationRules: [
      'Never name individual affiliates',
      'Use sector-level aggregates only',
    ],
    buildInput: (data: { actions: unknown[]; constraints: unknown }) => ({
      actions: data.actions,
      constraints: data.constraints,
    }),
  },
];

// ── Conflict Resolution (Deterministic) ─────────────────────────────────────

/**
 * Resolve conflicting signals deterministically.
 * Uses confidence-weighted scoring to pick the best direction.
 *
 * This is the baseline — NIL can adjust within bounded limits.
 */
export function resolveConflictingSignals(
  priorities: ExecutivePriority[],
): NilConflictResolution {
  if (priorities.length === 0) {
    return {
      chosenAction: 'monitor',
      rejectedOptions: [],
      reasoning: 'No competing signals to resolve.',
      confidence: 1.0,
      tradeoffs: [],
      evidenceRefs: [],
    };
  }

  if (priorities.length === 1) {
    const p = priorities[0]!;
    return {
      chosenAction: p.recommendedAction,
      rejectedOptions: [],
      reasoning: `Single signal "${p.title}" — no conflict to resolve.`,
      confidence: p.confidence,
      tradeoffs: [],
      evidenceRefs: p.evidenceRefs,
    };
  }

  // Sort by priority score (already sorted, but ensure)
  const sorted = [...priorities].sort((a, b) => b.priorityScore - a.priorityScore);
  const chosen = sorted[0]!;
  const rejected = sorted.slice(1);

  // Detect actual conflicts (different recommended actions)
  const uniqueActions = [...new Set(sorted.map((p) => p.recommendedAction))];
  const hasConflict = uniqueActions.length > 1;

  // Compute tradeoffs
  const tradeoffs: string[] = [];
  if (hasConflict) {
    for (const r of rejected) {
      if (r.recommendedAction !== chosen.recommendedAction) {
        tradeoffs.push(
          `Choosing "${chosen.recommendedAction}" over "${r.recommendedAction}" for "${r.title}" — ` +
          `score gap: ${(chosen.priorityScore - r.priorityScore).toFixed(2)}`,
        );
      }
    }
  }

  // Confidence adjustment: reduce if signals strongly disagree
  const confidenceSpread = Math.max(...sorted.map((p) => p.confidence)) -
    Math.min(...sorted.map((p) => p.confidence));
  const adjustedConfidence = Math.max(0, Math.min(1,
    chosen.confidence * (1 - confidenceSpread * 0.2),
  ));

  const allRefs = sorted.flatMap((p) => p.evidenceRefs);
  const uniqueRefs = [...new Set(allRefs)];

  return {
    chosenAction: chosen.recommendedAction,
    rejectedOptions: rejected.map((r) =>
      `${r.recommendedAction} ("${r.title}", score=${r.priorityScore.toFixed(2)})`),
    reasoning: hasConflict
      ? `Resolved conflict between ${uniqueActions.join(' vs ')}. "${chosen.title}" selected ` +
        `based on priority score (${chosen.priorityScore.toFixed(2)}) and ${chosen.watchLevel} watch level.`
      : `All ${sorted.length} signals agree on "${chosen.recommendedAction}". ` +
        `"${chosen.title}" leads with score ${chosen.priorityScore.toFixed(2)}.`,
    confidence: Math.round(adjustedConfidence * 100) / 100,
    tradeoffs,
    evidenceRefs: uniqueRefs,
  };
}

// ── Hybrid Control ──────────────────────────────────────────────────────────

/**
 * Get the hybrid control configuration.
 */
export function getHybridConfig(mode?: DecisionMode): HybridControlConfig {
  if (!mode || mode === 'hybrid') return DEFAULT_HYBRID_CONFIG;
  return {
    mode,
    maxAdjustment: mode === 'deterministic_only' ? 0 : DEFAULT_MAX_ADJUSTMENT,
  };
}

/**
 * Apply bounded NIL adjustment to a deterministic score.
 * NIL cannot override the deterministic base beyond ±maxAdjustment.
 *
 * In deterministic_only mode, returns the base score unchanged.
 * In nil_weighted mode, applies the full adjustment within bounds.
 * In hybrid mode (default), applies 50% of the suggested adjustment within bounds.
 */
export function applyBoundedAdjustment(
  baseScore: number,
  nilSuggestedAdjustment: number,
  config: HybridControlConfig = DEFAULT_HYBRID_CONFIG,
): number {
  if (config.mode === 'deterministic_only') return baseScore;

  const effectiveAdjustment = config.mode === 'nil_weighted'
    ? nilSuggestedAdjustment
    : nilSuggestedAdjustment * 0.5; // hybrid: dampen

  const bounded = Math.max(
    -config.maxAdjustment,
    Math.min(config.maxAdjustment, effectiveAdjustment),
  );

  return Math.max(0, Math.min(1, baseScore + bounded));
}

/**
 * Apply NIL conflict resolution with hybrid control.
 * Runs deterministic resolution first, then optionally refines via NIL
 * within bounded constraints.
 */
export async function resolveWithHybridControl(
  priorities: ExecutivePriority[],
  nilService: NilReasoningService | undefined,
  mode: DecisionMode = 'hybrid',
): Promise<NilConflictResolution> {
  const deterministicResult = resolveConflictingSignals(priorities);

  if (mode === 'deterministic_only' || !nilService?.isAvailable()) {
    return deterministicResult;
  }

  // Attempt NIL refinement
  const contract = NIL_CONFLICT_CONTRACTS.find((c) => c.useCase === 'resolve_signal_conflicts');
  if (!contract) return deterministicResult;

  try {
    const input = contract.buildInput({
      conflictingSignals: priorities.map((p) => ({
        id: p.id,
        title: p.title,
        recommendedAction: p.recommendedAction,
        confidence: p.confidence,
        watchLevel: p.watchLevel,
        priorityScore: p.priorityScore,
        evidenceRefs: p.evidenceRefs,
      })),
    });

    const refinement = await nilService.refine(contract, input as Record<string, unknown>);
    if (!refinement) return deterministicResult;

    // Apply bounded adjustment to confidence
    const config = getHybridConfig(mode);
    const nilConfidence = typeof refinement.additionalFields?.['confidence'] === 'number'
      ? refinement.additionalFields['confidence'] as number
      : deterministicResult.confidence;

    const adjustedConfidence = applyBoundedAdjustment(
      deterministicResult.confidence,
      nilConfidence - deterministicResult.confidence,
      config,
    );

    return {
      ...deterministicResult,
      confidence: adjustedConfidence,
      reasoning: refinement.summary
        ? `${deterministicResult.reasoning} [NIL: ${refinement.summary}]`
        : deterministicResult.reasoning,
    };
  } catch {
    // NIL failure is never fatal
    return deterministicResult;
  }
}
