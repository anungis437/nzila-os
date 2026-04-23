/**
 * POST /api/auth/mfa/verify-enroll
 *
 * Completes MFA enrollment: user submits the first 6-digit code from their
 * authenticator app; on success we flip `enabled_at` and `users.two_factor_enabled = true`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/api-auth-guard'
import { verifyEnrollment } from '@nzila/platform-auth/mfa'

export const runtime = 'nodejs'

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
})

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const result = await verifyEnrollment({ userId, code: parsed.data.code })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
