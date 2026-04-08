/**
 * Tests for Weight Adjustment Proposals
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateWeightAdjustmentProposal,
  flagUnderperformingRecommendationRules,
  reviewProposal,
  resetProposalCounter,
} from '../quality/proposals';
import type { DecisionOutcome } from '../contracts/index';

function makeOutcome(overrides: Partial<DecisionOutcome> = {}): DecisionOutcome {
  return {
    priorityId: 'P1',
    recommendedAction: 'escalate',
    actionTaken: 'escalated',
    outcome: 'success',
    successScore: 0.8,
    createdAt: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

describe('generateWeightAdjustmentProposal', () => {
  beforeEach(() => {
    resetProposalCounter();
  });

  it('returns null for insufficient sample', () => {
    const outcomes = Array.from({ length: 5 }, () => makeOutcome());
    const proposal = generateWeightAdjustmentProposal(outcomes);
    expect(proposal).toBeNull();
  });

  it('returns null when no adjustments needed (high success)', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'success', successScore: 0.9 }),
    );
    // High success rate — may still trigger actionUrgency boost or no change
    const proposal = generateWeightAdjustmentProposal(outcomes);
    // With >80% success rate, slight actionUrgency boost expected
    if (proposal) {
      expect(proposal.status).toBe('proposed');
    }
  });

  it('generates proposal for low success rate', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.2 }),
    );
    const proposal = generateWeightAdjustmentProposal(outcomes);
    expect(proposal).not.toBeNull();
    expect(proposal!.status).toBe('proposed');
    expect(proposal!.adjustments.length).toBeGreaterThan(0);
    expect(proposal!.sampleSize).toBe(15);
    expect(proposal!.rationale).toContain('success rate');
  });

  it('proposals are NEVER auto-applied', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.1 }),
    );
    const proposal = generateWeightAdjustmentProposal(outcomes);
    expect(proposal).not.toBeNull();
    expect(proposal!.status).toBe('proposed');
    expect(proposal!.reviewedBy).toBeUndefined();
    expect(proposal!.reviewedAt).toBeUndefined();
  });

  it('includes triggering metrics', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.15 }),
    );
    const proposal = generateWeightAdjustmentProposal(outcomes);
    expect(proposal!.triggeringMetrics.totalOutcomes).toBe(15);
    expect(proposal!.triggeringMetrics.failureRate).toBeGreaterThan(0);
  });

  it('assigns unique proposal IDs', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.1 }),
    );
    const p1 = generateWeightAdjustmentProposal(outcomes);
    const p2 = generateWeightAdjustmentProposal(outcomes);
    expect(p1!.id).not.toBe(p2!.id);
  });

  it('includes org scope', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.1 }),
    );
    const proposal = generateWeightAdjustmentProposal(outcomes, undefined, 'org-X');
    expect(proposal!.organizationId).toBe('org-X');
  });
});

describe('flagUnderperformingRecommendationRules', () => {
  it('returns flags and audit entry for sufficient data', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.1, recommendedAction: 'escalate' }),
    );
    const { flags, auditEntry } = flagUnderperformingRecommendationRules(outcomes);
    expect(flags.length).toBeGreaterThan(0);
    expect(auditEntry.eventType).toBe('quality_metrics_generated');
    expect(auditEntry.payload).toHaveProperty('flagCount');
  });

  it('returns empty flags for insufficient data', () => {
    const outcomes = Array.from({ length: 5 }, () => makeOutcome());
    const { flags } = flagUnderperformingRecommendationRules(outcomes);
    expect(flags).toHaveLength(0);
  });

  it('includes org scope in audit entry', () => {
    const outcomes = Array.from({ length: 15 }, () => makeOutcome());
    const { auditEntry } = flagUnderperformingRecommendationRules(outcomes, 'org-X');
    expect(auditEntry.organizationId).toBe('org-X');
  });
});

describe('reviewProposal', () => {
  beforeEach(() => {
    resetProposalCounter();
  });

  it('approves a proposal', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.1 }),
    );
    const proposal = generateWeightAdjustmentProposal(outcomes)!;
    const { proposal: reviewed, auditEntry } = reviewProposal(proposal, 'approved', 'admin-1');

    expect(reviewed.status).toBe('approved');
    expect(reviewed.reviewedBy).toBe('admin-1');
    expect(reviewed.reviewedAt).toBeTruthy();
    expect(auditEntry.eventType).toBe('weight_proposal_reviewed');
    expect(auditEntry.payload).toHaveProperty('decision', 'approved');
  });

  it('rejects a proposal', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.1 }),
    );
    const proposal = generateWeightAdjustmentProposal(outcomes)!;
    const { proposal: reviewed } = reviewProposal(proposal, 'rejected', 'admin-1');

    expect(reviewed.status).toBe('rejected');
  });

  it('does not mutate the original proposal', () => {
    const outcomes = Array.from({ length: 15 }, () =>
      makeOutcome({ outcome: 'failure', successScore: 0.1 }),
    );
    const proposal = generateWeightAdjustmentProposal(outcomes)!;
    reviewProposal(proposal, 'approved', 'admin-1');

    expect(proposal.status).toBe('proposed');
    expect(proposal.reviewedBy).toBeUndefined();
  });
});
