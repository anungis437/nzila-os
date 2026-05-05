/**
 * TrustCore — Reminders API
 *
 * GET /api/reminders
 *   Returns active reminders for the org, sorted by severity then dueAt.
 *   Accessible by: org_admin, staff, auditor
 *
 * Query params:
 *   status — filter by status (open | completed | dismissed | overdue)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { listTrustcoreReminders } from '@nzila/db/queries/trustcore'

export const GET = withRequiredRole(
  ['org_admin', 'staff', 'auditor', 'platform_admin'],
  async (req: NextRequest, ctx) => {
    const url = new URL(req.url)
    const statusParam = url.searchParams.get('status')
    const validStatuses = ['open', 'completed', 'dismissed', 'overdue'] as const
    type Status = (typeof validStatuses)[number]

    const status: Status | undefined = validStatuses.includes(statusParam as Status)
      ? (statusParam as Status)
      : undefined

    const reminders = await listTrustcoreReminders(ctx.orgId, status)
    return NextResponse.json({ success: true, data: reminders })
  },
)
