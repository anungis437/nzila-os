import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createSagePlatformSqlClient } from '@/lib/sage/sql-adapter'
import { getSageDeliveryNotifier } from '@/lib/sage/delivery-notifier-adapter'
import { getConfiguredSageDeliveryRateLimiter } from '@/lib/sage/delivery-claims'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.SAGE_CRON_SECRET
  const provided = request.headers.get('x-sage-internal-token')
  if (!expected || !provided) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  let providerConfigured = false
  let limiterConfigured = false
  try { providerConfigured = Boolean(getSageDeliveryNotifier()) } catch { providerConfigured = false }
  try { getConfiguredSageDeliveryRateLimiter(); limiterConfigured = true } catch { limiterConfigured = false }
  const encryptionConfigured = Boolean(process.env.SAGE_NOTIFICATION_ENCRYPTION_KEY)
  try {
    const { rows } = await createSagePlatformSqlClient().query<{
      pending_count: number
      oldest_pending_age_seconds: number | null
      dead_letter_count: number
    }>(`select
          count(*) filter (where status = 'pending')::int as pending_count,
          extract(epoch from (now() - min(created_at) filter (where status = 'pending')))::int as oldest_pending_age_seconds,
          count(*) filter (where status = 'dead_letter')::int as dead_letter_count
        from sage_notification_outbox`)
    const metrics = rows[0] ?? { pending_count: 0, oldest_pending_age_seconds: null, dead_letter_count: 0 }
    return NextResponse.json({ ok: true, data: {
      providerConfigured,
      encryptionConfigured,
      distributedLimiterConfigured: limiterConfigured,
      pendingNotificationCount: Number(metrics.pending_count),
      oldestPendingAgeSeconds: metrics.oldest_pending_age_seconds === null ? null : Number(metrics.oldest_pending_age_seconds),
      deadLetterCount: Number(metrics.dead_letter_count),
    } })
  } catch {
    return NextResponse.json({ ok: false, error: 'READINESS_UNAVAILABLE' }, { status: 503 })
  }
}
