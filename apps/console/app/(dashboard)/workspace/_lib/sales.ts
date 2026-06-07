/**
 * Console workspace — sales/pipeline data loader.
 *
 * Derives from the canonical Deal Engine lifecycle (@nzila/deal-engine). Reads
 * real deals from the `deals` table (partner-sourced GTM registrations, mapped
 * onto the canonical stage vocabulary) and falls back to the deterministic seed
 * when no rows exist or the DB is unavailable. The stage vocabulary is never
 * re-declared locally.
 */
import { platformDb } from '@nzila/db/platform'
import { deals as dealsTable } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { seedDeals } from '@nzila/deal-engine/seed'
import {
  STAGE_METADATA,
  isActiveStage,
  isPilotStage,
  type Deal,
  type DealProduct,
  type DealStage,
} from '@nzila/deal-engine'

export type { Deal, DealStage }
export { STAGE_METADATA }

/** Persisted partner-deal registration stages (the raw `deals.stage` enum). */
export const PARTNER_STAGES = ['registered', 'submitted', 'approved', 'won', 'lost'] as const
export type PartnerStage = (typeof PARTNER_STAGES)[number]

/** Partner-deal registration stages → canonical Deal Engine lifecycle stages. */
const PARTNER_STAGE_MAP: Record<string, DealStage | null> = {
  registered: 'lead',
  submitted: 'pilot_proposed',
  approved: 'pilot_active',
  won: 'converted',
  lost: null,
}

/** Canonical lifecycle stage → the partner stage it was derived from (best-effort). */
const CANONICAL_TO_PARTNER: Partial<Record<DealStage, PartnerStage>> = {
  lead: 'registered',
  pilot_proposed: 'submitted',
  pilot_active: 'approved',
  converted: 'won',
}

/** Reverse-map a canonical stage back onto the partner enum for edit defaults. */
export function canonicalToPartnerStage(stage: DealStage): PartnerStage {
  return CANONICAL_TO_PARTNER[stage] ?? 'registered'
}

const KNOWN_PRODUCTS: DealProduct[] = [
  'union-eyes',
  'flow',
  'cfo',
  'zonga',
  'mobility',
  'agrimo',
  'platform',
  'bundle',
]

/** Best-effort map a free-text vertical onto a canonical product, defaulting to platform. */
function mapVerticalToProduct(vertical: string): DealProduct {
  const v = vertical.toLowerCase()
  return (
    KNOWN_PRODUCTS.find((p) => v.includes(p) || v.includes(p.replace('-', ' '))) ?? 'platform'
  )
}

function daysSince(date: Date | null | undefined, now: number): number {
  if (!date) return 0
  return Math.max(0, Math.floor((now - new Date(date).getTime()) / 86_400_000))
}

/** Map a persisted partner-deal row onto the canonical Deal shape. */
function toDeal(row: typeof dealsTable.$inferSelect, now: number): Deal | null {
  const stage = PARTNER_STAGE_MAP[row.stage]
  if (!stage) return null
  return {
    id: row.id,
    accountId: null,
    accountName: row.accountName,
    source: 'partner',
    stage,
    owner: row.nzilaReviewerId ?? 'Unassigned',
    partnerId: row.partnerId,
    partnerName: null,
    product: mapVerticalToProduct(row.vertical),
    estimatedValue: Number(row.estimatedArr) || 0,
    currency: 'CAD',
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    nextAction: null,
    daysInStage: daysSince(row.updatedAt, now),
    conversionRisk: null,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
    updatedAt: (row.updatedAt ?? new Date()).toISOString(),
  }
}

/** Sales workspace sub-tab → canonical stages (see Tab Schema, Workspace 4). */
export const SALES_TAB_STAGES: Record<string, DealStage[]> = {
  leads: ['lead', 'qualified'],
  opportunities: ['demo_scheduled', 'demo_completed'],
  proposals: ['pilot_proposed'],
  pilots: ['pilot_active', 'data_received', 'ingestion_running', 'pilot_review'],
  conversions: ['converted', 'expanding'],
}

/** Portfolio → Pipeline column model (Discovery → … → Expansion). */
export const PIPELINE_COLUMNS: { key: string; label: string; stages: DealStage[] }[] = [
  { key: 'discovery', label: 'Discovery', stages: ['lead'] },
  { key: 'qualified', label: 'Qualified', stages: ['qualified', 'demo_scheduled', 'demo_completed'] },
  { key: 'proposal', label: 'Proposal', stages: ['pilot_proposed'] },
  { key: 'pilot', label: 'Pilot', stages: ['pilot_active', 'data_received', 'ingestion_running', 'pilot_review'] },
  { key: 'deployment', label: 'Deployment', stages: ['converted'] },
  { key: 'expansion', label: 'Expansion', stages: ['expanding'] },
]

export function loadDeals(): Deal[] {
  return seedDeals
}

/** Raw, editable projection of a persisted deal row (drives edit forms). */
export interface EditableDeal {
  id: string
  accountName: string
  vertical: string
  estimatedArr: number
  stage: PartnerStage
  owner: string
  expectedCloseDate: string | null
  notes: string
}

