import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getPilotMetrics } from '@nzila/platform-pilot-metrics/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })

    const data = await getPilotMetrics(orgId, pilotId)
    return NextResponse.json({ ok: true, data, noData: data.length === 0 })
  } catch (error) {
    return handleAuthError(error)
  }
}
