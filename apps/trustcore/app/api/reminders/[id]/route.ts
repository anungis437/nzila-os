/**
 * TrustCore — Reminder Update API
 *
 * PATCH /api/reminders/[id]
 *   Complete or dismiss a reminder.
 *   Auditors may view reminders but cannot complete/dismiss them.
 *   Accessible by: org_admin, staff
 *
 * Body:
 *   { "action": "complete" | "dismiss" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import {
  getTrustcoreReminder,
  updateTrustcoreReminderStatus,
  createTrustcoreEvidenceEvent,
} from '@nzila/db/queries/trustcore'

export const PATCH = withRequiredRole(
  ['org_admin', 'staff', 'platform_admin'],
  async (req: NextRequest, ctx, params) => {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ success: false, error: 'Reminder ID required' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const action = (body as { action?: unknown }).action
    if (action !== 'complete' && action !== 'dismiss') {
      return NextResponse.json(
        { success: false, error: 'action must be "complete" or "dismiss"' },
        { status: 422 },
      )
    }

    const existing = await getTrustcoreReminder(id, ctx.orgId)
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Reminder not found' }, { status: 404 })
    }

    const newStatus = action === 'complete' ? 'completed' : 'dismissed'
    const updated = await updateTrustcoreReminderStatus(id, ctx.orgId, newStatus)

    const evidenceAction = action === 'complete' ? 'completed' : 'dismissed'
    await createTrustcoreEvidenceEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: 'reminder',
      resourceId: id,
      action: evidenceAction,
      summary: `Reminder "${existing.title}" ${evidenceAction}`,
      metadata: { reminderId: id, previousStatus: existing.status, newStatus },
    })

    return NextResponse.json({ success: true, data: updated })
  },
)
