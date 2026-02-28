/**
 * @nzila/zonga-core — Domain Types
 *
 * All Zonga content platform domain types. No DB, no framework — pure TypeScript.
 * Nzila convention: org scoping uses "orgId" (the Nzila org_id column).
 *
 * @module @nzila/zonga-core/types
 */
import type {
  CreatorStatus,
  AssetType,
  AssetStatus,
  ReleaseStatus,
  RevenueType,
  PayoutStatus,
  PayoutRail,
  LedgerEntryType,
  ZongaRole,
  ZongaCurrency,
  ZongaLanguage,
  AfricanGenre,
  AudioQuality,
} from '../enums'

// ── Branded Types ───────────────────────────────────────────────────────────

/** Unique creator reference. */
export type CreatorRef = string & { readonly __brand: 'CreatorRef' }

/** Unique content asset reference. */
export type AssetRef = string & { readonly __brand: 'AssetRef' }

// ── Context ─────────────────────────────────────────────────────────────────

/**
 * Zonga org context carried through every request.
 *
 * `orgId` is the canonical field (aligns with @nzila/org).
 *
 * @see {@link @nzila/org OrgContext} for the canonical base type.
 */
export interface ZongaOrgContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  /** Authenticated user performing the action. */
  readonly actorId: string
  /** User's role within this org. */
  readonly role: ZongaRole
  /** Granular permission keys. */
  readonly permissions: readonly string[]
  /** Request-level correlation ID for tracing. */
  readonly requestId: string
}

// ── Creator ─────────────────────────────────────────────────────────────────


export interface Creator {
  readonly id: string
  /** @deprecated Use ZongaOrgContext.orgId — entity-level orgId will be removed. */
  readonly orgId: string
  readonly userId: string
  readonly displayName: string
  readonly bio: string | null
  readonly avatarUrl: string | null
  readonly status: CreatorStatus
  readonly genre: string | null
  readonly country: string | null
  readonly verified: boolean
  /** Preferred UI / metadata language. */
  readonly language: ZongaLanguage | null
  /** African region code (e.g. 'west', 'east', 'southern'). */
  readonly region: CreatorRegion | null
  /** How the creator receives payouts. */
  readonly payoutRail: PayoutRail | null
  /** Mobile money phone number or payout account ref. */
  readonly payoutAccountRef: string | null
  /** Preferred payout currency. */
  readonly payoutCurrency: ZongaCurrency | null
  readonly createdAt: string
  readonly updatedAt: string
}

/** Broad geographic region within Africa for filtering and analytics. */
export type CreatorRegion = 'west' | 'east' | 'central' | 'southern' | 'north' | 'diaspora'

// ── Content Asset ───────────────────────────────────────────────────────────

export interface ContentAsset {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly title: string
  readonly type: AssetType
  readonly status: AssetStatus
  readonly description: string | null
  readonly storageUrl: string | null
  readonly coverArtUrl: string | null
  readonly durationSeconds: number | null
  readonly genre: string | null
  /** Content / lyrics language. */
  readonly language: ZongaLanguage | null
  /** Featured / collaborating artists. */
  readonly collaborators: readonly string[]
  /** ISRC code for distribution tracking. */
  readonly isrc: string | null
  /** SHA-256 fingerprint of the original uploaded file. */
  readonly audioFingerprint: string | null
  /** Available quality tiers for the encoded file. */
  readonly qualityTiers: readonly AudioQuality[]
  readonly metadata: Readonly<Record<string, unknown>>
  readonly publishedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Release ─────────────────────────────────────────────────────────────────

export interface Release {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly title: string
  readonly status: ReleaseStatus
  readonly releaseDate: string | null
  readonly metadata: Readonly<Record<string, unknown>>
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Revenue Event (append-only ledger entry) ────────────────────────────────

export interface RevenueEvent {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly assetId: string | null
  readonly type: RevenueType
  readonly amount: number
  readonly currency: string
  readonly description: string | null
  readonly externalRef: string | null
  readonly metadata: Readonly<Record<string, unknown>>
  readonly occurredAt: string
  readonly createdAt: string
}

// ── Wallet Ledger Entry ─────────────────────────────────────────────────────

export interface WalletLedgerEntry {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly entryType: LedgerEntryType
  readonly amount: number
  readonly currency: string
  readonly description: string | null
  readonly revenueEventId: string | null
  readonly payoutId: string | null
  readonly balanceAfter: number
  readonly createdAt: string
}

// ── Payout ──────────────────────────────────────────────────────────────────

export interface Payout {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly amount: number
  readonly currency: string
  readonly status: PayoutStatus
  /** Rail used for this payout (M-Pesa, Stripe, bank, etc.). */
  readonly payoutRail: PayoutRail | null
  readonly periodStart: string
  readonly periodEnd: string
  readonly revenueEventCount: number
  readonly metadata: Readonly<Record<string, unknown>>
  readonly previewedAt: string | null
  readonly approvedAt: string | null
  readonly completedAt: string | null
  readonly failedReason: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Collaborative Release Split ─────────────────────────────────────────────

/**
 * Defines how revenue from a release is split among collaborators.
 * Stored in release metadata, enforced at payout preview time.
 */
export interface RoyaltySplit {
  readonly creatorId: string
  readonly displayName: string
  readonly role: 'primary' | 'featured' | 'producer' | 'songwriter'
  /** Percentage of net revenue (must sum to 100 across all splits). */
  readonly sharePercent: number
}

// ── Upload Result ───────────────────────────────────────────────────────────

/** Result of uploading an audio file to blob storage. */
export interface AudioUploadResult {
  readonly blobPath: string
  readonly sha256: string
  readonly sizeBytes: number
  readonly durationSeconds: number | null
  readonly contentType: string
}

// ── Payout Preview (computed, not persisted) ────────────────────────────────

export interface PayoutPreview {
  readonly creatorId: string
  readonly orgId: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly totalRevenue: number
  readonly platformFee: number
  readonly netPayout: number
  readonly currency: string
  readonly revenueEventCount: number
  readonly breakdown: readonly PayoutBreakdownItem[]
}

export interface PayoutBreakdownItem {
  readonly revenueType: RevenueType
  readonly eventCount: number
  readonly totalAmount: number
}
