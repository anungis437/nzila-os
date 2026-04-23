/**
 * @nzila/platform-growth-os — ICP CRUD + scoring orchestration
 */
import { z } from 'zod'
import { listRecords, readRecord, writeRecord } from '../store'
import { makeId, nowISO } from '../utils'
import { scoreIcp } from './icp-scoring'
import type { IcpSegment, TargetOrganisation } from './types'

// ── Schemas ─────────────────────────────────────────────────────────────────

const orgAttributesSchema = z.object({
  memberCount: z.number().int().nonnegative().nullable(),
  stewardCount: z.number().int().nonnegative().nullable(),
  sector: z.string().nullable(),
  province: z.string().nullable(),
  city: z.string().nullable(),
  parentUnionId: z.string().nullable(),
  localNumber: z.string().nullable(),
  governanceComplexity: z.number().min(0).max(1).nullable(),
  techMaturity: z.string().nullable(),
  hasAnnualConvention: z.boolean().nullable(),
  collectiveAgreementExpiryYear: z.number().int().nullable(),
  openGrievancesProxy: z.number().int().nonnegative().nullable(),
  warmPathDescription: z.string().nullable(),
  enrichedAt: z.string().nullable(),
})

const icpScoreContributionSchema = z.object({
  dimension: z.string(),
  weight: z.number(),
  value: z.number(),
  contribution: z.number(),
  rationale: z.string(),
})

const icpScoreSchema = z.object({
  total: z.number(),
  tier: z.enum(['A', 'B', 'C']),
  contributions: z.array(icpScoreContributionSchema),
  modelVersion: z.string(),
  computedAt: z.string(),
})

const targetOrgSchema = z.object({
  id: z.string().min(1),
  scope: z.object({ tenantId: z.string(), orgId: z.string(), product: z.string().optional() }),
  name: z.string().min(1),
  sourcingMethod: z.string(),
  attributes: orgAttributesSchema,
  matchedSegmentIds: z.array(z.string()),
  icpScore: icpScoreSchema.nullable(),
  dealEngineId: z.string().nullable(),
  hubspotId: z.string().nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const icpSegmentSchema = z.object({
  id: z.string().min(1),
  scope: z.object({ tenantId: z.string(), orgId: z.string(), product: z.string().optional() }),
  label: z.string().min(1),
  description: z.string(),
  sectors: z.array(z.string()),
  minMembers: z.number().int().nonnegative(),
  maxMembers: z.number().int().nonnegative().nullable(),
  minGovernanceComplexity: z.number().min(0).max(1),
  tier: z.enum(['A', 'B', 'C']),
  tierRationale: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// ── Entity keys ─────────────────────────────────────────────────────────────

const TARGET_ORG_ENTITY = 'icp-target-org'
const SEGMENT_ENTITY    = 'icp-segment'

// ── ICP Segments ────────────────────────────────────────────────────────────

export interface CreateSegmentInput {
  scope: IcpSegment['scope']
  label: string
  description: string
  sectors: IcpSegment['sectors']
  minMembers: number
  maxMembers: number | null
  minGovernanceComplexity: number
  tier: IcpSegment['tier']
  tierRationale: string
}

export function createSegment(input: CreateSegmentInput): IcpSegment {
  const now = nowISO()
  const record: IcpSegment = {
    id: makeId('seg'),
    ...input,
    createdAt: now,
    updatedAt: now,
  }
  return writeRecord(SEGMENT_ENTITY, record.id, record, icpSegmentSchema) as IcpSegment
}

export function getSegment(id: string): IcpSegment | null {
  return readRecord(SEGMENT_ENTITY, id, icpSegmentSchema) as IcpSegment | null
}

export function listSegments(): IcpSegment[] {
  return listRecords(SEGMENT_ENTITY, icpSegmentSchema) as IcpSegment[]
}

// ── Target Organisations ─────────────────────────────────────────────────────

export interface CreateTargetOrgInput {
  scope: TargetOrganisation['scope']
  name: string
  sourcingMethod: TargetOrganisation['sourcingMethod']
  attributes?: Partial<TargetOrganisation['attributes']>
  notes?: string
  dealEngineId?: string | null
  hubspotId?: string | null
}

const EMPTY_ATTRS: TargetOrganisation['attributes'] = {
  memberCount: null, stewardCount: null, sector: null, province: null,
  city: null, parentUnionId: null, localNumber: null,
  governanceComplexity: null, techMaturity: null, hasAnnualConvention: null,
  collectiveAgreementExpiryYear: null, openGrievancesProxy: null,
  warmPathDescription: null, enrichedAt: null,
}

export function createTargetOrg(input: CreateTargetOrgInput): TargetOrganisation {
  const now = nowISO()
  const attrs = { ...EMPTY_ATTRS, ...(input.attributes ?? {}) }
  const icpScore = hasMinDataForScoring(attrs) ? scoreIcp(attrs) : null
  const record: TargetOrganisation = {
    id: makeId('tgt'),
    scope: input.scope,
    name: input.name,
    sourcingMethod: input.sourcingMethod,
    attributes: attrs,
    matchedSegmentIds: [],
    icpScore,
    dealEngineId: input.dealEngineId ?? null,
    hubspotId: input.hubspotId ?? null,
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
  }
  return writeRecord(TARGET_ORG_ENTITY, record.id, record, targetOrgSchema) as TargetOrganisation
}

export function getTargetOrg(id: string): TargetOrganisation | null {
  return readRecord(TARGET_ORG_ENTITY, id, targetOrgSchema) as TargetOrganisation | null
}

export function listTargetOrgs(): TargetOrganisation[] {
  return listRecords(TARGET_ORG_ENTITY, targetOrgSchema) as TargetOrganisation[]
}

/** Enrich attributes and re-score. */
export function enrichTargetOrg(
  id: string,
  attrs: Partial<TargetOrganisation['attributes']>,
): TargetOrganisation | null {
  const existing = getTargetOrg(id)
  if (!existing) return null
  const merged = { ...existing.attributes, ...attrs, enrichedAt: nowISO() }
  const updated: TargetOrganisation = {
    ...existing,
    attributes: merged,
    icpScore: hasMinDataForScoring(merged) ? scoreIcp(merged) : existing.icpScore,
    updatedAt: nowISO(),
  }
  return writeRecord(TARGET_ORG_ENTITY, id, updated, targetOrgSchema) as TargetOrganisation
}

/** Returns targets ranked by ICP score descending. Unscored targets appear at the end. */
export function rankedTargetOrgs(): TargetOrganisation[] {
  const all = listTargetOrgs()
  return all.sort((a, b) => {
    const sa = a.icpScore?.total ?? -1
    const sb = b.icpScore?.total ?? -1
    return sb - sa
  })
}

function hasMinDataForScoring(attrs: TargetOrganisation['attributes']): boolean {
  return attrs.sector != null || attrs.memberCount != null || attrs.governanceComplexity != null
}
