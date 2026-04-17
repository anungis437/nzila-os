// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Tamper Verification Status
 * GET /api/audit/tamper-status   → latest seal/chain verification summary
 *
 * Returns the most recent verification timestamp and pass/fail status.
 * Used by the console proof widget.
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { auditEvents } from '@nzila/db/schema'
import { asc, sql } from 'drizzle-orm'
import { verifyChain } from '@nzila/os-core/hash'
import { requireRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    await requireRole('platform_admin', 'studio_admin', 'ops', 'analyst')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const verifiedAt = new Date().toISOString()

  try {
    // Verify audit chain integrity (sample first org with events)
    const [sampleRow] = await platformDb
      .select({ orgId: auditEvents.orgId })
      .from(auditEvents)
      .groupBy(auditEvents.orgId)
      .limit(1)

    let chainValid = true
    let entryCount = 0

    if (sampleRow) {
      const entries = await platformDb
        .select()
        .from(auditEvents)
        .where(sql`${auditEvents.orgId} = ${sampleRow.orgId}`)
        .orderBy(asc(auditEvents.createdAt))
        .limit(500)

      entryCount = entries.length

      if (entries.length > 1) {
        const hashable = entries.filter(
          (e): e is typeof e & { hash: string } => typeof e.hash === 'string',
        )
        if (hashable.length > 1) {
          const result = verifyChain(hashable, (e) => ({
            orgId: e.orgId,
            action: e.action,
            targetType: e.targetType,
            targetId: e.targetId,
            actorClerkUserId: e.actorClerkUserId,
            beforeJson: e.beforeJson,
            afterJson: e.afterJson,
          }))
          chainValid = result.valid
        }
      }
    }

    return NextResponse.json({
      status: chainValid ? 'pass' : 'fail',
      verifiedAt,
      entryCount,
      chainValid,
    })
  } catch (_error) {
    return NextResponse.json({
      status: 'fail',
      verifiedAt,
      entryCount: 0,
      chainValid: false,
      error: 'Verification failed',
    })
  }
}
