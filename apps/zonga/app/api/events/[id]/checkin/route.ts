import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { checkInTicket, getCheckInStats, manualCheckInTicket } from '@/features/events/checkin-service'

const checkinSchema = z.object({
  qrToken: z.string().min(10),
})

const manualCheckinSchema = z.object({
  ticketId: z.string().min(8),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRequestContext(request, () =>
    withSpan('api.events.checkin.stats', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const { id } = await params
      const stats = await getCheckInStats(id)

      return NextResponse.json({ ok: true, data: stats })
    }),
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRequestContext(request, () =>
    withSpan('api.events.checkin.scan', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const payload = await request.json()

      const qrBody = checkinSchema.safeParse(payload)
      const manualBody = manualCheckinSchema.safeParse(payload)
      if (!qrBody.success && !manualBody.success) {
        return NextResponse.json(
          { ok: false, error: 'Invalid check-in payload' },
          { status: 400 },
        )
      }

      const { id } = await params
      const result = qrBody.success
        ? await checkInTicket({
            eventId: id,
            qrToken: qrBody.data.qrToken,
            scannedBy: auth.userId,
          })
        : manualBody.success
          ? await manualCheckInTicket({
              eventId: id,
              ticketId: manualBody.data.ticketId,
              scannedBy: auth.userId,
            })
          : { ok: false, message: 'Invalid manual check-in payload' }

      const status = result.ok ? 200 : 409
      return NextResponse.json({ ok: result.ok, data: result }, { status })
    }),
  )
}
