/**
 * @nzila/trade-core — Domain Types
 *
 * Pure TypeScript interfaces. No DB, no framework dependencies.
 * All trade orgs are org-scoped (orgId).
 */

import type {
  TradePartyRole,
  TradePartyStatus,
  TradeListingType,
  TradeListingStatus,
  TradeMediaType,
  TradeDealStage,
  TradeQuoteStatus,
  TradeFinancingStatus,
  TradeShipmentStatus,
  TradeDocType,
  TradeCommissionStatus,
  TradeOrgRole,
  TradeEvidenceType,
} from '../enums'

// ── Branded Types ───────────────────────────────────────────────────────────

declare const __brand: unique symbol
type Brand<T, B extends string> = T & { readonly [__brand]: B }

export type TradePartyId = Brand<string, 'TradePartyId'>
export type TradeListingId = Brand<string, 'TradeListingId'>
export type TradeDealId = Brand<string, 'TradeDealId'>
export type TradeQuoteId = Brand<string, 'TradeQuoteId'>
export type TradeShipmentId = Brand<string, 'TradeShipmentId'>
export type TradeDocumentId = Brand<string, 'TradeDocumentId'>
export type TradeCommissionId = Brand<string, 'TradeCommissionId'>

// ── Context ─────────────────────────────────────────────────────────────────

/**
 * Trade org context carried through every request.
 *
 * `orgId` is the canonical field (aligns with @nzila/org).
 *
 * @see {@link @nzila/org OrgContext} for the canonical base type.
 */
export interface TradeOrgContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  readonly actorId: string
  readonly role: TradeOrgRole
  readonly permissions: readonly string[]
  readonly requestId: string
}

// ── Party ───────────────────────────────────────────────────────────────────

export interface TradeParty {
  readonly id: TradePartyId
  /** @deprecated Use TradeOrgContext.orgId — entity-level orgId will be removed. */
  readonly orgId: string
  readonly role: TradePartyRole
  readonly name: string
  readonly contactEmail: string
  readonly contactPhone: string | null
  readonly companyName: string
  readonly country: string
  readonly metadata: Record<string, unknown>
  readonly status: TradePartyStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

// ── Listing ─────────────────────────────────────────────────────────────────

export interface TradeListing {
  readonly id: TradeListingId
  readonly orgId: string
  readonly partyId: TradePartyId
  readonly listingType: TradeListingType
  readonly title: string
  readonly description: string
  readonly currency: string
  readonly askingPrice: string // numeric(18,2) as string
  readonly quantity: number
  readonly status: TradeListingStatus
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
  readonly updatedAt: Date
}

// ── Listing Media ───────────────────────────────────────────────────────────

export interface TradeListingMedia {
  readonly id: string
  readonly orgId: string
  readonly listingId: TradeListingId
  readonly mediaType: TradeMediaType
  readonly storageKey: string
  readonly sortOrder: number
  readonly createdAt: Date
}

// ── Deal ────────────────────────────────────────────────────────────────────

export interface TradeDeal {
  readonly id: TradeDealId
  readonly orgId: string
  readonly refNumber: string
  readonly sellerPartyId: TradePartyId
  readonly buyerPartyId: TradePartyId
  readonly listingId: TradeListingId | null
  readonly stage: TradeDealStage
  readonly totalValue: string
  readonly currency: string
  readonly notes: string | null
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
  readonly updatedAt: Date
}

// ── Quote ───────────────────────────────────────────────────────────────────

export interface TradeQuote {
  readonly id: TradeQuoteId
  readonly orgId: string
  readonly dealId: TradeDealId
  readonly terms: Record<string, unknown>
  readonly unitPrice: string
  readonly quantity: number
  readonly total: string
  readonly currency: string
  readonly validUntil: Date | null
  readonly status: TradeQuoteStatus
  readonly acceptedAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

// ── Financing Terms ─────────────────────────────────────────────────────────

export interface TradeFinancingTerms {
  readonly id: string
  readonly orgId: string
  readonly dealId: TradeDealId
  readonly terms: Record<string, unknown>
  readonly provider: string | null
  readonly status: TradeFinancingStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

// ── Shipment ────────────────────────────────────────────────────────────────

export interface TradeShipmentMilestone {
  readonly name: string
  readonly completedAt: Date | null
  readonly notes: string | null
}

export interface TradeShipment {
  readonly id: TradeShipmentId
  readonly orgId: string
  readonly dealId: TradeDealId
  readonly originCountry: string
  readonly destinationCountry: string
  readonly lane: string | null
  readonly carrier: string | null
  readonly trackingNumber: string | null
  readonly status: TradeShipmentStatus
  readonly milestones: TradeShipmentMilestone[]
  readonly estimatedDeparture: Date | null
  readonly estimatedArrival: Date | null
  readonly actualDeparture: Date | null
  readonly actualArrival: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

// ── Document ────────────────────────────────────────────────────────────────

export interface TradeDocument {
  readonly id: TradeDocumentId
  readonly orgId: string
  readonly dealId: TradeDealId
  readonly docType: TradeDocType
  readonly title: string
  readonly storageKey: string
  readonly contentHash: string
  readonly uploadedBy: string
  readonly createdAt: Date
}

// ── Commission ──────────────────────────────────────────────────────────────

export interface TradeCommission {
  readonly id: TradeCommissionId
  readonly orgId: string
  readonly dealId: TradeDealId
  readonly partyId: TradePartyId
  readonly policy: Record<string, unknown>
  readonly calculatedAmount: string
  readonly currency: string
  readonly status: TradeCommissionStatus
  readonly finalizedAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

// ── Audit Event ─────────────────────────────────────────────────────────────

export interface TradeAuditEntry {
  readonly id: string
  readonly orgId: string
  readonly actorId: string
  readonly role: TradeOrgRole
  readonly entityType: string
  readonly targetEntityId: string
  readonly action: string
  readonly fromState: string | null
  readonly toState: string | null
  readonly label: string
  readonly metadata: Record<string, unknown>
  readonly eventsEmitted: string[]
  readonly actionsScheduled: string[]
  readonly timestamp: Date
}

// ── Evidence Artifact ───────────────────────────────────────────────────────

export interface TradeEvidenceArtifact {
  readonly id: string
  readonly orgId: string
  readonly dealId: TradeDealId
  readonly evidenceType: TradeEvidenceType
  readonly packDigest: string
  readonly artifactsMerkleRoot: string
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
}

// ── Service Result ──────────────────────────────────────────────────────────

export interface TradeServiceResult<T> {
  readonly ok: boolean
  readonly data: T | null
  readonly error: string | null
  readonly auditEntries: TradeAuditEntry[]
}
