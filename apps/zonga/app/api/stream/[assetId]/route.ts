/**
 * API — /api/stream/[assetId]
 *
 * GET → Generate a provider-backed signed streaming URL.
 *       Single-path provider behavior for deterministic streaming.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getListenerPlan } from '@/lib/guards/plan-queries'
import { maxAudioQuality, isListenerPremium } from '@/lib/guards/subscription-guards'
import { type AudioQuality } from '@/lib/plans'
import { createPlaybackSession } from '@nzila/zonga-streaming'
import { createPlayEvent } from '@nzila/zonga-analytics'
import { getPlaybackUrl } from '@/features/media/playback-service'
import { recordZongaReplayView, recordZongaStreamStart } from '@/lib/pilot-metrics'
import type { QualityTier } from '@/features/media/types'

interface RouteParams {
  params: Promise<{ assetId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { assetId } = await params

  return withOrgScope(request, (ctx) =>
    withSpan('zonga.stream.get', { 'http.method': 'GET', 'asset.id': assetId }, async () => {
      const url = new URL(request.url)
      const _requestedQuality = url.searchParams.get('quality') as AudioQuality | null

      const [asset] = (await platformDb.execute(
        sql`SELECT id, title, storage_url, (duration_seconds::bigint*1000) AS duration_ms, creator_id
            FROM zonga_content_assets
            WHERE id = ${assetId} AND status = 'published'`,
      )) as unknown as [
        | {
            id: string
            title: string
            storage_url: string | null
            duration_ms: number | string | bigint | null
            creator_id: string
          }
        | undefined,
      ]

      if (!asset?.storage_url) {
        return NextResponse.json(
          { ok: false, error: 'Asset not found or not published' },
          { status: 404 },
        )
      }

      // PostgreSQL bigint drivers may return text. The public/player boundary
      // requires milliseconds as a safe number, never a mislabeled seconds value.
      const durationMs = Number(asset.duration_ms ?? 0)
      if (!Number.isSafeInteger(durationMs) || durationMs < 0)
        return NextResponse.json(
          { ok: false, error: 'Source audio duration is invalid' },
          { status: 503 },
        )

      const planInfo = await getListenerPlan(ctx.userId, null)
      const bestQuality = maxAudioQuality(
        isListenerPremium(planInfo.plan, planInfo.subscriptionStatus) ? 'premium' : 'free',
      )

      const qualityMap: Record<string, QualityTier> = {
        low: 'preview',
        standard: 'standard',
        hifi: 'hifi',
        high: 'high',
        lossless: 'hifi',
      }
      const gatedQuality = qualityMap[bestQuality] ?? 'standard'
      const playback = await getPlaybackUrl(assetId, gatedQuality, gatedQuality)

      if (!playback.ok || !playback.streamUrl) {
        logger.warn('Provider-backed playback unavailable', {
          assetId,
          orgId: ctx.orgId,
          userId: ctx.userId,
          reason: playback.error ?? 'provider_playback_failed',
        })

        return NextResponse.json(
          {
            ok: false,
            error: 'Provider playback unavailable',
            code: 'STREAM_PROVIDER_UNAVAILABLE',
            details: playback.error ?? 'provider_playback_failed',
          },
          { status: 503 },
        )
      }

      const freshPlan = await getListenerPlan(ctx.userId, null)
      const freshQuality = maxAudioQuality(
        isListenerPremium(freshPlan.plan, freshPlan.subscriptionStatus) ? 'premium' : 'free',
      )
      if (bestQuality === 'hifi' && freshQuality !== 'hifi')
        return NextResponse.json(
          { ok: false, error: 'Subscription changed; request playback again' },
          { status: 403 },
        )

      const session = createPlaybackSession(assetId, durationMs, ctx.userId, bestQuality)

      const playEvent = createPlayEvent(ctx.orgId, ctx.userId, {
        assetId,
        creatorId: asset.creator_id,
        durationMs,
        positionMs: 0,
        completionPercent: 0,
        quality: bestQuality,
        isComplete: false,
        source: 'direct',
      })

      platformDb
        .execute(
          sql`
        INSERT INTO zonga_analytics_events (event_type, user_id, payload, created_at)
        VALUES (${playEvent.type}, ${ctx.userId}, ${JSON.stringify(playEvent)}::jsonb, ${playEvent.timestamp}::timestamptz)
      `,
        )
        .catch((err) => logger.error('Failed to persist play event', { err }))

      logger.info('Stream granted', {
        assetId,
        userId: ctx.userId,
        quality: playback.bitrate,
        provider: playback.provider,
        sessionId: session.id,
      })

      recordZongaStreamStart(ctx.orgId, assetId, ctx.userId, playEvent.id).catch((metricErr) =>
        logger.warn('Pilot metric emit failed', {
          error: String(metricErr),
          metric: 'stream_starts',
        }),
      )

      const isReplay =
        url.searchParams.get('mode') === 'replay' || url.searchParams.get('replay') === '1'
      if (isReplay) {
        recordZongaReplayView(ctx.orgId, assetId, ctx.userId, playEvent.id).catch((metricErr) =>
          logger.warn('Pilot metric emit failed', {
            error: String(metricErr),
            metric: 'replay_views',
          }),
        )
      }

      return NextResponse.json({
        ok: true,
        data: {
          streamUrl: playback.streamUrl,
          quality: playback.bitrate,
          codec: playback.codec,
          sessionId: session.id,
          durationMs,
          provider: playback.provider,
          expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        },
      })
    }),
  )
}
