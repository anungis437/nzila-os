/**
 * Snapshot persistence endpoint — Phase 1 + Phase 3.
 *
 * POST /api/internal/snapshots/persist
 *
 * Authenticated by a shared secret (`NZILA_HQ_SNAPSHOT_TOKEN`) so it can be
 * called by an external scheduler (Azure Container App job, GitHub Action,
 * cron) without depending on the cookie auth flow. Idempotent at the day
 * level — running twice in 24h just inserts two rows.
 *
 * Body: none. Response: `{ written, ventures, dependency, allocations }`.
 */
import { NextResponse } from 'next/server'
import { getHqRepository } from '@/server/repository'
import { persistCurrentSnapshot } from '@/server/db/snapshots'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const expected = process.env.NZILA_HQ_SNAPSHOT_TOKEN
  if (!expected) {
    return NextResponse.json(
      { ok: false, reason: 'snapshot-endpoint-disabled' },
      { status: 503 },
    )
  }
  const presented = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (presented !== expected) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const repo = getHqRepository()
  const snap = repo.portfolioSnapshot()
  const dep = repo.dependencyScores()
  const alloc = repo.allocationScores()
  const finance = repo.financeSnapshot()

  const result = await persistCurrentSnapshot({
    capturedAt: new Date().toISOString(),
    snapshot: snap,
    dependency: dep,
    allocations: alloc,
    cashRunwayMonths: finance.cashRunwayMonths,
  })

  return NextResponse.json({
    ok: result.written,
    reason: result.reason ?? null,
    counts: { ventures: snap.activeVentures, dependency: dep.length, allocations: alloc.length },
  })
}
