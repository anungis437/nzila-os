/**
 * TrustCore — Reminders Generate API
 *
 * POST /api/reminders/generate
 *   Runs the reminder engine for the current org.
 *   Logs an evidence event: reminders_generated.
 *   Accessible by: org_admin, staff
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { generateTrustcoreReminders } from '@/lib/reminders/engine'
import { createTrustcoreEvidenceEvent } from '@nzila/db/queries/trustcore'

export const POST = withRequiredRole(
  ['org_admin', 'staff', 'platform_admin'],
  async (_req: NextRequest, ctx) => {
    const reminders = await generateTrustcoreReminders(ctx.orgId)

    await createTrustcoreEvidenceEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: 'reminder',
      resourceId: ctx.orgId,
      action: 'created',
      summary: `${reminders.length} reminder(s) generated or found`,
      metadata: { count: reminders.length, triggeredBy: 'manual' },
    })

    return NextResponse.json({ success: true, data: reminders, count: reminders.length })
  },
)
