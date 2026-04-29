/**
 * Snapshot persistence — Phase 1 + Phase 3 truth layer.
 *
 * Two flows:
 *  - `persistCurrentSnapshot(repo)` writes today's portfolio KPIs, per-venture
 *    dependency scores, and per-venture allocation rows. Idempotent on the
 *    `(captured_at, …)` indexes — running twice in one day is harmless.
 *  - `readPersistedHistory({ days })` returns the persisted history rows the
 *    cockpit can use *instead of* the deterministic synthesis when the table
 *    has data. The repository's `metricsHistory()` checks this first.
 *
 * Both gracefully degrade to no-op / [] when DATABASE_URL is unset, keeping
 * dev-mode and CI green without a live Postgres.
 */
import 'server-only'
import { sql } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core/telemetry'
import { getHqDb } from './client'
import { allocationsHistory, dependencyScores, metricsSnapshots } from './schema'
import type {
  AllocationScore,
  DependencyScore,
  PortfolioSnapshot,
} from '@nzila/hq-domain'

const logger = createLogger('nzila-hq:snapshots')

export interface SnapshotWriteInput {
  capturedAt: string // ISO
  snapshot: PortfolioSnapshot
  dependency: readonly DependencyScore[]
  allocations: readonly AllocationScore[]
  cashRunwayMonths: number | null
}

export async function persistCurrentSnapshot(
  input: SnapshotWriteInput,
): Promise<{ written: boolean; reason?: string }> {
  const db = getHqDb()
  if (!db) return { written: false, reason: 'no-db' }

  try {
    await db.insert(metricsSnapshots).values({
      capturedAt: new Date(input.capturedAt),
      activeVentures: input.snapshot.activeVentures,
      totalMrrCents: input.snapshot.totalMrrCents,
      weightedPipelineCents: input.snapshot.weightedPipelineCents,
      founderBottleneckScore: input.snapshot.founderBottleneckScore,
      cashRunwayMonths: input.cashRunwayMonths ?? null,
    })

    if (input.dependency.length > 0) {
      await db.insert(dependencyScores).values(
        input.dependency.map((d) => ({
          ventureSlug: d.ventureSlug,
          capturedAt: new Date(input.capturedAt),
          score: d.score,
          signal: d.signal,
          factors: { reasons: d.reasons } as Record<string, unknown>,
        })),
      )
    }

    if (input.allocations.length > 0) {
      await db.insert(allocationsHistory).values(
        input.allocations.map((a) => ({
          ventureSlug: a.ventureSlug,
          capturedAt: new Date(input.capturedAt),
          composite: a.composite,
          recommendation: a.recommendation,
          confidence: 'medium',
          axes: a.axes as unknown as Record<string, unknown>,
        })),
      )
    }

    return { written: true }
  } catch (err) {
    logger.error('persist failed', err instanceof Error ? err : { error: String(err) })
    return { written: false, reason: String(err) }
  }
}

export interface PersistedSeriesPoint {
  capturedAt: string
  activeVentures: number
  totalMrrCents: number
  weightedPipelineCents: number
  founderBottleneckScore: number
  cashRunwayMonths: number | null
}

export async function readPersistedHistory(opts: {
  sinceIso: string
}): Promise<PersistedSeriesPoint[]> {
  const db = getHqDb()
  if (!db) return []
  try {
    const rows = await db.execute<{
      captured_at: string
      active_ventures: number
      total_mrr_cents: number
      weighted_pipeline_cents: number
      founder_bottleneck_score: number
      cash_runway_months: number | null
    }>(sql`
      select captured_at, active_ventures, total_mrr_cents,
             weighted_pipeline_cents, founder_bottleneck_score, cash_runway_months
      from hq_metrics_snapshots
      where captured_at >= ${opts.sinceIso}::timestamptz
      order by captured_at asc
    `)
    return (rows as readonly typeof rows[number][]).map((r) => ({
      capturedAt:
        typeof r.captured_at === 'string' ? r.captured_at : new Date(r.captured_at).toISOString(),
      activeVentures: Number(r.active_ventures),
      totalMrrCents: Number(r.total_mrr_cents),
      weightedPipelineCents: Number(r.weighted_pipeline_cents),
      founderBottleneckScore: Number(r.founder_bottleneck_score),
      cashRunwayMonths: r.cash_runway_months == null ? null : Number(r.cash_runway_months),
    }))
  } catch (err) {
    logger.error('read failed', err instanceof Error ? err : { error: String(err) })
    return []
  }
}

// (entity tables remain in-memory for now; extend exports here when those
// land in Drizzle.)
