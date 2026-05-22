/**
 * reviewStatusContracts
 * ─────────────────────
 * Typed state machine for human review of AI-generated narrative drafts.
 */

import type { NarrativeArtifactKind } from './narrativePromptContracts';

export type ReviewStatus = 'draft' | 'reviewed' | 'approved' | 'rejected';

export const REVIEW_STATUS_TRANSITIONS: Readonly<
  Record<ReviewStatus, ReadonlyArray<ReviewStatus>>
> = Object.freeze({
  draft: ['reviewed', 'rejected'],
  reviewed: ['approved', 'rejected', 'draft'],
  approved: [],
  rejected: ['draft'],
});

export interface ReviewedArtifactSeed {
  readonly artifactKind: NarrativeArtifactKind;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly text: string;
}

export interface ReviewedArtifact extends ReviewedArtifactSeed {
  readonly reviewStatus: ReviewStatus;
  readonly reviewerId?: string;
  readonly reviewerNote?: string;
  readonly transitionedAt: string;
}
