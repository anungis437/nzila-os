/**
 * POST /api/internal/billing/sync
 *
 * Bearer-token guarded (`NZILA_HQ_SNAPSHOT_TOKEN` — same secret as the
 * snapshots endpoint to keep cron config simple). Triggers Stripe + QBO
 * sync into the HQ ledger tables. Both flows are independently feature-
 * flagged via `NZILA_HQ_BILLING_STRIPE` / `NZILA_HQ_BILLING_QBO`.
 *
 * Response body shape: `{ stripe: SyncResult, qbo: SyncResult }`.
 */
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { syncAll } from '@/server/integrations/billing-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function hasValidBearerToken(req: Request, expected: string): boolean {
  const presented = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const presentedBytes = Buffer.from(presented)
  const expectedBytes = Buffer.from(expected)
  return (
    presentedBytes.length === expectedBytes.length &&
    timingSafeEqual(presentedBytes, expectedBytes)
  )
}

export async function POST(req: Request) {
  const CRON_SECRET = process.env.NZILA_HQ_SNAPSHOT_TOKEN
  if (!CRON_SECRET) {
    return NextResponse.json(
      { ok: false, reason: 'snapshot-endpoint-disabled' },
      { status: 503 },
    )
  }
  if (!hasValidBearerToken(req, CRON_SECRET)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }
  const result = await syncAll()
  return NextResponse.json({ ok: true, ...result })
}
