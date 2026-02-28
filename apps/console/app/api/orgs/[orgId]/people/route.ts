// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Org People (Member Management)
 * POST /api/orgs/[orgId]/people → add member to org
 *
 * REM-09: All member-management mutations emit audit events.
 */
import { NextRequest, NextResponse } from 'next/server'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'
import { authenticateUser } from '@/lib/api-guards'
import { z } from 'zod'

const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
  displayName: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response
  const { userId, platformRole: actorRole } = authResult

  const { orgId } = await params
  const body = await request.json()
  const parsed = AddMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { email, role, displayName } = parsed.data

  // TODO: Actual member creation via DB insert (orgMembers table)
  const newMemberId = crypto.randomUUID()

  await recordAuditEvent({
    orgId,
    actorClerkUserId: userId,
    actorRole,
    action: AUDIT_ACTIONS.MEMBER_ADD,
    targetType: 'member',
    targetId: newMemberId,
    afterJson: { email, role, displayName },
  })

  return NextResponse.json(
    { id: newMemberId, email, role, displayName, orgId },
    { status: 201 },
  )
}
