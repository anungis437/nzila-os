/**
 * CLC Executive Intelligence — Decision Sequencing Engine
 *
 * Orders executive actions into a logical sequence considering:
 * - Urgency + confidence → first
 * - Prerequisite actions before escalation
 * - Avoid conflicting actions in the same step
 *
 * @module recommendations/sequence-engine
 */

import type {
  ExecutivePriority,
  ActionSequence,
  SequencedAction,
  TopOnePriority,
} from '../contracts/index';
import type { RecommendedAction, ActionTimeframe } from '@nzila/clc-decision-intelligence';

// ── Action Urgency → Numeric Mapping ────────────────────────────────────────

const URGENCY_ORDER: Record<RecommendedAction, number> = {
  intervene: 4,
  escalate: 3,
  prepare: 2,
  monitor: 1,
};

const TIMEFRAME_ORDER: Record<ActionTimeframe, number> = {
  now: 5,
  '7_days': 4,
  '30_days': 3,
  pre_bargaining: 2,
  this_quarter: 1,
};

// ── Prerequisite Detection ──────────────────────────────────────────────────

/**
 * Determine if priority A is a prerequisite for priority B.
 *
 * Heuristic: "prepare" actions are prerequisites for "escalate"/"intervene"
 * in the same source type or overlapping evidence.
 */
function isPrerequisite(a: ExecutivePriority, b: ExecutivePriority): boolean {
  // Prepare must come before escalate/intervene in same source type
  if (a.recommendedAction === 'prepare' &&
      (b.recommendedAction === 'escalate' || b.recommendedAction === 'intervene')) {
    const sharedSources = a.sourceTypes.some((s) => b.sourceTypes.includes(s));
    if (sharedSources) return true;
  }

  // Monitor is prerequisite for prepare in overlapping evidence
  if (a.recommendedAction === 'monitor' && b.recommendedAction === 'prepare') {
    const sharedRefs = a.evidenceRefs.some((r) => b.evidenceRefs.includes(r));
    if (sharedRefs) return true;
  }

  return false;
}

/**
 * Detect if two actions would conflict if executed simultaneously.
 */
function wouldConflict(a: ExecutivePriority, b: ExecutivePriority): boolean {
  // Escalate + de-escalate in same area = conflict
  if (a.recommendedAction === 'escalate' && b.recommendedAction === 'monitor') {
    const sharedSources = a.sourceTypes.some((s) => b.sourceTypes.includes(s));
    return sharedSources;
  }
  if (b.recommendedAction === 'escalate' && a.recommendedAction === 'monitor') {
    const sharedSources = a.sourceTypes.some((s) => b.sourceTypes.includes(s));
    return sharedSources;
  }

  return false;
}

// ── Sequencing Engine ───────────────────────────────────────────────────────

/**
 * Compute a sequencing score for ordering.
 * Higher = should come first in the sequence.
 */
function computeSequenceScore(priority: ExecutivePriority): number {
  const urgencyScore = URGENCY_ORDER[priority.recommendedAction] ?? 1;
  const timeframeScore = TIMEFRAME_ORDER[priority.timeframe] ?? 1;
  const confidenceWeight = priority.confidence;

  // Weighted combination: urgency (40%) + timeframe (30%) + confidence (30%)
  return (urgencyScore / 4) * 0.4 +
         (timeframeScore / 5) * 0.3 +
         confidenceWeight * 0.3;
}

/**
 * Build an ordered action sequence from ranked priorities.
 *
 * Rules:
 * - High urgency + high confidence → first
 * - Prerequisite actions before escalation
 * - Avoid conflicting actions at the same step
 */
