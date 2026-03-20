/**
 * @nzila/zonga-rights — Types & Schemas
 *
 * Rights ownership, split agreements, contributor roles,
 * royalty rules, versioning, and dispute management.
 */
import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────

export const RightsType = {
  MASTER: 'master',
  PUBLISHING: 'publishing',
  PERFORMANCE: 'performance',
  MECHANICAL: 'mechanical',
  SYNC: 'sync',
  NEIGHBORING: 'neighboring',
  DIGITAL: 'digital',
} as const
export type RightsType = (typeof RightsType)[keyof typeof RightsType]

export const ContributorRole = {
  PRIMARY_ARTIST: 'primary_artist',
  FEATURED_ARTIST: 'featured_artist',
  PRODUCER: 'producer',
  SONGWRITER: 'songwriter',
  COMPOSER: 'composer',
  LYRICIST: 'lyricist',
  ARRANGER: 'arranger',
  MIXER: 'mixer',
  ENGINEER: 'engineer',
  PERFORMER: 'performer',
  LABEL: 'label',
  PUBLISHER: 'publisher',
  DISTRIBUTOR: 'distributor',
} as const
export type ContributorRole = (typeof ContributorRole)[keyof typeof ContributorRole]

export const AgreementStatus = {
  DRAFT: 'draft',
  PENDING_SIGNATURES: 'pending_signatures',
  ACTIVE: 'active',
  AMENDED: 'amended',
  EXPIRED: 'expired',
  TERMINATED: 'terminated',
  DISPUTED: 'disputed',
} as const
export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus]

export const DisputeStatus = {
  FILED: 'filed',
  UNDER_REVIEW: 'under_review',
  EVIDENCE_REQUESTED: 'evidence_requested',
  MEDIATION: 'mediation',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated',
  DISMISSED: 'dismissed',
} as const
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus]

export const DisputeType = {
  OWNERSHIP: 'ownership',
  SPLIT_PERCENTAGE: 'split_percentage',
  UNAUTHORIZED_USE: 'unauthorized_use',
  CREDIT_OMISSION: 'credit_omission',
  ROYALTY_UNDERPAYMENT: 'royalty_underpayment',
} as const
export type DisputeType = (typeof DisputeType)[keyof typeof DisputeType]

export const RoyaltyTrigger = {
  STREAM: 'stream',
  DOWNLOAD: 'download',
  SYNC_LICENSE: 'sync_license',
  PERFORMANCE: 'performance',
  MECHANICAL: 'mechanical',
  TICKET_SALE: 'ticket_sale',
  MERCHANDISE: 'merchandise',
} as const
export type RoyaltyTrigger = (typeof RoyaltyTrigger)[keyof typeof RoyaltyTrigger]

// ── Interfaces ────────────────────────────────────────────────────────────

export interface RightsHolder {
  readonly id: string
  readonly userId: string
  readonly displayName: string
  readonly role: ContributorRole
  readonly ipi?: string // International Party Information number
  readonly isni?: string // International Standard Name Identifier
  readonly pro?: string // Performance Rights Organization
}

