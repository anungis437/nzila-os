/**
 * @nzila/platform-growth-os — Union Target Map types
 *
 * Models the Canadian union landscape as a navigable graph.
 * Land-and-expand logic: once a Local is converted, score adjacent Locals
 * of the same parent Union for next-wave outreach.
 */
import type { GrowthScope } from '../types'
import type { UnionSector } from '../icp/types'

// ── Core nodes ──────────────────────────────────────────────────────────────

export type UnionScope = 'national' | 'provincial' | 'regional' | 'local' | 'council'

export interface UnionNode {
  id: string
  scope: GrowthScope
  /** Short canonical name, e.g. "CUPE" or "CUPE Local 416". */
  name: string
  /** Full legal name. */
  fullName: string
  /** Hierarchy level. */
  unionScope: UnionScope
  /** Parent node ID (null for national federations). */
  parentId: string | null
  sector: UnionSector
  province: string | null    // CA-ON, CA-QC, etc.
  memberCount: number | null
  /** Known contact name for outreach (null until researched). */
  primaryContactName: string | null
  primaryContactTitle: string | null
  primaryContactEmail: string | null
  /** Website URL for research purposes (not a generated URL — sourced from public directory). */
  websiteUrl: string | null
  /** Whether this union is already in the CRM deal pipeline. */
  inPipeline: boolean
  /** CRM deal-engine ID if in pipeline. */
  dealEngineId: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

// ── Expansion relationship ───────────────────────────────────────────────────

export type ExpansionRelationType =
  | 'same_parent'        // siblings under the same national/provincial
  | 'same_sector'        // different parent, same sector
  | 'cupe_council'       // member of same CUPE District Council
  | 'clc_affiliate'      // both CLC affiliates in same province
  | 'warm_connection'    // personal/partner warm path between orgs
  | 'conference_cohort'  // met at same conference / event

export interface ExpansionRelationship {
  id: string
  sourceId: string
  targetId: string
  relationType: ExpansionRelationType
  /** Estimated adjacency score [0-1]. Higher = easier expansion path. */
  adjacencyScore: number
  notes: string
  createdAt: string
}

// ── Map summary ──────────────────────────────────────────────────────────────

export interface UnionMapStats {
  totalNodes: number
  totalMembers: number
  inPipeline: number
  expansionPaths: number
  byScope: Record<UnionScope, number>
  bySector: Partial<Record<UnionSector, number>>
  byProvince: Record<string, number>
}