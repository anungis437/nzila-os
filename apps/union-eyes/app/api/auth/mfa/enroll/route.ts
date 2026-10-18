/**
 * POST /api/auth/mfa/enroll
 *
 * Starts MFA enrollment for the *authenticated* user. Returns the
 * otpauth:// URI (to render as a QR code) plus the 10 one-time recovery
 * codes. The secret is AES-GCM encrypted at rest; recovery codes are
 * Argon2id-hashed at rest.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/api-auth-guard'
import { findMfaEnrollmentUser } from '@/lib/services/mfa-enrollment-service'
import { enrollMfa } from '@nzila/platform-auth/mfa'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await findMfaEnrollmentUser(userId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const result = await enrollMfa({
    userId,
    userEmail: user.email,
    issuer: 'UnionEyes',
  })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 })
  }
  return NextResponse.json({
    otpAuthUri: result.otpAuthUri,
    secret: result.secret,
    recoveryCodes: result.recoveryCodes,
  })
}
