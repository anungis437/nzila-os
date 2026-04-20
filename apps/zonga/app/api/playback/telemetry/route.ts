import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'

const PlaybackTelemetrySchema = z.object({
  eventName: z.enum(['play_start_latency', 'buffer_event', 'completion', 'skip', 'device_browser_failure']),
  payload: z.record(z.unknown()),
})

export async function POST(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.playback.telemetry.post', { 'http.method': 'POST' }, async () => {
      const body = await request.json().catch(() => null)
      const parsed = PlaybackTelemetrySchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Invalid telemetry payload' }, { status: 400 })
      }

      const nowIso = new Date().toISOString()
      await platformDb.execute(sql`
        INSERT INTO zonga_analytics_events (event_type, user_id, payload, created_at)
        VALUES (
          ${`playback_${parsed.data.eventName}`},
          ${ctx.userId},
          ${JSON.stringify({
            ...parsed.data.payload,
            orgId: ctx.orgId,
            eventName: parsed.data.eventName,
            occurredAt: nowIso,
          })}::jsonb,
          ${nowIso}::timestamptz
        )
      `)

      return NextResponse.json({ ok: true })
    }),
  )
}
