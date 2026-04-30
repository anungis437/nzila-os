import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getPolicyPerformance, refreshPolicyPerformance } from '@/server/policy-performance-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const refresh = request.nextUrl.searchParams.get('refresh') === '1'
    const perDomain = Number(request.nextUrl.searchParams.get('cases') ?? 75)
    const data = refresh ? refreshPolicyPerformance(perDomain) : getPolicyPerformance(perDomain)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
