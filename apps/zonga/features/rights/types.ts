/**
 * Zonga — Rights & Governance Domain Types
 */

// ── Ownership ───────────────────────────────────────────────────────────────

export interface OwnershipSplit {
  id: string
  contentId: string
  contentType: 'track' | 'release'
  ownerId: string
  ownerName: string
  ownershipPercentage: number
  role: 'composer' | 'lyricist' | 'performer' | 'producer' | 'publisher'
  verifiedAt?: Date
  orgId: string
  createdAt: Date
}

// ── Rights Claims ───────────────────────────────────────────────────────────

export type RightsClaimStatus = 'pending' | 'approved' | 'disputed' | 'rejected' | 'withdrawn'

export interface RightsClaim {
  id: string
  contentId: string
  claimantId: string
  claimType: 'publishing' | 'master' | 'performance' | 'sync'
  territory: string          // ISO 3166-1 alpha-2 or 'WORLDWIDE'
  evidenceUrl?: string
  status: RightsClaimStatus
  reviewedBy?: string
  reviewNote?: string
  orgId: string
  createdAt: Date
  resolvedAt?: Date
}

// ── Moderation ──────────────────────────────────────────────────────────────

export type ModerationVerdict = 'approved' | 'rejected' | 'needs_revision' | 'escalated'

export interface ModerationDecision {
  id: string
  contentId: string
  contentType: 'track' | 'release' | 'event' | 'artist_profile'
  reviewerId: string
  verdict: ModerationVerdict
  reason?: string
  policyViolation?: string
  orgId: string
  createdAt: Date
}

// ── Takedowns ───────────────────────────────────────────────────────────────

export type TakedownStatus = 'requested' | 'under_review' | 'enforced' | 'counter_filed' | 'resolved' | 'rejected'

export interface TakedownRequest {
  id: string
  contentId: string
  contentType: 'track' | 'release'
  requesterId: string
  requesterType: 'rights_holder' | 'legal' | 'platform'
  reason: 'copyright_infringement' | 'trademark' | 'defamation' | 'hate_speech' | 'other'
  description: string
  evidenceUrl?: string
  status: TakedownStatus
  enforcedAt?: Date
  orgId: string
  createdAt: Date
}

export const TAKEDOWN_TRANSITIONS: Record<TakedownStatus, TakedownStatus[]> = {
  requested: ['under_review', 'rejected'],
  under_review: ['enforced', 'rejected'],
  enforced: ['counter_filed', 'resolved'],
  counter_filed: ['under_review', 'resolved'],
  resolved: [],
  rejected: [],
}

export const CLAIM_TRANSITIONS: Record<RightsClaimStatus, RightsClaimStatus[]> = {
  pending: ['approved', 'rejected', 'disputed'],
  approved: ['disputed'],
  disputed: ['approved', 'rejected', 'withdrawn'],
  rejected: ['pending'],  // re-submit
  withdrawn: [],
}
