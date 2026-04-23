/**
 * Shared API route handlers for magic-link auth.
 *
 * Mount points (Union Eyes):
 *   POST /api/auth/magic-link/request  → handleRequestMagicLink
 *   POST /api/auth/magic-link/verify   → handleVerifyMagicLink
 *
 * Both responses are intentionally uniform — they never reveal whether an
 * email is associated with an account, to defeat enumeration.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requestMagicLink, verifyMagicLink } from './service'

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

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
  organizationId: z.string().uuid().optional(),
})

const verifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export async function handleRequestMagicLink(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }

    const result = await requestMagicLink({
      ...parsed.data,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json({
      message:
        'If that email is recognised, a sign-in link has been sent. Please check your inbox.',
      // Dev-only: expose the raw token so engineers can test without a mailer.
      ...(process.env.NODE_ENV === 'development' && result.token
        ? { token: result.token, expiresAt: result.expiresAt }
        : {}),
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function handleVerifyMagicLink(request: NextRequest) {
  try {
    let token: string | null = null
    if (request.method === 'GET') {
      token = new URL(request.url).searchParams.get('token')
    } else {
      const body = await request.json().catch(() => ({}))
      const parsed = verifySchema.safeParse(body)
      if (parsed.success) token = parsed.data.token
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 },
      )
    }

    const result = await verifyMagicLink({
      token,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    return NextResponse.json({ user: result.user })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
