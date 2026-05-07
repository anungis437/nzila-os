import { NextRequest, NextResponse } from 'next/server'
import { buildPlatformEvent } from '@nzila/platform-event-fabric'
import { withNzilaSpan } from '@nzila/otel-core'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('trustcore:api:analytics')

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: Record<string, unknown>

  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const orgId = getString(payload.orgId, 'trustcore-public')

  return withNzilaSpan('trustcore.analytics.ingest', orgId, async () => {
    const event = buildPlatformEvent({
      type: `trustcore.analytics.${getString(payload.event, 'unknown')}`,
      payload,
      tenantId: orgId,
      orgId,
      actorId: getString(payload.actorId, 'anonymous'),
      source: '@nzila/trustcore',
      correlationId: request.headers.get('x-request-id') ?? undefined,
    })

    logger.info('[trustcore analytics] event received', { type: event.type, orgId })

    return NextResponse.json({ ok: true })
  })
}