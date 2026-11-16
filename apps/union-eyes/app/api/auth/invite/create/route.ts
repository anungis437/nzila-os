import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withOrganizationAuth } from '@/lib/organization-middleware'
import { canManageOrganizationInvites, createInvite } from '@nzila/platform-auth/invites'
import { deliverOrganizationInvitation } from '@/lib/members/invitation-delivery'

const schema = z.object({ email: z.string().trim().email().max(254), role: z.string().max(64).optional() })

/** The actor and tenant always come from the authenticated organization context. */
export const POST = withOrganizationAuth(async (request, context) => {
  if (!(await canManageOrganizationInvites(context.userId, context.organizationId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'A valid email and role are required' }, { status: 400 })

  const result = await createInvite({
    ...parsed.data,
    organizationId: context.organizationId,
    invitedBy: context.userId,
    userAgent: request.headers.get('user-agent'),
  })
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(await deliverOrganizationInvitation(result), { status: 201 })
})
