/**
 * @nzila/platform-growth-os — ICP (Ideal Customer Profile) types
 *
 * Union Eyes-specific ICP definitions. Structured so the scoring model is
 * explainable (same design philosophy as lead-score.ts).
 *
 * Dimension philosophy:
 *   - Every dimension is observable without a sales call.
 *   - Score contributions are published, not black-box.
 *   - Tier thresholds are hard-coded and version-pinned.
 */

import type { GrowthScope } from '../types'

export const ICP_VERSION = 'ue-icp-v1'

// ── Sector ─────────────────────────────────────────────────────────────────

export type UnionSector =
  | 'municipal'
  | 'healthcare'
  | 'education'
  | 'federal'
  | 'provincial'
  | 'transit'
  | 'utilities'
  | 'hospitality'
  | 'trades'
  | 'legal_professional'
  | 'other'

/** Sector priority weights derived from UE design fit and selling experience. */
export const SECTOR_WEIGHTS: Record<UnionSector, number> = {
  municipal:          1.0,
  healthcare:         0.9,
  education:          0.85,
  federal:            0.85,
  provincial:         0.8,
  transit:            0.75,
  utilities:          0.7,
  legal_professional: 0.65,
  trades:             0.55,
  hospitality:        0.4,
  other:              0.3,
}

// ── ICP Segment definition ─────────────────────────────────────────────────

export type IcpTier = 'A' | 'B' | 'C'

/**
 * A named ICP segment. Defines the scoring thresholds for one buyer archetype.
 * Multiple segments can match a single target organisation.
 */
export interface IcpSegment {
  id: string
  scope: GrowthScope
  label: string
  description: string
  /** Sectors that match this segment. */
  sectors: UnionSector[]
  /** Minimum member count to qualify. */
  minMembers: number
  /** Maximum member count (null = no ceiling). */
  maxMembers: number | null
  /** Minimum governance complexity score [0–1]. */
  minGovernanceComplexity: number
  /** Tier this segment maps to when all thresholds met. */
  tier: IcpTier
  /** Human-readable rationale for the tier. */
  tierRationale: string
  createdAt: string
  updatedAt: string
}

// ── Target organisation ────────────────────────────────────────────────────

export type SourcingMethod =
  | 'clc_directory'
  | 'cupe_directory'
  | 'conference_lead'
  | 'partner_referral'
  | 'hubspot_inbound'
  | 'cold_research'
  | 'warm_intro'
  | 'linkedin'

export type TechMaturityProxy =
  | 'spreadsheet_only'
  | 'email_plus_sharepoint'
  | 'generic_crm'
  | 'union_specific_legacy'
  | 'modern_stack'

/** Enrichment fields gathered during qualification. Nullable until known. */
export interface OrganisationAttributes {
  memberCount: number | null
  stewardCount: number | null
  sector: UnionSector | null
  province: string | null          // ISO 3166-2 sub-code, e.g. 'CA-ON'
  city: string | null
  parentUnionId: string | null
  localNumber: string | null
  governanceComplexity: number | null  // [0–1], hand-rated
  techMaturity: TechMaturityProxy | null
  hasAnnualConvention: boolean | null
  collectiveAgreementExpiryYear: number | null
  /** Number of open grievances on record (if disclosed). */
  openGrievancesProxy: number | null
  /** Known warm-path: colleague / partner / event connection. */
  warmPathDescription: string | null
  enrichedAt: string | null
}

export interface IcpScore {
  total: number            // [0–1]
  tier: IcpTier
  contributions: IcpScoreContribution[]
  modelVersion: string
  computedAt: string
}

export interface IcpScoreContribution {
  dimension: string
  weight: number
  value: number            // [0–1] normalised
  contribution: number     // weight × value
  rationale: string
}

export interface TargetOrganisation {
  id: string
  scope: GrowthScope
  /** Canonical display name (e.g. "CUPE Local 416 — Toronto Municipal"). */
  name: string
  sourcingMethod: SourcingMethod
  attributes: OrganisationAttributes
  /** ICP segment IDs that match this target. */
  matchedSegmentIds: string[]
  /** Computed score (null until scored). */
  icpScore: IcpScore | null
  /** Current CRM deal ID if one exists in deal-engine. */
  dealEngineId: string | null
  /** HubSpot contact/company ID if synced. */
  hubspotId: string | null
  /** Notes from research or qualification calls. */
  notes: string
  createdAt: string
  updatedAt: string
}
