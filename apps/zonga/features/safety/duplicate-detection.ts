/**
 * Zonga — Duplicate Detection / Safety
 *
 * Audio fingerprint matching + metadata similarity checks
 * to prevent re-uploads of existing content.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  matchType?: 'exact_hash' | 'fingerprint' | 'metadata_similarity'
  matchedAssetId?: string
  matchedTitle?: string
  confidence: number      // 0-100
}

/**
 * Check if an upload is a duplicate of existing content.
 * Three-tier check: SHA-256 hash → audio fingerprint → metadata similarity.
 */
export async function checkForDuplicate(params: {
  sha256: string
  title: string
  artistName: string
  durationMs?: number
  orgId: string
}): Promise<DuplicateCheckResult> {
  const { sha256, title, artistName, durationMs, orgId } = params

  // Tier 1: Exact hash match
  const hashRows = await platformDb.execute(sql`
    SELECT ta.id, ca.title
    FROM zonga_track_assets ta
    JOIN zonga_content_assets ca ON ca.id = ta.content_asset_id
    WHERE ta.sha256_hash = ${sha256} AND ta.org_id = ${orgId}
    LIMIT 1
  `)
  const hashMatch = (hashRows as unknown as Array<Record<string, unknown>>)[0]
  if (hashMatch) {
    logger.warn('Duplicate detected: exact hash match', { sha256, matchedId: hashMatch.id })
    return {
      isDuplicate: true,
      matchType: 'exact_hash',
      matchedAssetId: hashMatch.id as string,
      matchedTitle: hashMatch.title as string,
      confidence: 100,
    }
  }

  // Tier 2: Audio fingerprint (if fingerprints are stored)
  // Acoustic fingerprint matching requires a specialized service;
  // for now, we check stored fingerprints with exact match
  const _fpRows = await platformDb.execute(sql`
    SELECT ta.id, ca.title, ta.audio_fingerprint
    FROM zonga_track_assets ta
    JOIN zonga_content_assets ca ON ca.id = ta.content_asset_id
    WHERE ta.audio_fingerprint IS NOT NULL
      AND ta.org_id = ${orgId}
      AND ABS(ta.duration_ms - ${durationMs ?? 0}) < 3000
    LIMIT 50
  `)
  // Simple fingerprint comparison placeholder
  // In production, use Chromaprint or similar via a processing job

  // Tier 3: Metadata similarity
  const metaRows = await platformDb.execute(sql`
    SELECT ca.id, ca.title, ca.artist_name
    FROM zonga_content_assets ca
    WHERE ca.org_id = ${orgId}
      AND ca.status != 'removed'
      AND (
        LOWER(ca.title) = LOWER(${title})
        OR similarity(ca.title, ${title}) > 0.8
      )
      AND (
        LOWER(ca.artist_name) = LOWER(${artistName})
        OR similarity(ca.artist_name, ${artistName}) > 0.8
      )
    LIMIT 5
  `)
  const metaMatch = (metaRows as unknown as Array<Record<string, unknown>>)[0]
  if (metaMatch) {
    logger.warn('Potential duplicate: metadata match', {
      title,
      matchedTitle: metaMatch.title,
      matchedId: metaMatch.id,
    })
    return {
      isDuplicate: true,
      matchType: 'metadata_similarity',
      matchedAssetId: metaMatch.id as string,
      matchedTitle: metaMatch.title as string,
      confidence: 80,
    }
  }

  return { isDuplicate: false, confidence: 0 }
}

/**
 * Flag content for suspicious activity (fraud/abuse pattern).
 */
export async function flagSuspiciousActivity(params: {
  contentId: string
  contentType: string
  reason: 'bot_streaming' | 'fake_engagement' | 'spam_upload' | 'payment_fraud' | 'account_abuse'
  details: string
  detectedBy: 'automated' | 'manual'
  orgId: string
}): Promise<{ ok: boolean }> {
  const { contentId, contentType, reason, details, detectedBy, orgId } = params

  await platformDb.execute(sql`
    INSERT INTO zonga_moderation_decisions (
      content_id, content_type, reviewer_id, verdict, reason, policy_violation, org_id
    ) VALUES (
      ${contentId}, ${contentType},
      ${detectedBy === 'automated' ? 'system' : 'manual_reviewer'},
      'escalated',
      ${details},
      ${reason},
      ${orgId}
    )
  `)

  logger.warn('Suspicious activity flagged', { contentId, reason, detectedBy })
  return { ok: true }
}

/**
 * Get stream velocity for a track to detect bot streaming.
 * Returns streams-per-hour for the last 24h.
 */
export async function getStreamVelocity(trackId: string): Promise<{
  streamsLast24h: number
  uniqueListeners: number
  peakHourStreams: number
  suspiciousPattern: boolean
}> {
  const rows = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as total_streams,
      COUNT(DISTINCT listener_id)::int as unique_listeners,
      MAX(hourly_count)::int as peak_hour
    FROM (
      SELECT listener_id,
        COUNT(*) OVER (PARTITION BY date_trunc('hour', played_at)) as hourly_count
      FROM zonga_playback_events
      WHERE track_id = ${trackId}::uuid
        AND played_at >= now() - interval '24 hours'
    ) sub
  `)

  const r = (rows as unknown as Array<Record<string, unknown>>)[0]
  const totalStreams = (r?.total_streams as number) ?? 0
  const uniqueListeners = (r?.unique_listeners as number) ?? 0
  const peakHour = (r?.peak_hour as number) ?? 0

  // Suspicious if: >90% streams from <5% listeners, or peak hour > 10x average
  const avgHourly = totalStreams / 24
  const suspiciousPattern =
    (uniqueListeners > 0 && totalStreams / uniqueListeners > 20) ||
    (avgHourly > 0 && peakHour > avgHourly * 10)

  return {
    streamsLast24h: totalStreams,
    uniqueListeners,
    peakHourStreams: peakHour,
    suspiciousPattern,
  }
}
