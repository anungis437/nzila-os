/**
 * CLC Executive Intelligence — Multi-Signal Reasoning Engine
 *
 * Evaluates signals in combination rather than independently.
 * Detects reinforcing signals, conflicting signals, and cascading effects.
 *
 * Feeds into: prioritization scoring, recommendation engine, NIL reasoning.
 *
 * @module reasoning/multi-signal-engine
 */

import type {
  ExecutivePriority,
  MultiSignalAnalysis,
  SignalInteractionType,
} from '../contracts/index';

// ── Signal Pair Analysis ────────────────────────────────────────────────────

interface SignalPairResult {
  signalA: string;
  signalB: string;
  interaction: SignalInteractionType;
  impactModifier: number;
}

/**
 * Determine interaction between two signals.
 *
 * Rules:
 * - Same recommended action + overlapping sectors → reinforcing
 * - Conflicting actions (escalate vs monitor) → conflicting
 * - Low confidence + high severity → reduces escalation confidence
 * - Otherwise → independent
 */
function analyzeSignalPair(a: ExecutivePriority, b: ExecutivePriority): SignalPairResult {
  const sameAction = a.recommendedAction === b.recommendedAction;
  const overlappingSources = a.sourceTypes.some((s) => b.sourceTypes.includes(s));

  // Action conflict scoring
  const actionConflict = detectActionConflict(a.recommendedAction, b.recommendedAction);

  if (sameAction && overlappingSources) {
    // Reinforcing: same action + related source types
    return {
      signalA: a.id,
      signalB: b.id,
      interaction: 'reinforcing',
      impactModifier: 0.15, // boost combined impact
    };
  }

  if (sameAction) {
    // Same action but independent sources — mildly reinforcing
    return {
      signalA: a.id,
      signalB: b.id,
      interaction: 'reinforcing',
      impactModifier: 0.08,
    };
  }

  if (actionConflict > 0.5) {
    // Strong conflict: opposing action urgencies
    return {
      signalA: a.id,
      signalB: b.id,
      interaction: 'conflicting',
      impactModifier: -0.1, // reduce combined impact
    };
  }

  return {
    signalA: a.id,
    signalB: b.id,
    interaction: 'independent',
    impactModifier: 0,
  };
}

/**
 * Measure how conflicting two recommended actions are (0-1).
 */
function detectActionConflict(
  actionA: string,
  actionB: string,
): number {
  const urgencyMap: Record<string, number> = {
    intervene: 4,
    escalate: 3,
    prepare: 2,
    monitor: 1,
  };

  const urgencyA = urgencyMap[actionA] ?? 1;
  const urgencyB = urgencyMap[actionB] ?? 1;

  // Score conflict based on urgency gap
  return Math.abs(urgencyA - urgencyB) / 3;
}

// ── Cascading Effect Detection ──────────────────────────────────────────────

/**
 * Detect cascading effects: when a high-urgency signal in one area
 * should amplify priority in a related area.
 *
 * Example: sector divergence + precedent spike → escalate priority
 */
function detectCascadingEffects(priorities: ExecutivePriority[]): number {
  let cascadeBoost = 0;

  // Pattern: high-urgency bargaining pressure + sector shift → cascade
  const hasBargaining = priorities.some((p) =>
    p.sourceTypes.includes('bargaining_pressure_signal'));
  const hasShift = priorities.some((p) =>
    p.sourceTypes.includes('cross_sector_shift'));
  const hasCluster = priorities.some((p) =>
    p.sourceTypes.includes('cross_affiliate_issue_cluster'));

  if (hasBargaining && hasShift) cascadeBoost += 0.1;
  if (hasBargaining && hasCluster) cascadeBoost += 0.08;
  if (hasShift && hasCluster) cascadeBoost += 0.05;

  return Math.min(0.2, cascadeBoost);
}

// ── Low Confidence + High Severity Check ────────────────────────────────────

/**
 * Detect the "low confidence + high severity" anti-pattern.
 * When severity is high but confidence is low, reduce escalation confidence.
 */
