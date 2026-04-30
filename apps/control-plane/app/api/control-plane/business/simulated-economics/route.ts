import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getSimulatedEconomics } from '@/server/simulated-economics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const days = Number(request.nextUrl.searchParams.get('days') ?? 120)
    const data = await getSimulatedEconomics(Number.isFinite(days) ? Math.max(30, Math.min(days, 365)) : 120)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
