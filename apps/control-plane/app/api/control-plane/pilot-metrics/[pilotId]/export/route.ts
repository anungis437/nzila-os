import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { exportPilot } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ pilotId: string }> }) {
  try {
    await requireApiAuth(request)
    const { pilotId } = await params
    const url = new URL(request.url)
    const orgId = url.searchParams.get('orgId')
    const format = (url.searchParams.get('format') ?? 'json') as 'json' | 'csv' | 'markdown'

    if (!orgId) return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })
    if (!['json', 'csv', 'markdown'].includes(format)) {
      return NextResponse.json({ ok: false, error: 'format must be json|csv|markdown' }, { status: 400 })
    }

    const report = await exportPilot(orgId, pilotId, format)
    return new NextResponse(report.body, {
      status: 200,
      headers: {
        'Content-Type': report.contentType,
        'Content-Disposition': `attachment; filename=${report.fileName}`,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
