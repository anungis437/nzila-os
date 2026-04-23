/**
 * GET /api/auth/mfa/status
 *
 * Returns the MFA enrollment status for the authenticated user.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/api-auth-guard'
import { getMfaStatus } from '@nzila/platform-auth/mfa'

export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const status = await getMfaStatus(userId)
  return NextResponse.json(status)
}
