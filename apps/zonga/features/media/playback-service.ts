/**
 * Zonga — Playback Service
 *
 * Generates streaming URLs from processed variants,
 * records playback telemetry, and handles fallback logic.
 *
 * Resolution order:
 * 1. CloudFront-backed media variants (zonga_media_variants, provider=aws)
 * 2. Blob-backed processed variants (zonga_processed_variants, legacy path)
 * Unproved raw masters remain unavailable.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { zongaRows, type ZongaActionDb } from '@/queries/action-context'
import { eligibleQualityTiers, safeMediaKey } from './quality-ceiling'
import { generateSasUrl } from '@nzila/blob'
import { logger } from '@/lib/logger'
import { cloudFrontBreaker, resilientAwsCall } from './resilience'
import type { QualityTier, PlaybackSource } from './types'
import { PROCESSING_PROFILES } from './types'
import { getBestMediaVariant } from './media-job-service'

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
 * Uses eligible CloudFront/encoded Blob variants; an unproved raw master is unavailable.
 *
 * @param contentAssetId — The content asset to stream.
 * @param preferredQuality — Desired quality tier (may be clamped by entitlement).
 * @param maxQualityTier — Optional quality ceiling from subscription entitlement.
 *   Defense-in-depth: the service enforces this ceiling even if the API route
 *   already performed entitlement gating. Omission defaults to the requested ceiling.
 */
export async function getPlaybackUrl(
  contentAssetId: string,
  preferredQuality: QualityTier = 'high',
  maxQualityTier: QualityTier = preferredQuality,
  db: Pick<ZongaActionDb, 'execute'> = platformDb,
): Promise<PlaybackUrlResult> {
  const tiers = eligibleQualityTiers(preferredQuality, maxQualityTier),
    effectiveQuality = tiers[0]
  // Source reads stay on the caller's actual transaction. A provider failure
  // may fall back; a failed SQL authority/source read is not converted to allow.
  const awsVariant = await getBestMediaVariant(contentAssetId, effectiveQuality, db)
  if (awsVariant) {
    try {
      const { createSignedPlaybackUrl } =
        await import('@nzila/zonga-streaming-aws/cloudfront-delivery')
      const { resolveCloudFrontConfig } = await import('@nzila/zonga-streaming-aws')
      const [parent] = zongaRows<{ orgId: string }>(
        await db.execute(
          sql`SELECT org_id AS "orgId" FROM public.zonga_content_assets WHERE id=${contentAssetId}::uuid AND status='published' FOR SHARE`,
        ),
      )
      if (!parent) throw new Error('Published source changed')
      const signed = await resilientAwsCall(cloudFrontBreaker, async () =>
        createSignedPlaybackUrl(resolveCloudFrontConfig(), {
          storageKey: awsVariant.storageKey,
          qualityTier: awsVariant.qualityTier,
          orgId: parent.orgId,
          assetId: contentAssetId,
          ttlSec: 14400,
        }),
      )
      const fresh = await getBestMediaVariant(contentAssetId, effectiveQuality, db)
      if (
        !fresh ||
        fresh.id !== awsVariant.id ||
        fresh.storageKey !== awsVariant.storageKey ||
        fresh.qualityTier !== awsVariant.qualityTier
      )
        throw new Error('Processed source changed')
      const tier = awsVariant.qualityTier as QualityTier
      return {
        ok: true,
        streamUrl: signed.url,
        qualityTier: tier,
        bitrate: awsVariant.bitrate ?? PROCESSING_PROFILES[tier].bitrate,
        codec: awsVariant.codec ?? PROCESSING_PROFILES[tier].codec,
        durationSeconds: awsVariant.durationSeconds ?? undefined,
        provider: 'aws_cloudfront',
      }
    } catch (error) {
      logger.warn('CloudFront playback unavailable', {
        contentAssetId,
        errorName: error instanceof Error ? error.name : 'unknown',
      })
    }
  }
  const [availability] = zongaRows<{ variants: string | null; tracks: string | null }>(
    await db.execute(
      sql`SELECT pg_catalog.to_regclass('public.zonga_processed_variants')::text AS variants,pg_catalog.to_regclass('public.zonga_track_assets')::text AS tracks`,
    ),
  )
  if (availability?.variants && availability.tracks)
    for (const tier of tiers) {
      const [variant] = zongaRows<{
        id: string
        storageKey: string
        qualityTier: QualityTier
        bitrate: number
        codec: string
        durationSeconds: number | null
      }>(
        await db.execute(
          sql`SELECT pv.id,pv.storage_key AS "storageKey",pv.quality_tier AS "qualityTier",pv.bitrate,pv.codec,pv.duration_seconds AS "durationSeconds" FROM public.zonga_processed_variants pv JOIN public.zonga_track_assets ta ON ta.id=pv.track_asset_id JOIN public.zonga_content_assets a ON a.id=ta.content_asset_id JOIN public.zonga_creators c ON c.id=a.creator_id WHERE a.id=${contentAssetId}::uuid AND a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) AND ta.org_id=a.org_id AND ta.creator_id=a.creator_id AND ta.upload_status='completed' AND pv.quality_tier=${tier} AND pv.storage_key='processed/'||ta.creator_id::text||'/'||ta.id::text||'/'||pv.quality_tier||'.'||pv.format ORDER BY pv.id LIMIT 1 FOR SHARE OF pv,ta,a,c`,
        ),
      )
      if (!variant || !safeMediaKey(variant.storageKey)) continue
      const streamUrl = generateSasUrl('zonga-encoded', variant.storageKey, 240)
      const [fresh] = zongaRows<{ id: string }>(
        await db.execute(
          sql`SELECT pv.id FROM public.zonga_processed_variants pv JOIN public.zonga_track_assets ta ON ta.id=pv.track_asset_id JOIN public.zonga_content_assets a ON a.id=ta.content_asset_id JOIN public.zonga_creators c ON c.id=a.creator_id WHERE pv.id=${variant.id}::uuid AND pv.storage_key=${variant.storageKey} AND pv.quality_tier=${variant.qualityTier} AND a.id=${contentAssetId}::uuid AND a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) AND ta.org_id=a.org_id AND ta.creator_id=a.creator_id AND ta.upload_status='completed' AND pv.storage_key='processed/'||ta.creator_id::text||'/'||ta.id::text||'/'||pv.quality_tier||'.'||pv.format FOR SHARE OF pv,ta,a,c`,
        ),
      )
      if (!fresh) throw new Error('Processed source changed')
      return {
        ok: true,
        streamUrl,
        qualityTier: variant.qualityTier,
        bitrate: variant.bitrate,
        codec: variant.codec,
        durationSeconds:
          variant.durationSeconds === null ? undefined : Number(variant.durationSeconds),
        provider: 'blob',
      }
    }
  // Raw uploads carry no proved encoded ceiling. Never relabel a master file.
  return {
    ok: false,
    qualityTier: effectiveQuality,
    bitrate: 0,
    codec: 'unknown',
    error: 'No eligible processed audio variant is available',
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
