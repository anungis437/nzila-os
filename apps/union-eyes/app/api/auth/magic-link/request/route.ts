/**
 * POST /api/auth/magic-link/request
 *
 * Calls platform-auth service to mint a single-use token, then delivers it
 * via the Resend-backed email sender. Response is intentionally uniform
 * (no user-enumeration leak). In development we echo the raw token and the
 * verify URL in the response so the flow can be exercised without SMTP.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requestMagicLink } from '@nzila/platform-auth/magic-link'
import { sendMagicLinkEmail, logEmailDeliveryFailure } from '@/lib/auth-emails'
import { magicLinkRequestBodySchema } from './schemas'

export const runtime = 'nodejs'

function extractIp(r: NextRequest): string | undefined {
  return (
    r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    r.headers.get('x-real-ip') ??
    undefined
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = magicLinkRequestBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const ipAddress = extractIp(request)
    const userAgent = request.headers.get('user-agent') ?? undefined

    const result = await requestMagicLink({
      email: parsed.data.email,
      organizationId: parsed.data.organizationId,
      ipAddress,
      userAgent,
    })

    const neutralMessage =
      'If that email is recognised, a sign-in link has been sent. Please check your inbox.'

    if (result.token && result.expiresAt) {
      const delivery = await sendMagicLinkEmail({
        to: parsed.data.email,
        token: result.token,
        expiresAt: result.expiresAt,
        ipAddress,
      })
      if (!delivery.success) {
        logEmailDeliveryFailure('magic_link', parsed.data.email, delivery.error)
      }
      // Dev-only echo so engineers can test without a working mailer.
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          message: neutralMessage,
          token: result.token,
          expiresAt: result.expiresAt,
          delivery: delivery.success ? 'sent' : 'failed',
        })
      }
    }

    return NextResponse.json({ message: neutralMessage })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

