import { describe, expect, it } from 'vitest';
import {
  ReviewTransitionError,
  initialReviewStatus,
  isEligibleForDelivery,
  transitionReview,
} from '../reviewWorkflow';

function seedArtifact() {
  return initialReviewStatus(
    {
      artifactKind: 'ExecutiveSummary',
      promptId: 'EXEC_SUMMARY',
      promptVersion: '1.0.0',
      text: 'draft text',
    },
    () => '2026-01-01T00:00:00.000Z',
  );
}

describe('reviewWorkflow — legal transitions', () => {
  it('draft → reviewed → approved is allowed and eligible for delivery', () => {
    const draft = seedArtifact();
    const reviewed = transitionReview({ artifact: draft, to: 'reviewed', reviewerId: 'u1' });
    const approved = transitionReview({ artifact: reviewed, to: 'approved', reviewerId: 'u1' });
    expect(approved.reviewStatus).toBe('approved');
    expect(isEligibleForDelivery(approved)).toBe(true);
  });

  it('rejected → draft is allowed', () => {
    const draft = seedArtifact();
    const rejected = transitionReview({ artifact: draft, to: 'rejected', reviewerId: 'u1' });
    const redraft = transitionReview({ artifact: rejected, to: 'draft', reviewerId: 'u1' });
    expect(redraft.reviewStatus).toBe('draft');
  });
});

describe('reviewWorkflow — illegal transitions', () => {
  it('draft → approved is rejected', () => {
    const draft = seedArtifact();
    expect(() =>
      transitionReview({ artifact: draft, to: 'approved', reviewerId: 'u1' }),
    ).toThrow(ReviewTransitionError);
  });

  it('approved is terminal', () => {
    const draft = seedArtifact();
    const reviewed = transitionReview({ artifact: draft, to: 'reviewed', reviewerId: 'u1' });
    const approved = transitionReview({ artifact: reviewed, to: 'approved', reviewerId: 'u1' });
    expect(() =>
      transitionReview({ artifact: approved, to: 'draft', reviewerId: 'u1' }),
    ).toThrow(ReviewTransitionError);
    expect(() =>
      transitionReview({ artifact: approved, to: 'rejected', reviewerId: 'u1' }),
    ).toThrow(ReviewTransitionError);
  });

  it('requires a reviewerId', () => {
    const draft = seedArtifact();
    expect(() =>
      transitionReview({ artifact: draft, to: 'reviewed', reviewerId: '' }),
    ).toThrow(/reviewerId/);
  });
});

describe('reviewWorkflow — delivery gating', () => {
  it('only approved artefacts are eligible', () => {
    const draft = seedArtifact();
    expect(isEligibleForDelivery(draft)).toBe(false);
    const reviewed = transitionReview({ artifact: draft, to: 'reviewed', reviewerId: 'u1' });
    expect(isEligibleForDelivery(reviewed)).toBe(false);
  });
});
