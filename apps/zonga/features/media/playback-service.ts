/**
 * Zonga — Playback Service
 *
 * Generates streaming URLs from processed variants,
 * records playback telemetry, and handles fallback logic.
 *
 * Resolution order:
 * 1. CloudFront-backed media variants (zonga_media_variants, provider=aws)
 * 2. Blob-backed processed variants (zonga_processed_variants, legacy path)
 * 3. Raw upload fallback (zonga_track_assets)
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { generateSasUrl } from '@nzila/blob'
import { logger } from '@/lib/logger'
import { cloudFrontBreaker, resilientAwsCall } from './resilience'
import type { QualityTier, PlaybackSource } from './types'
import { PROCESSING_PROFILES } from './types'
import { getBestMediaVariant } from './media-job-service'

// ── Quality tier ordering for entitlement enforcement ────────────────────────

const QUALITY_RANK: Record<QualityTier, number> = {
  preview: 0,
  free: 1,
  standard: 2,
  high: 3,
  premium: 4,
  hifi: 5,
}

/**
 * Clamp a requested quality tier to the maximum allowed by entitlement.
 * Defense-in-depth: even if the caller passes a higher-than-allowed quality,
 * the service enforces the ceiling.
 */
function clampQuality(requested: QualityTier, maxAllowed?: QualityTier): QualityTier {
  if (!maxAllowed) return requested
  return (QUALITY_RANK[requested] ?? 0) <= (QUALITY_RANK[maxAllowed] ?? 0)
    ? requested
    : maxAllowed
}

export interface PlaybackUrlResult {
  ok: boolean
  streamUrl?: string
  qualityTier: QualityTier
  bitrate: number
  codec: string
  durationSeconds?: number
  provider?: 'aws_cloudfront' | 'blob' | 'raw'
  error?: string
}

/**
 * Get the best available streaming URL for a content asset.
 * Prefers CloudFront-backed variants, falls back through blob then raw.
 *
 * @param contentAssetId — The content asset to stream.
 * @param preferredQuality — Desired quality tier (may be clamped by entitlement).
 * @param maxQualityTier — Optional quality ceiling from subscription entitlement.
 *   Defense-in-depth: the service enforces this ceiling even if the API route
 *   already performed entitlement gating. Pass undefined to skip enforcement.
 */
export async function getPlaybackUrl(
  contentAssetId: string,
  preferredQuality: QualityTier = 'high',
  maxQualityTier?: QualityTier,
): Promise<PlaybackUrlResult> {
  // Defense-in-depth: clamp to entitlement ceiling
  const effectiveQuality = clampQuality(preferredQuality, maxQualityTier)
  // ── Priority 1: CloudFront-backed media variant (AWS path) ──
  try {
    const awsVariant = await getBestMediaVariant(contentAssetId, effectiveQuality)
    if (awsVariant) {
      const { createSignedPlaybackUrl } = await import('@nzila/zonga-streaming-aws/cloudfront-delivery')
      const { resolveCloudFrontConfig } = await import('@nzila/zonga-streaming-aws')

      const signed = await resilientAwsCall(cloudFrontBreaker, async () =>
        createSignedPlaybackUrl(resolveCloudFrontConfig(), {
          storageKey: awsVariant.storageKey,
          qualityTier: awsVariant.qualityTier as QualityTier,
          orgId: '',
          assetId: contentAssetId,
          ttlSec: 14400,
        }),
      )

      return {
        ok: true,
        streamUrl: signed.url,
        qualityTier: awsVariant.qualityTier as QualityTier,
        bitrate: awsVariant.bitrate ?? PROCESSING_PROFILES[awsVariant.qualityTier as QualityTier]?.bitrate ?? 128,
        codec: awsVariant.codec ?? 'aac',
        durationSeconds: awsVariant.durationSeconds ?? undefined,
        provider: 'aws_cloudfront',
      }
    }
  } catch (err) {
    // AWS path unavailable — fall through to blob
    logger.warn('CloudFront playback unavailable, falling back', { err, contentAssetId })
  }

  // ── Priority 2: Blob-backed processed variant (legacy path) ──
  const tiers: QualityTier[] = [effectiveQuality, 'high', 'standard', 'preview']
  const uniqueTiers = [...new Set(tiers)]

  for (const tier of uniqueTiers) {
    const rows = await platformDb.execute(sql`
      SELECT pv.storage_key, pv.quality_tier, pv.bitrate, pv.codec,
             pv.duration_seconds, pv.format
      FROM zonga_processed_variants pv
      JOIN zonga_track_assets ta ON ta.id = pv.track_asset_id
      WHERE ta.content_asset_id = ${contentAssetId}
        AND pv.quality_tier = ${tier}
      LIMIT 1
    `)

    const variant = (rows as unknown as Array<Record<string, unknown>>)[0]
    if (variant) {
      const streamUrl = generateSasUrl(
        'zonga-encoded',
        variant.storage_key as string,
        240, // 4 hours
      )

      return {
        ok: true,
        streamUrl,
        qualityTier: variant.quality_tier as QualityTier,
        bitrate: variant.bitrate as number,
        codec: variant.codec as string,
        durationSeconds: variant.duration_seconds as number | undefined,
        provider: 'blob',
      }
    }
  }

  // ── Priority 3: Raw upload fallback ──
  const rawRows = await platformDb.execute(sql`
    SELECT ta.storage_key, ta.duration_seconds
    FROM zonga_track_assets ta
    WHERE ta.content_asset_id = ${contentAssetId}
      AND ta.upload_status = 'completed'
    LIMIT 1
  `)

  const raw = (rawRows as unknown as Array<Record<string, unknown>>)[0]
  if (raw) {
    const streamUrl = generateSasUrl(
      'zonga-audio',
      raw.storage_key as string,
      240, // 4 hours
    )
    const profile = PROCESSING_PROFILES.standard
    return {
      ok: true,
      streamUrl,
      qualityTier: 'standard',
      bitrate: profile.bitrate,
      codec: profile.codec,
      durationSeconds: raw.duration_seconds as number | undefined,
      provider: 'raw',
    }
  }

  return {
    ok: false,
    qualityTier: effectiveQuality,
    bitrate: 0,
    codec: 'unknown',
    error: 'No playable audio available for this track',
  }
}

