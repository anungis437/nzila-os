/**
 * Snapshot persistence endpoint — Phase 1 + Phase 3.
 *
 * POST /api/internal/snapshots/persist
 *
 * Authenticated by a shared secret (`NZILA_HQ_SNAPSHOT_TOKEN`) so it can be
 * called by an external scheduler (Azure Container App job, GitHub Action,
 * cron) without depending on the cookie auth flow. Idempotent at the day
 * level — a durable UTC-day claim prevents duplicate snapshot batches.
 *
 * Body: none. Response: `{ written, ventures, dependency, allocations }`.
 */
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  buildCacheKey,
  hashPayload,
  IdempotencyConflictError,
  IdempotencyInProgressError,
  runIdempotentMutation,
} from '@nzila/os-core/idempotency'
import { getHqRepository } from '@/server/repository'
import { persistCurrentSnapshot } from '@/server/db/snapshots'
import { getHqIdempotencyCache } from '@/server/idempotency-cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function hasValidBearerToken(req: Request, expected: string): boolean {
  const presented = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const presentedBytes = Buffer.from(presented)
  const expectedBytes = Buffer.from(expected)
  return (
    presentedBytes.length === expectedBytes.length && timingSafeEqual(presentedBytes, expectedBytes)
  )
}

export async function POST(req: Request) {
  const CRON_SECRET = process.env.NZILA_HQ_SNAPSHOT_TOKEN
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, reason: 'snapshot-endpoint-disabled' }, { status: 503 })
  }
  if (!hasValidBearerToken(req, CRON_SECRET)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const idempotencyKey = req.headers.get('Idempotency-Key')
  if (!idempotencyKey?.trim()) {
    return NextResponse.json(
      { ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', reason: 'idempotency-key-required' },
      { status: 400 },
    )
  }

  const snapshotDay = new Date().toISOString().slice(0, 10)
  try {
    const mutation = await runIdempotentMutation({
      cache: getHqIdempotencyCache(),
      cacheKey: buildCacheKey('nzila-hq', '/api/internal/snapshots/persist', idempotencyKey),
      payloadHash: hashPayload(snapshotDay),
      status: 200,
      run: async () => {
        const repo = getHqRepository()
        const snap = repo.portfolioSnapshot()
        const dep = repo.dependencyScores()
        const alloc = repo.allocationScores()
        const finance = repo.financeSnapshot()
        const result = await persistCurrentSnapshot({
          capturedAt: `${snapshotDay}T00:00:00.000Z`,
          snapshot: snap,
          dependency: dep,
          allocations: alloc,
          cashRunwayMonths: finance.cashRunwayMonths,
        })
        if (result.reason === 'already-exists') {
          return {
            ok: true,
            reason: 'already-persisted',
            counts: {
              ventures: snap.activeVentures,
              dependency: dep.length,
              allocations: alloc.length,
            },
          }
        }
        if (!result.written) {
          throw new Error(`Snapshot persistence failed: ${result.reason ?? 'unknown error'}`)
        }
        return {
          ok: true,
          reason: null,
          counts: {
            ventures: snap.activeVentures,
            dependency: dep.length,
            allocations: alloc.length,
          },
        }
      },
    })
    return NextResponse.json(mutation.response)
  } catch (error) {
    if (error instanceof IdempotencyConflictError || error instanceof IdempotencyInProgressError) {
      return NextResponse.json(
        { ok: false, reason: error.code, message: error.message },
        { status: 409 },
      )
    }
    throw error
  }
}
