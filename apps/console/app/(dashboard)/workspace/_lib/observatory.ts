/**
 * Console workspace — Institutional Intelligence Observatory loader.
 *
 * Reads the real `ii_observatory_*` tables (migration 0031) via guarded raw SQL.
 * These tables have no Drizzle schema yet, so each read is wrapped defensively:
 * if the tables are absent (not migrated in this environment) or the DB is
 * unavailable, the loader reports `available: false` and the surface renders the
 * structured empty state. Dynamic: real cohorts/assessments surface automatically
 * wherever the Observatory schema is present.
 */
import { sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'

export interface ObservatorySummary {
  available: boolean
  cohorts: { total: number; bySector: Record<string, number> }
  assessments: { total: number; byMaturity: Record<string, number> }
  routes: Record<string, number>
  reassessments: number
  dimensionsCovered: number
}

const EMPTY: ObservatorySummary = {
  available: false,
  cohorts: { total: 0, bySector: {} },
  assessments: { total: 0, byMaturity: {} },
  routes: {},
  reassessments: 0,
  dimensionsCovered: 0,
}

type Row = Record<string, unknown>

function toRows(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[]
  if (result && typeof result === 'object' && 'rows' in result) {
    return ((result as { rows?: Row[] }).rows ?? []) as Row[]
  }
  return []
}

function intOf(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function tally(rows: Row[]): { total: number; byKey: Record<string, number> } {
  const byKey: Record<string, number> = {}
  let total = 0
  for (const r of rows) {
    const key = String(r.k ?? 'unknown')
    const n = intOf(r.n)
    byKey[key] = n
    total += n
  }
  return { total, byKey }
}

/**
 * Load Observatory aggregates. Never throws — a missing schema or DB failure
 * degrades to `available: false` so the page shows the structured empty state.
 */
export async function loadObservatory(): Promise<ObservatorySummary> {
  try {
    const [sectorRows, maturityRows, routeRows, reassessRows, dimRows] = await Promise.all([
      platformDb.execute(
        sql`SELECT sector::text AS k, count(*)::int AS n FROM ii_observatory_organizations GROUP BY sector`,
      ),
      platformDb.execute(
        sql`SELECT maturity_level::text AS k, count(*)::int AS n FROM ii_observatory_assessments GROUP BY maturity_level`,
      ),
      platformDb.execute(
        sql`SELECT route_entry_type::text AS k, count(*)::int AS n FROM ii_observatory_engagements GROUP BY route_entry_type`,
      ),
      platformDb.execute(
        sql`SELECT count(*)::int AS n FROM (SELECT engagement_id FROM ii_observatory_assessments GROUP BY engagement_id HAVING count(*) > 1) t`,
      ),
      platformDb.execute(
        sql`SELECT count(DISTINCT dimension_name)::int AS n FROM ii_observatory_dimension_scores`,
      ),
    ])

    const sectors = tally(toRows(sectorRows))
    const maturity = tally(toRows(maturityRows))
    const routes = tally(toRows(routeRows))
    const reassessments = intOf(toRows(reassessRows)[0]?.n)
    const dimensionsCovered = intOf(toRows(dimRows)[0]?.n)

    return {
      available: true,
      cohorts: { total: sectors.total, bySector: sectors.byKey },
      assessments: { total: maturity.total, byMaturity: maturity.byKey },
      routes: routes.byKey,
      reassessments,
      dimensionsCovered,
    }
  } catch {
    return EMPTY
  }
}
