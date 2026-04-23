/**
 * POST /api/auth/mfa/disable
 *
 * Self-service: disable MFA for the authenticated user. Admin disable on
 * behalf of another user requires the admin policy UI (separate endpoint).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/api-auth-guard'
import { disableMfa } from '@nzila/platform-auth/mfa'

export const runtime = 'nodejs'

const bodySchema = z.object({ reason: z.string().optional() })

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
  await disableMfa(userId, userId, parsed.data.reason ?? 'self_service')
  return NextResponse.json({ ok: true })
}