export interface RightsOwnership {
  readonly id: string
  readonly assetId: string // track, album, composition ID
  readonly assetType: 'track' | 'album' | 'composition' | 'video'
  readonly rightsType: RightsType
  readonly holderId: string
  readonly percentage: number // 0-100
  readonly territory: string[] // ISO 3166-1 alpha-2 codes, empty = worldwide
  readonly startDate: Date
  readonly endDate: Date | null
  readonly version: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface SplitAgreement {
  readonly id: string
  readonly assetId: string
  readonly assetType: 'track' | 'album' | 'composition' | 'video'
  readonly title: string
  readonly status: AgreementStatus
  readonly splits: readonly SplitEntry[]
  readonly signatories: readonly Signatory[]
  readonly effectiveFrom: Date
  readonly effectiveUntil: Date | null
  readonly version: number
  readonly previousVersionId: string | null
  readonly notes: string
  readonly createdBy: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface SplitEntry {
  readonly holderId: string
  readonly holderName: string
  readonly role: ContributorRole
  readonly percentage: number
  readonly rightsType: RightsType
}

export interface Signatory {
  readonly holderId: string
  readonly signedAt: Date | null
  readonly status: 'pending' | 'signed' | 'rejected'
  readonly rejectionReason?: string
}

export interface RoyaltyRule {
  readonly id: string
  readonly assetId: string
  readonly trigger: RoyaltyTrigger
  readonly ratePerUnit: number // e.g., $0.003 per stream
  readonly currency: string
  readonly minimumPayout: number // minimum accumulation before payout
  readonly isActive: boolean
}

export interface RoyaltyAccrual {
  readonly id: string
  readonly assetId: string
  readonly holderId: string
  readonly trigger: RoyaltyTrigger
  readonly units: number
  readonly ratePerUnit: number
  readonly grossAmount: number
  readonly netAmount: number
  readonly periodStart: Date
  readonly periodEnd: Date
  readonly status: 'pending' | 'approved' | 'paid' | 'disputed'
}

export interface RightsDispute {
  readonly id: string
  readonly assetId: string
  readonly type: DisputeType
  readonly status: DisputeStatus
  readonly complainantId: string
  readonly respondentId: string
  readonly description: string
  readonly evidenceIds: readonly string[]
  readonly resolution: string | null
  readonly payoutsFrozen: boolean
  readonly filedAt: Date
  readonly resolvedAt: Date | null
}

export interface RightsVersionHistory {
  readonly id: string
  readonly assetId: string
  readonly agreementId: string
  readonly version: number
  readonly changedBy: string
  readonly changeType: 'created' | 'amended' | 'terminated' | 'dispute_freeze' | 'dispute_resolved'
  readonly previousSplits: readonly SplitEntry[]
  readonly newSplits: readonly SplitEntry[]
  readonly reason: string
  readonly createdAt: Date
}

// ── Zod Schemas ───────────────────────────────────────────────────────────

export const CreateSplitAgreementSchema = z.object({
  assetId: z.string().min(1),
  assetType: z.enum(['track', 'album', 'composition', 'video']),
  title: z.string().min(1),
  splits: z.array(
    z.object({
      holderId: z.string().min(1),
      holderName: z.string().min(1),
      role: z.string().min(1),
      percentage: z.number().min(0).max(100),
      rightsType: z.string().min(1),
    }),
  ),
  effectiveFrom: z.coerce.date(),
  effectiveUntil: z.coerce.date().nullable().optional(),
  notes: z.string().default(''),
})

export const AmendSplitAgreementSchema = z.object({
  agreementId: z.string().min(1),
  newSplits: z.array(
    z.object({
      holderId: z.string().min(1),
      holderName: z.string().min(1),
      role: z.string().min(1),
      percentage: z.number().min(0).max(100),
      rightsType: z.string().min(1),
    }),
  ),
  reason: z.string().min(1),
})

export const FileDisputeSchema = z.object({
  assetId: z.string().min(1),
  type: z.enum(['ownership', 'split_percentage', 'unauthorized_use', 'credit_omission', 'royalty_underpayment']),
  respondentId: z.string().min(1),
  description: z.string().min(10),
  evidenceIds: z.array(z.string()).default([]),
})

export const ResolveDisputeSchema = z.object({
  disputeId: z.string().min(1),
  resolution: z.string().min(1),
  newSplits: z
    .array(
      z.object({
        holderId: z.string().min(1),
        holderName: z.string().min(1),
        role: z.string().min(1),
        percentage: z.number().min(0).max(100),
        rightsType: z.string().min(1),
      }),
    )
    .optional(),
  unfreezePayout: z.boolean().default(true),
})

export const RegisterRoyaltyRuleSchema = z.object({
  assetId: z.string().min(1),
  trigger: z.enum(['stream', 'download', 'sync_license', 'performance', 'mechanical', 'ticket_sale', 'merchandise']),
  ratePerUnit: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  minimumPayout: z.number().nonnegative().default(10),
})
