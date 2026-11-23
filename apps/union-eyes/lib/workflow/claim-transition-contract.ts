/** Status values this claim endpoint can actually persist. */
export const CLAIM_TRANSITION_TARGETS = [
  'submitted',
  'under_review',
  'investigation',
  'pending_documentation',
  'resolved',
  'rejected',
  'closed',
] as const
export type ClaimTransitionTarget = (typeof CLAIM_TRANSITION_TARGETS)[number]
