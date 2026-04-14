import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { acknowledgePilotAlert, escalatePilotAlert, getPilotDetail, resolvePilotAlert } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')
    const severity = url.searchParams.getAll('severity').filter(Boolean) as Array<'info' | 'warning' | 'critical'>
    const status = url.searchParams.getAll('status').filter(Boolean) as Array<'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved'>

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })

    const detail = await getPilotDetail(orgId, pilotId)
    const data = detail.alerts.filter((alert) => {
      if (severity.length > 0 && !severity.includes(alert.severity)) return false
      if (status.length > 0 && !status.includes(alert.status)) return false
      return true
    })

    return NextResponse.json({ ok: true, data, noData: data.length === 0 })
  } catch (error) {
    return handleAuthError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const contentType = request.headers.get('content-type') ?? ''
    let payload: Record<string, unknown>
    if (contentType.includes('application/json')) {
      payload = await request.json() as Record<string, unknown>
    } else {
      const form = await request.formData()
      payload = Object.fromEntries(form.entries())
    }

    const { orgId, alertId, action, resolutionNotes } = payload as {
      orgId?: string
      alertId?: string
      action?: 'acknowledge' | 'resolve' | 'escalate'
      resolutionNotes?: string
    }

    if (!orgId || !alertId || !action) {
      return NextResponse.json({ ok: false, error: 'orgId, alertId and action are required' }, { status: 400 })
    }

    const traceId = request.headers.get('x-trace-id') ?? crypto.randomUUID()
    const actorId = request.headers.get('x-actor-id') ?? 'system:control-plane-alerts'

    const data = action === 'acknowledge'
      ? await acknowledgePilotAlert(orgId, pilotId, alertId, actorId, traceId)
      : action === 'resolve'
        ? await resolvePilotAlert(orgId, pilotId, alertId, actorId, traceId, resolutionNotes)
        : await escalatePilotAlert(orgId, pilotId, alertId, actorId, traceId)

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
