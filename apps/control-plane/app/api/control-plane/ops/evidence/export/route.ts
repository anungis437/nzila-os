import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { exportSealedEvidence, createDailyEvidenceSnapshot } from '@/server/operating-evidence-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const days = Number(request.nextUrl.searchParams.get('days') ?? 30)
    const data = await exportSealedEvidence(Number.isFinite(days) ? Math.max(1, Math.min(days, 365)) : 30)
    const snapshot = await createDailyEvidenceSnapshot()
    return NextResponse.json({ ok: true, data: { ...data, dailySnapshot: snapshot } })
  } catch (error) {
    return handleAuthError(error)
  }
}