function toEditable(row: typeof dealsTable.$inferSelect): EditableDeal {
  const stage = (PARTNER_STAGES as readonly string[]).includes(row.stage)
    ? (row.stage as PartnerStage)
    : 'registered'
  return {
    id: row.id,
    accountName: row.accountName,
    vertical: row.vertical,
    estimatedArr: Number(row.estimatedArr) || 0,
    stage,
    owner: row.nzilaReviewerId ?? '',
    expectedCloseDate: row.expectedCloseDate ?? null,
    notes: row.notes ?? '',
  }
}

export interface SalesView {
  /** `db` when at least one real deal exists; `seed` when falling back. */
  source: 'db' | 'seed'
  deals: Deal[]
  /** Editable raw rows keyed by id; empty when falling back to the seed. */
  editable: Record<string, EditableDeal>
}

/**
 * Load deals with provenance. Returns real DB-backed deals when any exist,
 * otherwise the deterministic seed. Never throws. The `source` flag and
 * `editable` map let the UI decide whether per-row edit/delete controls apply
 * (seed rows are not editable).
 */
export async function loadSalesView(): Promise<SalesView> {
  try {
    const now = Date.now()
    const rows = await platformDb.select().from(dealsTable)
    const mapped = rows
      .map((r) => toDeal(r, now))
      .filter((d): d is Deal => d !== null)
    if (mapped.length > 0) {
      const editable: Record<string, EditableDeal> = {}
      for (const r of rows) editable[r.id] = toEditable(r)
      return { source: 'db', deals: mapped, editable }
    }
  } catch {
    // DB unavailable or table missing — fall back to the deterministic seed.
  }
  return { source: 'seed', deals: seedDeals, editable: {} }
}

/**
 * Load deals from the database, mapped onto the canonical lifecycle. Returns the
 * deterministic seed when no rows exist or the DB is unavailable. Never throws.
 */
export async function loadDealsLive(): Promise<Deal[]> {
  return (await loadSalesView()).deals
}

/** Full detail projection of a single persisted deal (drives the detail page). */
export interface DealDetail {
  id: string
  accountName: string
  contactName: string
  contactEmail: string
  vertical: string
  product: DealProduct
  partnerStage: PartnerStage
  canonicalStage: DealStage | null
  estimatedArr: number
  owner: string
  expectedCloseDate: string | null
  notes: string
  partnerId: string
  createdAt: string
  updatedAt: string
}

/**
 * Load a single deal by id with full detail. Returns null when the id is not a
 * real persisted deal (e.g. a deterministic seed row) or the DB is unavailable.
 * Never throws.
 */
export async function loadDealDetail(dealId: string): Promise<DealDetail | null> {
  try {
    const rows = await platformDb.select().from(dealsTable).where(eq(dealsTable.id, dealId)).limit(1)
    const row = rows[0]
    if (!row) return null
    const partnerStage = (PARTNER_STAGES as readonly string[]).includes(row.stage)
      ? (row.stage as PartnerStage)
      : 'registered'
    return {
      id: row.id,
      accountName: row.accountName,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      vertical: row.vertical,
      product: mapVerticalToProduct(row.vertical),
      partnerStage,
      canonicalStage: PARTNER_STAGE_MAP[row.stage] ?? null,
      estimatedArr: Number(row.estimatedArr) || 0,
      owner: row.nzilaReviewerId ?? '',
      expectedCloseDate: row.expectedCloseDate ?? null,
      notes: row.notes ?? '',
      partnerId: row.partnerId,
      createdAt: (row.createdAt ?? new Date()).toISOString(),
      updatedAt: (row.updatedAt ?? new Date()).toISOString(),
    }
  } catch {
    return null
  }
}

/** Build the editable form projection from a loaded detail row. */
export function detailToEditable(detail: DealDetail): EditableDeal {
  return {
    id: detail.id,
    accountName: detail.accountName,
    vertical: detail.vertical,
    estimatedArr: detail.estimatedArr,
    stage: detail.partnerStage,
    owner: detail.owner,
    expectedCloseDate: detail.expectedCloseDate,
    notes: detail.notes,
  }
}

export function dealsForStages(deals: Deal[], stages: DealStage[]): Deal[] {
  const set = new Set(stages)
  return deals
    .filter((d) => set.has(d.stage))
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
}

export interface SalesSummary {
  openOpportunities: number
  activePilots: number
  pipelineValue: number
  convertedValue: number
}

export function summarizeSales(deals: Deal[]): SalesSummary {
  let openOpportunities = 0
  let activePilots = 0
  let pipelineValue = 0
  let convertedValue = 0

  for (const d of deals) {
    if (isActiveStage(d.stage)) {
      openOpportunities += 1
      pipelineValue += d.estimatedValue
    }
    if (isPilotStage(d.stage)) activePilots += 1
    if (d.stage === 'converted' || d.stage === 'expanding') convertedValue += d.estimatedValue
  }

  return { openOpportunities, activePilots, pipelineValue, convertedValue }
}
