/**
 * Zonga — Trending Calculator
 *
 * Computes trending scores based on engagement signals:
 * plays, saves, shares, follows, likes, purchases.
 *
 * Uses time-decayed weighted scoring:
 * score = Σ(signal_weight × count × recency_decay)
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// ── Signal Weights ──────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS: Record<string, number> = {
  play: 1.0,
  save: 3.0,
  share: 5.0,
  follow: 4.0,
  like: 2.0,
  purchase: 10.0,
  search_click: 1.5,
  skip: -0.5,
}

/** Days for the trending window */
const TRENDING_WINDOW_DAYS = 7

/** Decay factor per day — more recent signals score higher */
const DECAY_RATE = 0.85

// ── Trending Computation ────────────────────────────────────────────────────

/**
 * Recompute trending scores for all entities within the trending window.
 * Should be called periodically (e.g., every 15 minutes via cron).
 */
export async function recomputeTrendingScores(): Promise<{
  tracksUpdated: number
  artistsUpdated: number
  eventsUpdated: number
}> {
  const now = new Date()
  let tracksUpdated = 0
  let artistsUpdated = 0
  let eventsUpdated = 0

  for (const entityType of ['track', 'artist', 'event', 'release'] as const) {
    const rows = await platformDb.execute(sql`
      SELECT
        entity_id,
        signal_type,
        count,
        period
      FROM zonga_discovery_signals
      WHERE entity_type = ${entityType}
        AND period >= CURRENT_DATE - ${TRENDING_WINDOW_DAYS}
      ORDER BY entity_id
    `)

    // Group by entity and compute scores
    const scores = new Map<string, number>()
    for (const row of rows as unknown as Array<Record<string, unknown>>) {
      const resourceId = row.entity_id as string
      const signalType = row.signal_type as string
      const count = row.count as number
      const period = new Date(row.period as string)

      const daysAgo = Math.floor((now.getTime() - period.getTime()) / (24 * 60 * 60 * 1000))
      const weight = SIGNAL_WEIGHTS[signalType] ?? 1.0
      const decay = Math.pow(DECAY_RATE, daysAgo)
      const contribution = weight * count * decay

      scores.set(resourceId, (scores.get(resourceId) ?? 0) + contribution)
    }

    // Upsert scores
    for (const [resourceId, score] of scores) {
      await platformDb.execute(sql`
        INSERT INTO zonga_trending_scores (entity_type, entity_id, score, computed_at)
        VALUES (${entityType}, ${resourceId}, ${score}, now())
        ON CONFLICT (entity_type, entity_id)
        DO UPDATE SET score = ${score}, computed_at = now()
      `)
    }

    const count = scores.size
    if (entityType === 'track') tracksUpdated = count
    else if (entityType === 'artist') artistsUpdated = count
    else if (entityType === 'event') eventsUpdated = count
  }

  logger.info('Trending scores recomputed', {
    tracksUpdated,
    artistsUpdated,
    eventsUpdated,
  })

  return { tracksUpdated, artistsUpdated, eventsUpdated }
}

// ── Trending Queries ────────────────────────────────────────────────────────

export interface TrendingResult {
  resourceId: string
  entityType: string
  score: number
  rank: number
}

/**
 * Get top trending entities by type.
 */
export async function getTrending(params: {
  entityType: 'track' | 'artist' | 'event' | 'release'
  genre?: string
  region?: string
  limit?: number
}): Promise<TrendingResult[]> {
  const limit = params.limit ?? 20
  const genreFilter = params.genre ? sql`AND genre = ${params.genre}` : sql``
  const regionFilter = params.region ? sql`AND region = ${params.region}` : sql``

  const rows = await platformDb.execute(sql`
    SELECT entity_id, entity_type, score,
           ROW_NUMBER() OVER (ORDER BY score DESC) as rank
    FROM zonga_trending_scores
    WHERE entity_type = ${params.entityType}
    ${genreFilter}
    ${regionFilter}
    ORDER BY score DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    resourceId: r.entity_id as string,
    entityType: r.entity_type as string,
    score: Number(r.score),
    rank: Number(r.rank),
  }))
}

/**
 * Record a discovery signal (play, save, share, etc.)
 */
export async function recordDiscoverySignal(params: {
  entityType: 'track' | 'artist' | 'event' | 'release' | 'playlist'
  resourceId: string
  signalType: string
  count?: number
}): Promise<void> {
  await platformDb.execute(sql`
    INSERT INTO zonga_discovery_signals (entity_type, entity_id, signal_type, count, period)
    VALUES (${params.entityType}, ${params.resourceId}, ${params.signalType}, ${params.count ?? 1}, CURRENT_DATE)
    ON CONFLICT (entity_type, entity_id, signal_type, period)
    DO UPDATE SET count = zonga_discovery_signals.count + ${params.count ?? 1}, updated_at = now()
  `)
}
