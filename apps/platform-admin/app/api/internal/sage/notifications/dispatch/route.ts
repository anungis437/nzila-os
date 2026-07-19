import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { NotificationDispatcher } from '@nzila/sage-core'
import { createSageRuntime } from '@/lib/sage/runtime'
import { createSagePlatformSqlClient } from '@/lib/sage/sql-adapter'
import { getSageDeliveryNotifier } from '@/lib/sage/delivery-notifier-adapter'

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

/**
 * Protected job entrypoint. The scheduler invokes this endpoint after commit or
 * on its own cadence; every provider attempt still passes through the durable
 * leased dispatcher rather than calling the provider from an issuance route.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  try {
    const notifier = getSageDeliveryNotifier()
    if (!notifier) return NextResponse.json({ ok: false, error: 'NOT_CONFIGURED' }, { status: 503 })
    const runtimeDeps = createSageRuntime({
      actorId: 'sage-notification-dispatcher',
      orgId: 'system',
      orgRole: 'none',
      authenticationType: 'internal_system',
    })
    const dispatcher = new NotificationDispatcher(runtimeDeps.repo, notifier, createSagePlatformSqlClient(), {
      dispatcherInstanceId: `platform-admin:${crypto.randomUUID()}`,
    })
    const recovered = await dispatcher.recoverStaleLeases()
    const result = await dispatcher.run()
    return NextResponse.json({ ok: true, data: { processed: result.processed, succeeded: result.succeeded, failed: result.failed, recovered: recovered.recovered } })
  } catch {
    return NextResponse.json({ ok: false, error: 'DISPATCH_UNAVAILABLE' }, { status: 503 })
  }
}
