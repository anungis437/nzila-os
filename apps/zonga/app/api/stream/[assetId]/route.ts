/**
 * API — /api/stream/[assetId]
 *
 * GET  → Generate a signed streaming URL.
 *        Resolution order: CloudFront-backed → blob-backed → raw fallback.
 *        Quality is gated by the listener's subscription plan.
 *        Emits a play analytics event on successful stream grant.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getListenerPlan } from '@/lib/guards/plan-queries'
import { maxAudioQuality } from '@/lib/guards/subscription-guards'
import { AUDIO_QUALITY, type AudioQuality } from '@/lib/plans'
import {
  selectOptimalQuality,
  resolveStreamUrl,
  computeCdnSignedUrl,
  createPlaybackSession,
  type TranscodeQuality,
  type CdnConfig,
} from '@nzila/zonga-streaming'
import { createPlayEvent } from '@nzila/zonga-analytics'
import { getPlaybackUrl } from '@/features/media/playback-service'
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

      // 1. Look up the asset to ensure it exists and is published
      const [asset] = (await platformDb.execute(
        sql`SELECT id, title, storage_url, duration_ms, creator_id
        FROM zonga_content_assets
        WHERE id = ${assetId} AND status = 'published'`,
      )) as unknown as [{ id: string; title: string; storage_url: string | null; duration_ms: number | null; creator_id: string } | undefined]

      if (!asset?.storage_url) {
        return NextResponse.json({ ok: false, error: 'Asset not found or not published' }, { status: 404 })
      }

      // 2. Resolve quality based on listener plan
      const planInfo = await getListenerPlan(ctx.userId, ctx.orgId)
      const bestQuality = maxAudioQuality(planInfo.plan)
      const isPremium = planInfo.plan !== 'free'

      // ── Provider-aware playback (CloudFront → blob → raw) ──
      const qualityMap: Record<string, QualityTier> = {
        low: 'preview',
        standard: 'standard',
        high: 'high',
        lossless: 'hifi',
      }
      const gatedQuality = qualityMap[bestQuality] ?? 'standard'
      const playback = await getPlaybackUrl(assetId, gatedQuality, gatedQuality)

      if (playback.ok && playback.streamUrl) {
        // Create a playback session for tracking
        const session = createPlaybackSession(
          assetId,
          asset.duration_ms ?? 0,
          ctx.userId,
          bestQuality,
        )

        // Emit analytics event (fire-and-forget)
        const playEvent = createPlayEvent(ctx.orgId, ctx.userId, {
          assetId,
          creatorId: asset.creator_id,
          durationMs: asset.duration_ms ?? 0,
          positionMs: 0,
          completionPercent: 0,
          quality: bestQuality,
          isComplete: false,
          source: 'direct',
        })
        platformDb.execute(sql`
          INSERT INTO zonga_analytics_events (event_type, user_id, payload, created_at)
          VALUES (${playEvent.type}, ${ctx.userId}, ${JSON.stringify(playEvent)}::jsonb, ${playEvent.timestamp}::timestamptz)
        `).catch((err) => logger.error('Failed to persist play event', { err }))

        logger.info('Stream granted', {
          assetId,
          userId: ctx.userId,
          quality: playback.bitrate,
          provider: playback.provider,
          sessionId: session.id,
        })

        return NextResponse.json({
          ok: true,
          data: {
            streamUrl: playback.streamUrl,
            quality: playback.bitrate,
            codec: playback.codec,
            sessionId: session.id,
            durationMs: asset.duration_ms,
            provider: playback.provider,
            expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
          },
        })
      }

      // ── Legacy fallback: zonga-streaming package CDN signing ──
      const allQualities = [
        { label: 'low', bitrate: 64, sampleRate: 22050, codec: 'aac' as const, container: 'mp4' as const, segmentDurationSec: 6 },
        { label: 'standard', bitrate: 128, sampleRate: 44100, codec: 'aac' as const, container: 'mp4' as const, segmentDurationSec: 6 },
        { label: 'high', bitrate: 256, sampleRate: 48000, codec: 'aac' as const, container: 'mp4' as const, segmentDurationSec: 4 },
        { label: 'lossless', bitrate: 1411, sampleRate: 96000, codec: 'opus' as const, container: 'webm' as const, segmentDurationSec: 4 },
      ] satisfies TranscodeQuality[]
      const availableQualities = allQualities.filter((q) => q.bitrate <= (AUDIO_QUALITY[bestQuality]?.bitrate ?? 128))

      const deliveryCtx = {
        assetId,
        listenerId: ctx.userId,
        plan: isPremium ? 'premium' as const : 'free' as const,
        networkType: 'wifi' as const,
        deviceType: 'desktop' as const,
        lowDataMode: false,
      }

      const optimalQuality = selectOptimalQuality(deliveryCtx, availableQualities)

      // 3. Generate CDN-signed stream URL
      const cdn: CdnConfig = {
        baseUrl: process.env.CDN_BASE_URL ?? '/api/blob',
        signingSecret: process.env.CDN_SIGNING_SECRET ?? 'dev-secret',
        tokenTtlSec: 3600,
      }

      const streamResult = resolveStreamUrl(assetId, deliveryCtx, availableQualities, cdn)
      const signed = computeCdnSignedUrl(streamResult.url, cdn)

      // 4. Create a playback session for tracking
      const session = createPlaybackSession(
        assetId,
        asset.duration_ms ?? 0,
        ctx.userId,
        optimalQuality.label,
      )

      // 5. Emit analytics event
      const playEvent = createPlayEvent(ctx.orgId, ctx.userId, {
        assetId,
        creatorId: asset.creator_id,
        durationMs: asset.duration_ms ?? 0,
        positionMs: 0,
        completionPercent: 0,
        quality: bestQuality,
        isComplete: false,
        source: 'direct',
      })

      // Fire-and-forget persisting the play event
      platformDb.execute(sql`
        INSERT INTO zonga_analytics_events (event_type, user_id, payload, created_at)
        VALUES (${playEvent.type}, ${ctx.userId}, ${JSON.stringify(playEvent)}::jsonb, ${playEvent.timestamp}::timestamptz)
      `).catch((err) => logger.error('Failed to persist play event', { err }))

      logger.info('Stream granted', {
        assetId,
        userId: ctx.userId,
        quality: optimalQuality.bitrate,
        sessionId: session.id,
      })

      return NextResponse.json({
        ok: true,
        data: {
          streamUrl: signed.token ? `${streamResult.url}?token=${signed.token}` : streamResult.url,
          quality: optimalQuality.bitrate,
          codec: optimalQuality.codec,
          sessionId: session.id,
          durationMs: asset.duration_ms,
          expiresAt: new Date(signed.expiresAt).toISOString(),
        },
      })
    }),
  )
}
