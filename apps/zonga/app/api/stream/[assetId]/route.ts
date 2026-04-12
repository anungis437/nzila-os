/**
 * API — /api/stream/[assetId]
 *
 * GET  → Generate a signed streaming URL using zonga-streaming delivery.
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
  trackPlaybackProgress,
} from '@nzila/zonga-streaming'
import { createPlayEvent } from '@nzila/zonga-analytics'

interface RouteParams {
  params: Promise<{ assetId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { assetId } = await params

  return withOrgScope(request, (ctx) =>
    withSpan('zonga.stream.get', { 'http.method': 'GET', 'asset.id': assetId }, async () => {
      const url = new URL(request.url)
      const requestedQuality = url.searchParams.get('quality') as AudioQuality | null

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

      const optimalQuality = selectOptimalQuality({
        requestedBitrate: requestedQuality ? (AUDIO_QUALITY[requestedQuality]?.bitrate ?? 128) : undefined,
        networkSpeedKbps: undefined,  // Client should pass via header in future
        isPremium,
        maxBitrateCap: AUDIO_QUALITY[bestQuality].bitrate,
      })

      // 3. Generate CDN-signed stream URL
      const blobPath = asset.storage_url.replace('blob://', '')
      const streamUrl = resolveStreamUrl({
        blobPath,
        cdnBase: process.env.CDN_BASE_URL ?? '/api/blob',
        quality: optimalQuality.selectedBitrate.toString(),
      })

      const signedUrl = computeCdnSignedUrl({
        rawUrl: streamUrl,
        secret: process.env.CDN_SIGNING_SECRET ?? 'dev-secret',
        expiresInSeconds: 3600,
      })

      // 4. Create a playback session for tracking
      const session = createPlaybackSession({
        trackId: assetId,
        userId: ctx.userId,
        quality: optimalQuality.selectedBitrate,
        durationMs: asset.duration_ms ?? 0,
      })

      // 5. Emit analytics event
      const playEvent = createPlayEvent({
        userId: ctx.userId,
        trackId: assetId,
        artistId: asset.creator_id,
        durationMs: asset.duration_ms ?? 0,
        listenedMs: 0, // Will be updated via progress tracking
        quality: bestQuality,
        source: 'api',
      })

      // Fire-and-forget persisting the play event
      platformDb.execute(sql`
        INSERT INTO zonga_analytics_events (event_type, user_id, payload, created_at)
        VALUES (${playEvent.type}, ${ctx.userId}, ${JSON.stringify(playEvent)}::jsonb, ${playEvent.timestamp}::timestamptz)
      `).catch((err) => logger.error('Failed to persist play event', { err }))

      logger.info('Stream granted', {
        assetId,
        userId: ctx.userId,
        quality: optimalQuality.selectedBitrate,
        sessionId: session.sessionId,
      })

      return NextResponse.json({
        ok: true,
        data: {
          streamUrl: signedUrl,
          quality: optimalQuality.selectedBitrate,
          codec: optimalQuality.codec ?? 'aac',
          sessionId: session.sessionId,
          durationMs: asset.duration_ms,
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        },
      })
    }),
  )
}