function computeConfidenceSeverityPenalty(priorities: ExecutivePriority[]): number {
  let penalty = 0;

  for (const p of priorities) {
    const isHighSeverity = p.watchLevel === 'critical' || p.watchLevel === 'high';
    const isLowConfidence = p.confidence < 0.4;

    if (isHighSeverity && isLowConfidence) {
      penalty += 0.08;
    }
  }

  return Math.min(0.15, penalty);
}

// ── Main Engine ─────────────────────────────────────────────────────────────

/**
 * Analyze multiple signals in combination.
 *
 * Evaluates all signal pairs for interactions, detects cascading effects,
 * and produces a combined impact score with adjustment factor.
 */
export function analyzeMultipleSignals(
  priorities: ExecutivePriority[],
): MultiSignalAnalysis {
  if (priorities.length === 0) {
    return {
      combinedImpactScore: 0,
      interactionType: 'independent',
      adjustmentFactor: 0,
      signalPairs: [],
      summary: 'No signals to analyze.',
    };
  }

  if (priorities.length === 1) {
    return {
      combinedImpactScore: priorities[0]!.priorityScore,
      interactionType: 'independent',
      adjustmentFactor: 0,
      signalPairs: [],
      summary: `Single signal "${priorities[0]!.title}" — no multi-signal interactions.`,
    };
  }

  // Analyze all pairs
  const pairs: SignalPairResult[] = [];
  for (let i = 0; i < priorities.length; i++) {
    for (let j = i + 1; j < priorities.length; j++) {
      pairs.push(analyzeSignalPair(priorities[i]!, priorities[j]!));
    }
  }

  // Aggregate interactions
  const reinforcingCount = pairs.filter((p) => p.interaction === 'reinforcing').length;
  const conflictingCount = pairs.filter((p) => p.interaction === 'conflicting').length;

  // Determine dominant interaction type
  let dominantInteraction: SignalInteractionType;
  if (reinforcingCount > conflictingCount) {
    dominantInteraction = 'reinforcing';
  } else if (conflictingCount > reinforcingCount) {
    dominantInteraction = 'conflicting';
  } else {
    dominantInteraction = 'independent';
  }

  // Compute adjustment factor from all pair modifiers + cascading + penalty
  const pairAdjustment = pairs.reduce((sum, p) => sum + p.impactModifier, 0) / Math.max(1, pairs.length);
  const cascadeBoost = detectCascadingEffects(priorities);
  const severityPenalty = computeConfidenceSeverityPenalty(priorities);

  const adjustmentFactor = Math.max(-0.3, Math.min(0.3,
    pairAdjustment + cascadeBoost - severityPenalty));

  // Combined impact: weighted average of all priority scores + adjustment
  const baseImpact = priorities.reduce((sum, p) => sum + p.priorityScore, 0) / priorities.length;
  const combinedImpactScore = Math.max(0, Math.min(1, baseImpact + adjustmentFactor));

  // Build summary
  const summaryParts: string[] = [];
  if (reinforcingCount > 0) {
    summaryParts.push(`${reinforcingCount} reinforcing pair(s) detected`);
  }
  if (conflictingCount > 0) {
    summaryParts.push(`${conflictingCount} conflicting pair(s) detected`);
  }
  if (cascadeBoost > 0) {
    summaryParts.push('cascading effects amplify priority');
  }
  if (severityPenalty > 0) {
    summaryParts.push('low-confidence/high-severity signals reduce escalation confidence');
  }

  return {
    combinedImpactScore: Math.round(combinedImpactScore * 1000) / 1000,
    interactionType: dominantInteraction,
    adjustmentFactor: Math.round(adjustmentFactor * 1000) / 1000,
    signalPairs: pairs.map((p) => ({
      signalA: p.signalA,
      signalB: p.signalB,
      interaction: p.interaction,
    })),
    summary: summaryParts.length > 0
      ? `Multi-signal analysis: ${summaryParts.join('; ')}.`
      : `${priorities.length} signals evaluated — no significant interactions detected.`,
  };
}
