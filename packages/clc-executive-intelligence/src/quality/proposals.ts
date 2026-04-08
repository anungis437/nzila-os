/**
 * CLC Executive Intelligence — Weight Adjustment Proposals
 *
 * Governed proposal generation for scoring weight adjustments.
 * Proposals are NEVER auto-applied — they require human review.
 *
 * Design:
 * - Minimum sample threshold enforced
 * - Proposals include full rationale and triggering metrics
 * - Status lifecycle: proposed → approved | rejected
 * - Audit trail for every proposal
 *
 * @module quality/proposals
 */

import type {
  DecisionOutcome,
  RecommendationAccuracy,
  WeightAdjustmentProposal,
  LowPerformanceFlag,
  FeedbackAuditEntry,
} from '../contracts/index';
import {
  updateModelWeights,
  getDefaultWeights,
  getMinSampleSize,
  computeRecommendationAccuracy,
  flagLowPerformancePatterns,
} from '../learning/feedback-engine';
import type { ScoringWeights } from '../learning/feedback-engine';

// ── Proposal Generation ─────────────────────────────────────────────────────

let proposalIdCounter = 0;

/**
 * Reset the proposal ID counter (for testing).
 */
export function resetProposalCounter(): void {
  proposalIdCounter = 0;
}

/**
 * Generate a weight adjustment proposal from historical outcomes.
 *
 * Returns null if insufficient data or no adjustments warranted.
 * Proposals are ALWAYS in 'proposed' status — never auto-applied.
 */
export function generateWeightAdjustmentProposal(
  outcomes: DecisionOutcome[],
  currentWeights?: ScoringWeights,
  organizationId?: string,
): WeightAdjustmentProposal | null {
  const minSample = getMinSampleSize();
  if (outcomes.length < minSample) return null;

  const weights = currentWeights ?? getDefaultWeights();
  const { adjustments } = updateModelWeights(weights, outcomes);

  // No adjustments needed — model is performing well
  if (adjustments.length === 0) return null;

  const accuracy = computeRecommendationAccuracy(outcomes);
  const now = new Date().toISOString();

  return {
    id: `proposal-${++proposalIdCounter}`,
    generatedAt: now,
    organizationId,
    adjustments,
    triggeringMetrics: accuracy,
    sampleSize: outcomes.length,
    rationale: buildProposalRationale(accuracy, adjustments),
    status: 'proposed',
  };
}

/**
 * Build a human-readable rationale for the proposal.
 */
function buildProposalRationale(
  accuracy: RecommendationAccuracy,
  adjustments: import('../contracts/index').WeightAdjustment[],
): string {
  const parts: string[] = [];

  parts.push(
    `Based on ${accuracy.totalOutcomes} evaluated outcomes with ` +
    `${(accuracy.successRate * 100).toFixed(0)}% success rate.`,
  );

  for (const adj of adjustments) {
    const direction = adj.newWeight > adj.previousWeight ? 'increase' : 'decrease';
    const delta = Math.abs(adj.newWeight - adj.previousWeight);
    parts.push(
      `${adj.factor}: ${direction} by ${(delta * 100).toFixed(1)}% ` +
      `(${(adj.previousWeight * 100).toFixed(0)}% → ${(adj.newWeight * 100).toFixed(0)}%).`,
    );
  }

  return parts.join(' ');
}

// ── Underperforming Rule Detection ──────────────────────────────────────────

/**
 * Flag recommendation rules (action types) that are consistently underperforming.
 * Returns low-performance flags plus audit entries.
 */
export function flagUnderperformingRecommendationRules(
  outcomes: DecisionOutcome[],
  organizationId?: string,
): {
  flags: LowPerformanceFlag[];
  auditEntry: FeedbackAuditEntry;
} {
  const now = new Date().toISOString();

  const flags = outcomes.length >= getMinSampleSize()
    ? flagLowPerformancePatterns(outcomes)
    : [];

  return {
    flags,
    auditEntry: {
      id: `audit-perf-${Date.now()}`,
      timestamp: now,
      eventType: 'quality_metrics_generated',
      organizationId,
      payload: {
        totalOutcomes: outcomes.length,
        flagCount: flags.length,
        flags: flags.map((f) => ({ category: f.category, successRate: f.successRate })),
      },
    },
  };
}

// ── Proposal Review ─────────────────────────────────────────────────────────

/**
 * Review a weight adjustment proposal (approve or reject).
 * Returns a new proposal object with updated status — does NOT mutate.
 */
export function reviewProposal(
  proposal: WeightAdjustmentProposal,
  decision: 'approved' | 'rejected',
  reviewedBy: string,
): {
  proposal: WeightAdjustmentProposal;
  auditEntry: FeedbackAuditEntry;
} {
  const now = new Date().toISOString();

  const reviewed: WeightAdjustmentProposal = {
    ...proposal,
    status: decision,
    reviewedBy,
    reviewedAt: now,
  };

  return {
    proposal: reviewed,
    auditEntry: {
      id: `audit-review-${Date.now()}`,
      timestamp: now,
      eventType: 'weight_proposal_reviewed',
      organizationId: proposal.organizationId,
      userId: reviewedBy,
      payload: {
        proposalId: proposal.id,
        decision,
        adjustmentCount: proposal.adjustments.length,
      },
    },
  };
}
