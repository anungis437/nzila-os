/**
 * Zonga — Creator Domain Types
 */

export type PublishingState =
  | 'draft'
  | 'processing'
  | 'ready_for_review'
  | 'published'
  | 'suspended'
  | 'removed'

export interface CreatorProfile {
  id: string
  creatorId: string
  orgId: string
  displayName: string
  slug?: string
  bio?: string
  genre?: string
  subGenres: string[]
  country?: string
  city?: string
  languages: string[]
  websiteUrl?: string
  socialLinks: Record<string, string>
  avatarUrl?: string
  bannerUrl?: string
  isVerified: boolean
  followerCount: number
  trackCount: number
  monthlyListeners: number
  createdAt: Date
  updatedAt: Date
}

export interface CreatorDashboardData {
  profile: CreatorProfile
  tracks: CreatorTrackSummary[]
  releases: CreatorReleaseSummary[]
  earnings: CreatorEarningsSummary
  events: CreatorEventSummary[]
  rightsStatus: RightsStatusSummary
}

export interface CreatorTrackSummary {
  id: string
  title: string
  status: PublishingState
  processingProgress?: number
  totalPlays: number
  revenue: number
  currency: string
  uploadedAt: Date
}

export interface CreatorReleaseSummary {
  id: string
  title: string
  type: 'single' | 'ep' | 'album'
  status: string
  trackCount: number
  totalPlays: number
  releaseDate?: Date
}

export interface CreatorEarningsSummary {
  totalEarned: number
  pendingBalance: number
  availableBalance: number
  paidOut: number
  currency: string
  lastPayoutDate?: Date
  earningsBySource: Record<string, number>
}

export interface CreatorEventSummary {
  eventId: string
  eventTitle: string
  role: string
  date: Date
  ticketsSold: number
}

export interface RightsStatusSummary {
  totalClaims: number
  activeClaims: number
  resolvedClaims: number
  pendingDisputes: number
}

// ── Publishing Validation ───────────────────────────────────────────────────

export interface PublishValidation {
  canPublish: boolean
  errors: PublishError[]
  warnings: PublishWarning[]
}

export interface PublishError {
  code: string
  field: string
  message: string
}

export interface PublishWarning {
  code: string
  message: string
}

/** Valid state transitions for the publishing workflow */
export const PUBLISHING_TRANSITIONS: Record<PublishingState, PublishingState[]> = {
  draft: ['processing'],
  processing: ['ready_for_review', 'draft'],       // processing can fail → back to draft
  ready_for_review: ['published', 'draft'],         // review can reject → back to draft
  published: ['suspended', 'removed'],
  suspended: ['published', 'removed'],              // can be reinstated or removed
  removed: [],                                      // terminal state
}
