/**
 * API — /api/live/[streamId]
 *
 * GET    → Get stream status (real-time from provider if live/ready).
 * PATCH  → Update stream lifecycle (ready/live/end/fail).
 * DELETE → End and clean up a live stream.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import {
  getLiveStream,
  getStreamStatus,
  markStreamReady,
  markStreamLive,
  endLiveStream,
  markStreamFailed,
} from '@/features/media/live-streaming-service'

interface RouteParams {
  params: Promise<{ streamId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { streamId } = await params

  return withOrgScope(request, (ctx) =>
    withSpan('zonga.live.status', { 'stream.id': streamId }, async () => {
      const status = await getStreamStatus(streamId, ctx.orgId)
      if (!status) {
        return NextResponse.json({ ok: false, error: 'Stream not found' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, data: status })
    }),
  )
}

const patchSchema = z.object({
  action: z.enum(['ready', 'live', 'end', 'fail']),
  reason: z.string().optional(),
})

export async function PATCH(request: Request, { params }: RouteParams) {
  const { streamId } = await params

  return withOrgScope(request, (ctx) =>
    withSpan('zonga.live.update', { 'stream.id': streamId }, async () => {
      const body = await request.json()
      const parsed = patchSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: 'Invalid input', details: parsed.error.flatten() },
          { status: 400 },
        )
      }

      const stream = await getLiveStream(streamId, ctx.orgId)
      if (!stream) {
        return NextResponse.json({ ok: false, error: 'Stream not found' }, { status: 404 })
      }

      try {
        switch (parsed.data.action) {
          case 'ready':
            await markStreamReady(streamId, ctx.orgId)
            break
          case 'live':
            await markStreamLive(streamId, ctx.orgId)
            break
          case 'end':
            await endLiveStream(streamId, ctx.orgId)
            break
          case 'fail':
            await markStreamFailed(streamId, ctx.orgId, parsed.data.reason ?? 'Unknown failure')
            break
        }

        const updated = await getLiveStream(streamId, ctx.orgId)
        logger.info('Stream lifecycle updated', {
          streamId,
          action: parsed.data.action,
        })

        return NextResponse.json({ ok: true, data: updated })
      } catch (err) {
        logger.error('Failed to update stream', { err, streamId })
        return NextResponse.json(
          { ok: false, error: 'Failed to update stream' },
          { status: 500 },
        )
      }
    }),
  )
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { streamId } = await params

  return withOrgScope(request, (ctx) =>
    withSpan('zonga.live.delete', { 'stream.id': streamId }, async () => {
      const stream = await getLiveStream(streamId, ctx.orgId)
      if (!stream) {
        return NextResponse.json({ ok: false, error: 'Stream not found' }, { status: 404 })
      }

      try {
        await endLiveStream(streamId, ctx.orgId)
        return NextResponse.json({ ok: true })
      } catch (err) {
        logger.error('Failed to delete stream', { err, streamId })
        return NextResponse.json(
          { ok: false, error: 'Failed to end stream' },
          { status: 500 },
        )
      }
    }),
  )
}
