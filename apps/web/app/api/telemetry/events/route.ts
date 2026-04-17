import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { validateEventPayload, type EventPayload } from '@/lib/telemetry-events'

export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get('content-length') ?? '0')
    if (contentLength > 16 * 1024) {
      return NextResponse.json({ ok: false, error: 'payload_too_large' }, { status: 413 })
    }

    const raw = await req.json()
    const payload = validateEventPayload(raw) as EventPayload

    logger.info('marketing.event', {
      event: payload.event,
      page: payload.page ?? 'unknown',
      ts: payload.ts ?? new Date().toISOString(),
      properties: payload.properties ?? {},
    })

    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'invalid_payload', details: error.flatten() }, { status: 400 })
    }
    logger.error('marketing.event.error', {
      // Preserve redaction while still exposing useful diagnostics in server logs.
      message: error instanceof Error ? error.message : 'unknown-error',
    })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
