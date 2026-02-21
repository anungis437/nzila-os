// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Close Period Detail
 * GET /api/finance/close/[periodId]  → close period with tasks, exceptions, approvals
 *
 * PR5 — Entity-scoped auth via requireEntityAccess
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { closePeriods, closeTasks, closeExceptions, closeApprovals } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { authenticateUser } from '@/lib/api-guards'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response

  const { periodId } = await params

  const [[period], tasks, exceptions, approvals] = await Promise.all([
    db.select().from(closePeriods).where(eq(closePeriods.id, periodId)),
    db.select().from(closeTasks).where(eq(closeTasks.periodId, periodId)),
    db.select().from(closeExceptions).where(eq(closeExceptions.periodId, periodId)),
    db.select().from(closeApprovals).where(eq(closeApprovals.periodId, periodId)),
  ])

  if (!period) {
    return NextResponse.json({ error: 'Close period not found' }, { status: 404 })
  }

  return NextResponse.json({ period, tasks, exceptions, approvals })
}
