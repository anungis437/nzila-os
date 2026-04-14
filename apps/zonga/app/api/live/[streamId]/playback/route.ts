/**
 * API — /api/live/[streamId]/playback
 *
 * GET → Get playback URL for a viewer.
 *       Entitlement check is performed here before granting playback.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { logger } from '@/lib/logger'
import {
  getViewerPlayback,
  denyViewerPlayback,
} from '@/features/media/live-streaming-service'
import { getListenerPlan } from '@/lib/guards/plan-queries'

interface RouteParams {
  params: Promise<{ streamId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { streamId } = await params

  return withOrgScope(request, (ctx) =>
    withSpan('zonga.live.playback.get', { 'stream.id': streamId }, async () => {
      // Check entitlement: live streams require at least a free plan (authenticated user)
      // Premium features (e.g., DVR, multi-angle) would be gated here
      const planInfo = await getListenerPlan(ctx.userId, ctx.orgId)
      if (!planInfo) {
        await denyViewerPlayback(streamId, ctx.orgId, ctx.userId, 'no_plan')
        return NextResponse.json(
          { ok: false, error: 'Subscription required for live streams' },
          { status: 403 },
        )
      }

      const grant = await getViewerPlayback(streamId, ctx.orgId, ctx.userId)

      if (!grant.ok) {
        logger.info('Live playback denied', {
          streamId,
          userId: ctx.userId,
          reason: grant.error,
          status: grant.status,
        })
        return NextResponse.json(
          {
            ok: false,
            error: grant.error,
            status: grant.status,
          },
          { status: grant.status === 'scheduled' ? 425 : 404 },
        )
      }

      return NextResponse.json({
        ok: true,
        data: {
          playbackUrl: grant.playbackUrl,
          status: grant.status,
        },
      })
    }),
  )
}
