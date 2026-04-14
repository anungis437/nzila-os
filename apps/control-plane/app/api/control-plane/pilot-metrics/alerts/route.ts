import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getAlertInbox } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireApiAuth(request)
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')
    const severity = url.searchParams.getAll('severity').filter(Boolean) as Array<'info' | 'warning' | 'critical'>
    const status = url.searchParams.getAll('status').filter(Boolean) as Array<'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved'>
    const activeIncidentsOnly = url.searchParams.get('activeIncidentsOnly') === 'true'

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })

    const data = await getAlertInbox(orgId, { severity, status, activeIncidentsOnly })
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}
