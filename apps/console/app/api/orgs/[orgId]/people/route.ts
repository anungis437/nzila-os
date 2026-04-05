// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Org People (Member Management)
 * POST /api/orgs/[orgId]/people → add member to org
 *
 * REM-09: All member-management mutations emit audit events.
 */
import { NextRequest, NextResponse } from 'next/server'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'
import { authenticateUser as _authenticateUser, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { z } from 'zod'

const AddMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['org_admin', 'org_secretary', 'org_viewer']),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params

  return withSpan('api.orgs.people.add', { orgId }, async () => {
    const access = await requireOrgAccess(orgId, { minRole: 'org_admin' })
    if (!access.ok) return access.response

    const body = await request.json()
    const parsed = AddMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { userId, role, email, displayName } = parsed.data

    const [member] = await platformDb
      .insert(orgMembers)
      .values({
        orgId,
        userId,
        role,
      })
      .returning()

    await recordAuditEvent({
      orgId,
      actorClerkUserId: access.context.userId,
      actorRole: access.context.membership?.role ?? access.context.platformRole,
      action: AUDIT_ACTIONS.MEMBER_ADD,
      targetType: 'member',
      targetId: member.id,
      afterJson: { userId, role, email, displayName },
    })

    return NextResponse.json(
      { id: member.id, userId, role, email, displayName, orgId, status: member.status },
      { status: 201 },
    )
  })
}
