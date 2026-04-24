import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { demoArtists, demoEvents } from '@/lib/demo-data'
import { COMMERCIAL_ANALYTICS_EVENTS, PlatformEventBus, emitLeadCreated } from '@nzila/platform-events'

const bus = new PlatformEventBus()

export async function POST(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.demo.seed', { 'http.method': 'POST' }, async () => {
      if (process.env.NODE_ENV === 'production' && process.env.ZONGA_ALLOW_DEMO_SEED !== 'true') {
        return NextResponse.json({ ok: false, error: 'Demo seed disabled in production.' }, { status: 403 })
      }

      void bus.emit(
        emitLeadCreated(
          {
            leadId: crypto.randomUUID(),
            email: 'demo@zonga.local',
            source: COMMERCIAL_ANALYTICS_EVENTS.ZONGA_DEMO_SEEDED,
            appId: 'zonga',
            company: 'Zonga Demo',
            inquiryType: 'demo-seed',
          },
          { orgId: ctx.orgId, actorId: ctx.userId, source: COMMERCIAL_ANALYTICS_EVENTS.ZONGA_DEMO_SEEDED },
        ),
      )

      return NextResponse.json({
        ok: true,
        seeded: {
          artists: demoArtists.length,
          events: demoEvents.length,
        },
      })
    }),
  )
}