// ── Playback Telemetry ──────────────────────────────────────────────────────

/**
 * Record a playback event for analytics and revenue attribution.
 */
export async function recordPlaybackEvent(params: {
  listenerId?: string
  contentAssetId: string
  qualityTier: QualityTier
  durationMs: number
  completed: boolean
  skipped?: boolean
  skipPositionMs?: number
  source?: PlaybackSource
  deviceType?: string
  country?: string
}): Promise<void> {
  try {
    await platformDb.execute(sql`
      INSERT INTO zonga_playback_events (
        listener_id, content_asset_id, quality_tier,
        duration_ms, completed, skipped, skip_position_ms,
        source, device_type, country
      ) VALUES (
        ${params.listenerId ?? null},
        ${params.contentAssetId},
        ${params.qualityTier},
        ${params.durationMs},
        ${params.completed},
        ${params.skipped ?? false},
        ${params.skipPositionMs ?? null},
        ${params.source ?? 'catalog'},
        ${params.deviceType ?? null},
        ${params.country ?? null}
      )
    `)

    // Update discovery signal
    await platformDb.execute(sql`
      INSERT INTO zonga_discovery_signals (entity_type, entity_id, signal_type, count, period)
      VALUES ('track', ${params.contentAssetId}, ${params.skipped ? 'skip' : 'play'}, 1, CURRENT_DATE)
      ON CONFLICT (entity_type, entity_id, signal_type, period)
      DO UPDATE SET count = zonga_discovery_signals.count + 1, updated_at = now()
    `)
  } catch (error) {
    // Non-blocking — telemetry failures should not break playback
    logger.error('Failed to record playback event', { error })
  }
}

/**
 * Get playback stats for a content asset.
 */
export async function getPlaybackStats(contentAssetId: string): Promise<{
  totalPlays: number
  uniqueListeners: number
  avgDurationMs: number
  completionRate: number
  skipRate: number
}> {
  const rows = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as total_plays,
      COUNT(DISTINCT listener_id)::int as unique_listeners,
      COALESCE(AVG(duration_ms), 0)::int as avg_duration_ms,
      COALESCE(
        COUNT(*) FILTER (WHERE completed = true)::float / NULLIF(COUNT(*), 0),
        0
      )::float as completion_rate,
      COALESCE(
        COUNT(*) FILTER (WHERE skipped = true)::float / NULLIF(COUNT(*), 0),
        0
      )::float as skip_rate
    FROM zonga_playback_events
    WHERE content_asset_id = ${contentAssetId}
  `)

  const row = (rows as unknown as Array<Record<string, unknown>>)[0]
  return {
    totalPlays: (row?.total_plays as number) ?? 0,
    uniqueListeners: (row?.unique_listeners as number) ?? 0,
    avgDurationMs: (row?.avg_duration_ms as number) ?? 0,
    completionRate: (row?.completion_rate as number) ?? 0,
    skipRate: (row?.skip_rate as number) ?? 0,
  }
}
