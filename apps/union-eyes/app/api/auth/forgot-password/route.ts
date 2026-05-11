/**
 * POST /api/auth/forgot-password
 *
 * Union-Eyes wrapper: runs the platform-auth `forgotPassword` flow and, when
 * a token is returned, delivers it via Resend. Returns a uniform neutral
 * message regardless of account existence (anti-enumeration).
 */
import { NextRequest, NextResponse } from 'next/server'
import { forgotPassword } from '@nzila/platform-auth/password'
import { sendPasswordResetEmail, logEmailDeliveryFailure } from '@/lib/auth-emails'
import { forgotPasswordBodySchema } from './schemas'

export const runtime = 'nodejs'

function extractIp(r: NextRequest): string | undefined {
  return (
    r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    r.headers.get('x-real-ip') ??
    undefined
  )
}

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = forgotPasswordBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const ip = extractIp(request)
    const ua = request.headers.get('user-agent') ?? undefined
    const result = await forgotPassword({
      email: parsed.data.email,
      ipAddress: ip,
      userAgent: ua,
    })

    const neutral =
      'If an account exists with that email, a password reset link will be sent.'

    if (result.token) {
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)
      const delivery = await sendPasswordResetEmail({
        to: parsed.data.email,
        token: result.token,
        expiresAt,
      })
      if (!delivery.success) {
        logEmailDeliveryFailure('password_reset', parsed.data.email, delivery.error)
      }
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          message: neutral,
          token: result.token,
          delivery: delivery.success ? 'sent' : 'failed',
        })
      }
    }

    return NextResponse.json({ message: neutral })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
