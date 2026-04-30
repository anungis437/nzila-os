import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getReleaseDashboardData } from '@/server/release-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const data = await getReleaseDashboardData()
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
