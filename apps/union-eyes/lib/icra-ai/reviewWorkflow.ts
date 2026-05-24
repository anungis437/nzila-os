/**
 * reviewWorkflow
 * ──────────────
 * Pure state-machine helpers enforcing the human-review boundary for
 * AI-generated narrative drafts. No artefact reaches delivery without an
 * `approved` transition recorded.
 */

import {
  REVIEW_STATUS_TRANSITIONS,
  type ReviewStatus,
  type ReviewedArtifact,
  type ReviewedArtifactSeed,
} from './reviewStatusContracts';

export {
  REVIEW_STATUS_TRANSITIONS,
  type ReviewStatus,
  type ReviewedArtifact,
  type ReviewedArtifactSeed,
};

export function initialReviewStatus(
  seed: ReviewedArtifactSeed,
  now: () => string = () => new Date().toISOString(),
): ReviewedArtifact {
  return Object.freeze({
    ...seed,
    reviewStatus: 'draft' as ReviewStatus,
    transitionedAt: now(),
  });
}

export class ReviewTransitionError extends Error {
  constructor(
    public readonly from: ReviewStatus,
    public readonly to: ReviewStatus,
  ) {
    super(`Illegal review transition: ${from} → ${to}`);
    this.name = 'ReviewTransitionError';
  }
}

export interface TransitionInput {
  readonly artifact: ReviewedArtifact;
  readonly to: ReviewStatus;
  readonly reviewerId: string;
  readonly reviewerNote?: string;
}

export function transitionReview(
  input: TransitionInput,
  now: () => string = () => new Date().toISOString(),
): ReviewedArtifact {
  const allowed = REVIEW_STATUS_TRANSITIONS[input.artifact.reviewStatus];
  if (!allowed.includes(input.to)) {
    throw new ReviewTransitionError(input.artifact.reviewStatus, input.to);
  }
  if (!input.reviewerId || input.reviewerId.trim().length === 0) {
    throw new Error('reviewerId is required for any review transition');
  }
  return Object.freeze({
    ...input.artifact,
    reviewStatus: input.to,
    reviewerId: input.reviewerId,
    reviewerNote: input.reviewerNote,
    transitionedAt: now(),
  });
}

/**
 * Gating helper: returns true only when the artefact has been approved and
 * is therefore eligible to enter the organizational delivery layer.
 */
export function isEligibleForDelivery(artifact: ReviewedArtifact): boolean {
  return artifact.reviewStatus === 'approved';
}
