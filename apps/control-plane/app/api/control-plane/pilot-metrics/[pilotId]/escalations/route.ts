import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getPilotAlertEscalations, savePilotAlertEscalation } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })

    const data = await getPilotAlertEscalations(orgId, pilotId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const body = await request.json()
    const { orgId, ...escalation } = body as {
      orgId?: string
      severity: 'info' | 'warning' | 'critical'
      notifyAfterMinutes: number
      escalationChannel: 'email' | 'webhook' | 'slack' | 'sms'
      escalationTarget: string
    }

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })

    const data = await savePilotAlertEscalation(orgId, pilotId, escalation)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
