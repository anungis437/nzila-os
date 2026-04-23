/**
 * MFA HTTP handlers.
 *
 * Mount points (Union Eyes):
 *   POST /api/auth/mfa/enroll        → handleEnroll (returns URI+recovery codes)
 *   POST /api/auth/mfa/verify-enroll → handleVerifyEnroll (flips enabled)
 *   POST /api/auth/mfa/challenge     → handleChallenge (step-up post-password)
 *   POST /api/auth/mfa/disable       → handleDisable (self or admin)
 *   GET  /api/auth/mfa/status        → handleStatus
 *
 * Enroll/verify-enroll/disable(self) + status require an authenticated session
 * (enforced by the route layer via the app's auth guard). Challenge is public
 * — the challenge token IS the credential.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  enrollMfa,
  verifyEnrollment,
  consumeMfaChallenge,
  disableMfa,
  getMfaStatus,
} from './service'

function extractIp(r: NextRequest): string | undefined {
  return (
    r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    r.headers.get('x-real-ip') ??
    undefined
  )
}
function extractUserAgent(r: NextRequest): string | undefined {
  return r.headers.get('user-agent') ?? undefined
}

const enrollSchema = z.object({
  userId: z.string().min(1),
  userEmail: z.string().email(),
  issuer: z.string().min(1).optional(),
})

const verifyEnrollSchema = z.object({
  userId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
})

const challengeSchema = z
  .object({
    challengeToken: z.string().min(1),
    code: z.string().regex(/^\d{6}$/).optional(),
    recoveryCode: z.string().min(8).optional(),
  })
  .refine((v) => v.code || v.recoveryCode, {
    message: 'Provide either a 6-digit code or a recovery code',
  })

const disableSchema = z.object({
  userId: z.string().min(1),
  actorUserId: z.string().min(1),
  reason: z.string().optional(),
})

export async function handleEnroll(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = enrollSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }
    const result = await enrollMfa(parsed.data)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({
      otpAuthUri: result.otpAuthUri,
      secret: result.secret,
      recoveryCodes: result.recoveryCodes,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function handleVerifyEnroll(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = verifyEnrollSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }
    const result = await verifyEnrollment(parsed.data)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function handleChallenge(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = challengeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }
    const result = await consumeMfaChallenge({
      ...parsed.data,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }
    return NextResponse.json({ ok: true, userId: result.userId })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function handleDisable(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = disableSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }
    await disableMfa(parsed.data.userId, parsed.data.actorUserId, parsed.data.reason)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function handleStatus(request: NextRequest) {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }
  const status = await getMfaStatus(userId)
  return NextResponse.json(status)
}
