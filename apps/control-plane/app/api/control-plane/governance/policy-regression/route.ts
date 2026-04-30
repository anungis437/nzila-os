import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getPolicyRegressionAnalysis } from '@/server/policy-regression-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const candidateVersion = request.nextUrl.searchParams.get('candidateVersion') ?? 'v2'
    const baselineVersion = request.nextUrl.searchParams.get('baselineVersion') ?? 'v1'
    const perDomain = Number(request.nextUrl.searchParams.get('cases') ?? 75)

    const data = getPolicyRegressionAnalysis(
      candidateVersion,
      baselineVersion,
      Number.isFinite(perDomain) ? Math.max(20, Math.min(perDomain, 200)) : 75,
    )

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
