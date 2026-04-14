/**
 * API — /api/live/[streamId]/ingest
 *
 * GET  → Get ingest details for the creator (RTMP URL + stream key).
 * POST → Rotate stream key and get new ingest credentials.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { logger } from '@/lib/logger'
import {
  getIngestDetails,
  rotateCreatorCredentials,
} from '@/features/media/live-streaming-service'

interface RouteParams {
  params: Promise<{ streamId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { streamId } = await params

  return withOrgScope(request, (ctx) =>
    withSpan('zonga.live.ingest.get', { 'stream.id': streamId }, async () => {
      const ingest = await getIngestDetails(streamId, ctx.orgId, ctx.userId)
      if (!ingest) {
        return NextResponse.json(
          { ok: false, error: 'Ingest details not available or unauthorized' },
          { status: 404 },
        )
      }
      return NextResponse.json({ ok: true, data: ingest })
    }),
  )
}

export async function POST(request: Request, { params }: RouteParams) {
  const { streamId } = await params

  return withOrgScope(request, (ctx) =>
    withSpan('zonga.live.ingest.rotate', { 'stream.id': streamId }, async () => {
      try {
        const ingest = await rotateCreatorCredentials(streamId, ctx.orgId, ctx.userId)
        if (!ingest) {
          return NextResponse.json(
            { ok: false, error: 'Unable to rotate credentials or unauthorized' },
            { status: 404 },
          )
        }

        logger.info('Stream key rotated', { streamId, userId: ctx.userId })

        return NextResponse.json({ ok: true, data: ingest })
      } catch (err) {
        logger.error('Failed to rotate stream key', { err, streamId })
        return NextResponse.json(
          { ok: false, error: 'Failed to rotate credentials' },
          { status: 500 },
        )
      }
    }),
  )
}
