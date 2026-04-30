import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getCommercialMetricsDashboard } from '@/server/commercial-metrics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const days = Number(request.nextUrl.searchParams.get('days') ?? 90)
    const data = await getCommercialMetricsDashboard(Number.isFinite(days) ? Math.max(1, Math.min(days, 365)) : 90)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
