import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { createDailyEvidenceSnapshot, getOperatingEvidenceDashboard } from '@/server/operating-evidence-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const days = Number(request.nextUrl.searchParams.get('days') ?? 90)
    await createDailyEvidenceSnapshot()
    const dashboard = await getOperatingEvidenceDashboard(Number.isFinite(days) ? Math.max(1, Math.min(days, 365)) : 90)
    return NextResponse.json({
      ok: true,
      data: {
        history: dashboard.integrityHistory,
        driftDays: dashboard.integrityHistory.filter((entry) => entry.driftDetected).length,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
