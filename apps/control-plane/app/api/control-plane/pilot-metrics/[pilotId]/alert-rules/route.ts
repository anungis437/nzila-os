import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getPilotAlertRules, savePilotAlertRule } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })

    const data = await getPilotAlertRules(orgId, pilotId)
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
    const { orgId, ...rule } = body as {
      orgId?: string
      metricName: string
      ruleType: 'threshold' | 'rate' | 'anomaly' | 'inactivity'
      operator: '>' | '<' | 'delta' | 'ratio'
      thresholdValue: number
      windowMinutes: number
      severity: 'info' | 'warning' | 'critical'
      enabled: boolean
      cooldownMinutes: number
      playbookKey?: string | null
    }

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })

    const data = await savePilotAlertRule(orgId, pilotId, rule)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
