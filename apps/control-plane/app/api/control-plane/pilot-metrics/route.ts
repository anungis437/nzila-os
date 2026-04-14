import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { createPilot, listPilotMetricsPilots } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireApiAuth(request)
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })
    }

    const data = await listPilotMetricsPilots(orgId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireApiAuth(request)
    const body = await request.json()
    const {
      orgId,
      appScope,
      pilotName,
      pilotType,
      status,
      startedAt,
      targetEndAt,
      ownerUserId,
      metadataJson,
    } = body as {
      orgId?: string
      appScope?: 'union-eyes' | 'zonga' | 'flow' | 'control-plane' | 'platform'
      pilotName?: string
      pilotType?: 'enterprise-workflow' | 'event-creator' | 'internal' | 'enterprise'
      status?: 'planned' | 'onboarding' | 'active' | 'paused' | 'completed'
      startedAt?: string | null
      targetEndAt?: string | null
      ownerUserId?: string | null
      metadataJson?: Record<string, unknown>
    }

    if (!orgId || !appScope || !pilotName || !pilotType) {
      return NextResponse.json(
        { ok: false, error: 'orgId, appScope, pilotName, pilotType are required' },
        { status: 400 },
      )
    }

    const created = await createPilot(orgId, {
      appScope,
      pilotName,
      pilotType,
      status,
      startedAt: startedAt ?? null,
      targetEndAt: targetEndAt ?? null,
      ownerUserId: ownerUserId ?? null,
      metadataJson: metadataJson ?? {},
    })

    return NextResponse.json({ ok: true, data: created }, { status: 201 })
  } catch (error) {
    return handleAuthError(error)
  }
}
