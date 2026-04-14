import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { recomputePilotHealth } from '@/server/pilot-metrics-data'
import { getPilotHealthScore } from '@nzila/platform-pilot-metrics/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })

    const recompute = url.searchParams.get('recompute') === 'true'
    const data = recompute
      ? await recomputePilotHealth(orgId, pilotId)
      : await getPilotHealthScore(orgId, pilotId)

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
