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
import { NextResponse } from 'next/server'
import { syncAll } from '@/server/integrations/billing-sync'

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
  const result = await syncAll()
  return NextResponse.json({ ok: true, ...result })
}
