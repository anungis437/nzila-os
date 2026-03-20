/**
 * API — /api/events/[id]
 * GET → event detail with tickets
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { getEventDetail } from '@/lib/actions/event-actions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRequestContext(request, () =>
    withSpan('api.events.detail', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const { id } = await params
      const data = await getEventDetail(id)

      if (!data.event) {
        return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
      }

      return NextResponse.json({ ok: true, data })
    }),
  )
}
