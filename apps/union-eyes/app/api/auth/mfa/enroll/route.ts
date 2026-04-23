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
import { db } from '@/db/db'
import { enrollMfa } from '@nzila/platform-auth/mfa'
import { authUsers } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [user] = await db
    .select({ email: authUsers.email })
    .from(authUsers)
    .where(eq(authUsers.userId, userId))
    .limit(1)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const result = await enrollMfa({
    userId,
    userEmail: user.email,
    issuer: 'Union Eyes',
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
