/**
 * Console workspace — funding / non-dilutive capital loader.
 *
 * Reads the real `grants` table scoped to the canonical executive org. Dynamic:
 * grant rows appear the moment they are recorded — no redeploy. Falls back to the
 * curated funding-source structure when no grants exist yet (or the DB is
 * unavailable) so the surface always renders without throwing.
 */
import { desc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { grants } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'

/**
 * Stable fallback org id used when no canonical executive org is resolvable
 * (e.g. the `orgs` table is absent locally). Grants created and read both use
 * this id, so the funding surface round-trips without an orgs row.
 */
export const FUNDING_ORG_FALLBACK = '00000000-0000-0000-0000-000000000001'

/** Resolve the org id grants are scoped to — the executive org, else the fallback. */
export async function resolveFundingOrgId(): Promise<string> {
  const orgId = await getExecutiveOrgId()
  return orgId ?? FUNDING_ORG_FALLBACK
}

export interface GrantRow {
  id: string
  programName: string
  grantor: string | null
  status: string
  amountRequested: number
  amountAwarded: number
  amountDrawnDown: number
  currency: string
  applicationDeadline: string | null
  decisionDate: string | null
  reportDueDate: string | null
  owner: string | null
  productKey: string | null
  notes: string | null
}

export interface FundingSource {
  name: string
  kind: string
  note: string
}

/** Editorial fallback shown before any grant rows are recorded. */
export const CURATED_FUNDING_SOURCES: FundingSource[] = [
  { name: 'IRAP', kind: 'Grant', note: 'NRC Industrial Research Assistance Program' },
  { name: 'CanExport', kind: 'Grant', note: 'Export market development funding' },
  { name: 'Investors', kind: 'Equity', note: 'Angel / pre-seed conversations' },
  { name: 'Revenue', kind: 'Organic', note: 'Pilot-to-contract conversion' },
]

export interface FundingTotals {
  requested: number
  awarded: number
  drawnDown: number
  count: number
}

export interface FundingView {
  source: 'db' | 'curated'
  grants: GrantRow[]
  sources: FundingSource[]
  totals: FundingTotals
}

function num(value: string | null): number {
  if (!value) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function curatedView(): FundingView {
  return {
    source: 'curated',
    grants: [],
    sources: CURATED_FUNDING_SOURCES,
    totals: { requested: 0, awarded: 0, drawnDown: 0, count: 0 },
  }
}

/**
 * Load the funding pipeline. Returns real grant rows when present, otherwise the
 * curated source list. Never throws — DB failures degrade to the curated view.
 */
export async function loadFunding(): Promise<FundingView> {
  try {
    const orgId = await resolveFundingOrgId()

    const rows = await platformDb
      .select()
      .from(grants)
      .where(eq(grants.organizationId, orgId))
      .orderBy(desc(grants.applicationDeadline))

    if (rows.length === 0) return curatedView()

    const mapped: GrantRow[] = rows.map((r) => ({
      id: r.id,
      programName: r.programName,
      grantor: r.grantor,
      status: r.status,
      amountRequested: num(r.amountRequested),
      amountAwarded: num(r.amountAwarded),
      amountDrawnDown: num(r.amountDrawnDown),
      currency: r.currency ?? 'CAD',
      applicationDeadline: r.applicationDeadline,
      decisionDate: r.decisionDate,
      reportDueDate: r.reportDueDate,
      owner: r.owner,
      productKey: r.productKey,
      notes: r.notes,
    }))

    const totals = mapped.reduce<FundingTotals>(
      (acc, g) => ({
        requested: acc.requested + g.amountRequested,
        awarded: acc.awarded + g.amountAwarded,
        drawnDown: acc.drawnDown + g.amountDrawnDown,
        count: acc.count + 1,
      }),
      { requested: 0, awarded: 0, drawnDown: 0, count: 0 },
    )

    return { source: 'db', grants: mapped, sources: CURATED_FUNDING_SOURCES, totals }
  } catch {
    return curatedView()
  }
}

/** Tone for a grant status badge. */
export function grantStatusTone(status: string): 'green' | 'blue' | 'amber' | 'gray' | 'red' {
  switch (status) {
    case 'awarded':
    case 'reporting':
      return 'green'
    case 'submitted':
    case 'drafting':
      return 'blue'
    case 'prospecting':
      return 'amber'
    case 'rejected':
      return 'red'
    default:
      return 'gray'
  }
}