export function buildActionSequence(priorities: ExecutivePriority[]): ActionSequence {
  if (priorities.length === 0) {
    return { orderedActions: [], primaryAction: null, secondaryActions: [] };
  }

  // Score and sort candidates
  const candidates = priorities.map((p) => ({
    priority: p,
    sequenceScore: computeSequenceScore(p),
  })).sort((a, b) => b.sequenceScore - a.sequenceScore);

  // Build sequence respecting prerequisites and conflicts
  const sequenced: SequencedAction[] = [];
  const placed = new Set<string>();

  // First pass: place prerequisites before their dependents
  for (const candidate of candidates) {
    if (placed.has(candidate.priority.id)) continue;

    // Check if any unplaced item is a prerequisite for this one
    const prereqs = candidates.filter(
      (c) => !placed.has(c.priority.id) &&
        c.priority.id !== candidate.priority.id &&
        isPrerequisite(c.priority, candidate.priority),
    );

    // Place prerequisites first
    for (const prereq of prereqs) {
      if (!placed.has(prereq.priority.id)) {
        sequenced.push(buildSequencedAction(prereq.priority, sequenced.length + 1));
        placed.add(prereq.priority.id);
      }
    }

    // Place current
    if (!placed.has(candidate.priority.id)) {
      sequenced.push(buildSequencedAction(candidate.priority, sequenced.length + 1));
      placed.add(candidate.priority.id);
    }
  }

  // Second pass: detect and note conflicts
  for (let i = 0; i < sequenced.length; i++) {
    for (let j = i + 1; j < sequenced.length; j++) {
      const a = priorities.find((p) => p.id === sequenced[i]!.priorityId);
      const b = priorities.find((p) => p.id === sequenced[j]!.priorityId);
      if (a && b && wouldConflict(a, b)) {
        sequenced[j] = {
          ...sequenced[j]!,
          rationale: `${sequenced[j]!.rationale} [Note: may conflict with step ${i + 1}]`,
        };
      }
    }
  }

  return {
    orderedActions: sequenced,
    primaryAction: sequenced[0] ?? null,
    secondaryActions: sequenced.slice(1),
  };
}

/**
 * Build a single sequenced action from a priority.
 */
function buildSequencedAction(priority: ExecutivePriority, step: number): SequencedAction {
  return {
    step,
    action: `${capitalize(priority.recommendedAction)}: ${priority.title}`,
    rationale: buildRationale(priority, step),
    priorityId: priority.id,
    urgency: priority.recommendedAction,
    confidence: priority.confidence,
  };
}

function buildRationale(priority: ExecutivePriority, step: number): string {
  if (step === 1) {
    return `Highest urgency (${priority.recommendedAction}) with ${(priority.confidence * 100).toFixed(0)}% confidence. ` +
      `${priority.watchLevel} watch level requires immediate attention.`;
  }
  return `${capitalize(priority.recommendedAction)} action at ${priority.watchLevel} watch level. ` +
    `Timeframe: ${priority.timeframe.replace(/_/g, ' ')}.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Top One Priority (Section 5) ────────────────────────────────────────────

/**
 * Derive the single most important priority — the ONE thing that matters.
 *
 * Must be derived from the prioritization engine.
 * Cuts through list noise to give leadership a single clear focus.
 */
export function deriveTopOnePriority(
  priorities: ExecutivePriority[],
): TopOnePriority | null {
  if (priorities.length === 0) return null;

  const top = priorities[0]!;

  // Build "why this is the one" explanation
  const whyParts: string[] = [];

  if (top.watchLevel === 'critical') {
    whyParts.push('Critical watch level demands immediate leadership focus');
  } else if (top.watchLevel === 'high') {
    whyParts.push('High watch level requires elevated attention');
  }

  if (top.recommendedAction === 'intervene') {
    whyParts.push('intervention is required to prevent escalation');
  } else if (top.recommendedAction === 'escalate') {
    whyParts.push('escalation is needed for leadership decision');
  }

  if (top.confidence >= 0.8) {
    whyParts.push(`high confidence (${(top.confidence * 100).toFixed(0)}%) in this signal`);
  }

  if (priorities.length > 1) {
    const scoreDelta = top.priorityScore - priorities[1]!.priorityScore;
    if (scoreDelta > 0.1) {
      whyParts.push(`significantly outscores next priority by ${(scoreDelta * 100).toFixed(0)} points`);
    }
  }

  const whyThisIsTheOne = whyParts.length > 0
    ? whyParts.join('; ') + '.'
    : `Highest priority score (${top.priorityScore.toFixed(2)}) among ${priorities.length} competing signals.`;

  // Derive immediate action
  const immediateAction = deriveImmediateAction(top);

  return {
    id: top.id,
    title: top.title,
    whyThisIsTheOne,
    immediateAction,
    timeframe: top.timeframe,
    confidence: top.confidence,
  };
}

function deriveImmediateAction(priority: ExecutivePriority): string {
  switch (priority.recommendedAction) {
    case 'intervene':
      return `Convene leadership to address "${priority.title}" — direct intervention required within ${priority.timeframe.replace(/_/g, ' ')}.`;
    case 'escalate':
      return `Escalate "${priority.title}" to senior leadership for immediate review and decision.`;
    case 'prepare':
      return `Begin preparation for "${priority.title}" — build readiness for potential action.`;
    default:
      return `Monitor "${priority.title}" closely and prepare briefing for next review cycle.`;
  }
}
