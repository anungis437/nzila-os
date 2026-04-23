import { NextRequest, NextResponse } from 'next/server'
import { withOrganizationAuth } from '@/lib/organization-middleware'
import { hasMinRole } from '@/lib/api-auth-guard'
import { createInvite } from '@nzila/platform-auth/invites'
import { sendInviteEmail, logEmailDeliveryFailure } from '@/lib/auth-emails'

/**
 * Admin-only invite creation route.
 *
 * Wraps the platform-auth `createInvite` with org-scoped auth + role check
 * (admin or higher). The org id used for the invite is FORCED from the
 * authenticated context — request body cannot override it. On success, we
 * also send the invitation email via Resend.
 */
export const POST = withOrganizationAuth(async (request, context) => {
  const allowed = await hasMinRole('admin')
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string; role?: string; organizationName?: string; inviterName?: string }
  try {
    body = await (request as NextRequest).json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.email || !body.email.includes('@')) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const result = await createInvite({
    email: body.email,
    organizationId: context.organizationId,
    role: body.role,
    invitedBy: context.userId,
    ipAddress:
      (request as NextRequest).headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      (request as NextRequest).headers.get('x-real-ip') ??
      undefined,
    userAgent: (request as NextRequest).headers.get('user-agent') ?? undefined,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Fire-and-wait email delivery. Failure is logged but we still return 201
  // so the admin UI can surface the invite link directly as a fallback.
  let deliveryStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  if (result.token && result.expiresAt) {
    const delivery = await sendInviteEmail({
      to: body.email,
      token: result.token,
      expiresAt: result.expiresAt,
      role: body.role ?? 'member',
      organizationName: body.organizationName,
      inviterName: body.inviterName,
    })
    deliveryStatus = delivery.success ? 'sent' : 'failed'
    if (!delivery.success) {
      logEmailDeliveryFailure('invite', body.email, delivery.error)
    }
  }

  return NextResponse.json(
    {
      inviteId: result.inviteId,
      expiresAt: result.expiresAt,
      delivery: deliveryStatus,
      ...(process.env.NODE_ENV === 'development' && result.token
        ? { token: result.token }
        : {}),
    },
    { status: 201 },
  )
})
