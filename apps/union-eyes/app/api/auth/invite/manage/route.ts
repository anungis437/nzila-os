import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withOrganizationAuth } from '@/lib/organization-middleware'
import { canManageOrganizationInvites, listOrganizationInvites, reissueInvite, revokeInvite } from '@nzila/platform-auth/invites'
import { deliverOrganizationInvitation } from '@/lib/members/invitation-delivery'

const schema = z.object({ action: z.enum(['reissue', 'revoke']), inviteId: z.guid() }).strict()

export const GET = withOrganizationAuth(async (_request, context) => {
  if (!(await canManageOrganizationInvites(context.userId, context.organizationId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ invitations: await listOrganizationInvites(context.userId, context.organizationId) })
})

export const POST = withOrganizationAuth(async (request, context) => {
  if (!(await canManageOrganizationInvites(context.userId, context.organizationId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid invitation action' }, { status: 400 })
  const input = {
    inviteId: parsed.data.inviteId, actorUserId: context.userId, organizationId: context.organizationId,
    userAgent: request.headers.get('user-agent'),
  }
  if (parsed.data.action === 'revoke') {
    const result = await revokeInvite(input)
    return NextResponse.json(result, { status: result.success ? 200 : 409 })
  }
  const result = await reissueInvite(input)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json(await deliverOrganizationInvitation(result), { status: 201 })
})
