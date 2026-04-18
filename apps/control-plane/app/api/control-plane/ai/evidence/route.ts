import { NextResponse, type NextRequest } from 'next/server'

import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getAiGovernanceEvidenceSummary } from '@/server/ai-governance-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const params = request.nextUrl.searchParams
    const daysParam = Number(params.get('days') ?? '30')
    const days = Number.isFinite(daysParam) ? Math.min(365, Math.max(7, Math.trunc(daysParam))) : 30

    const evidence = await getAiGovernanceEvidenceSummary(days)
    return NextResponse.json({
      ok: true,
      data: evidence,
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
