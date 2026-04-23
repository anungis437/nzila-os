/**
 * Invite handlers — accept-invite is public (the token IS the credential).
 * Create-invite is authenticated and admin-only at the route layer; the
 * handler accepts the invitedBy userId from the caller and trusts the route
 * to have verified the caller's role.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { acceptInvite, createInvite } from './service'

function extractIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    undefined
  )
}

function extractUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') ?? undefined
}

const acceptSchema = z.object({
  token: z.string().min(1),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
})

export async function handleAcceptInvite(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = acceptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }
    const result = await acceptInvite({
      ...parsed.data,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ user: result.user })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

const createSchema = z.object({
  email: z.string().email(),
  organizationId: z.string().uuid(),
  role: z.string().optional(),
  invitedBy: z.string().min(1),
})

/**
 * NOTE: this handler trusts the caller to have authenticated and authorised
 * the request. The Union Eyes route wraps this with `withOrganizationAuth` +
 * `hasMinRole('admin')` before delegating.
 */
export async function handleCreateInvite(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }
    const result = await createInvite({
      ...parsed.data,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(
      {
        inviteId: result.inviteId,
        expiresAt: result.expiresAt,
        // Dev-only: expose the raw invite token so engineers can test
        // without a mailer in place.
        ...(process.env.NODE_ENV === 'development' && result.token
          ? { token: result.token }
          : {}),
      },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
