/**
 * API — /api/live
 *
 * POST → Create a new live stream for an event.
 *        Provisions AWS IVS channel and returns ingest details.
 *
 * GET  → List live streams for the org (optionally filtered by status).
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import {
  createLiveStream,
  listLiveStreams,
  getIngestDetails,
} from '@/features/media/live-streaming-service'
import type { LiveStreamStatus } from '@nzila/zonga-streaming-aws'

const createSchema = z.object({
  eventId: z.string().uuid(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.live.create', { 'http.method': 'POST' }, async () => {
      const body = await request.json()
      const parsed = createSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: 'Invalid input', details: parsed.error.flatten() },
          { status: 400 },
        )
      }

      try {
        const stream = await createLiveStream({
          orgId: ctx.orgId,
          eventId: parsed.data.eventId,
          creatorId: ctx.userId,
          scheduledStart: parsed.data.scheduledStart,
          scheduledEnd: parsed.data.scheduledEnd,
          metadata: parsed.data.metadata,
        })

        // Return ingest details for the creator
        const ingest = await getIngestDetails(stream.id, ctx.orgId, ctx.userId)

        logger.info('Live stream created via API', {
          streamId: stream.id,
          eventId: parsed.data.eventId,
        })

        return NextResponse.json({
          ok: true,
          data: {
            stream,
            ingest,
          },
        })
      } catch (err) {
        logger.error('Failed to create live stream', { err })
        return NextResponse.json(
          { ok: false, error: 'Failed to create live stream' },
          { status: 500 },
        )
      }
    }),
  )
}

export async function GET(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.live.list', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const statusParam = url.searchParams.get('status')
      const statusFilter = statusParam
        ? (statusParam.split(',') as LiveStreamStatus[])
        : undefined

      const streams = await listLiveStreams(ctx.orgId, statusFilter)

      return NextResponse.json({ ok: true, data: streams })
    }),
  )
}
