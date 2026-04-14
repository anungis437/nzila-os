import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getPilotDetail, patchPilot } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })
    }

    const data = await getPilotDetail(orgId, pilotId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const body = await request.json()
    const { orgId, ...patch } = body as {
      orgId?: string
      pilotName?: string
      status?: 'planned' | 'onboarding' | 'active' | 'paused' | 'completed'
      targetEndAt?: string | null
      ownerUserId?: string | null
      metadataJson?: Record<string, unknown>
    }

    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })
    }

    const data = await patchPilot(orgId, pilotId, patch)
    if (!data) {
      return NextResponse.json({ ok: false, error: 'Pilot not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
