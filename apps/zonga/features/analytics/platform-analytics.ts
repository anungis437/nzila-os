/**
 * Zonga — Platform Analytics Service
 *
 * Health snapshots, creator analytics, and content performance.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { PlatformHealthSnapshot, CreatorAnalytics, ContentPerformance } from './types'

/**
 * Capture a platform health snapshot for the given period.
 */
export async function capturePlatformSnapshot(
  orgId: string,
  period: string,
): Promise<PlatformHealthSnapshot> {
  const statsRows = await platformDb.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM zonga_content_assets WHERE org_id = ${orgId} AND status = 'published') as total_tracks,
      (SELECT COUNT(*)::int FROM zonga_artist_profiles WHERE org_id = ${orgId}) as total_artists,
      (SELECT COUNT(*)::int FROM zonga_listeners WHERE org_id = ${orgId}) as total_listeners,
      (SELECT COUNT(*)::int FROM zonga_events WHERE org_id = ${orgId} AND status NOT IN ('draft', 'cancelled')) as total_events,
      (SELECT COUNT(*)::bigint FROM zonga_playback_events WHERE org_id = ${orgId}) as total_streams,
      COALESCE(
        (SELECT SUM(net_amount)::numeric FROM zonga_earnings_entries WHERE org_id = ${orgId}),
        0
      ) as total_revenue,
      (SELECT COUNT(DISTINCT uploader_id)::int FROM zonga_content_assets
       WHERE org_id = ${orgId} AND created_at >= (now() - interval '30 days')) as active_creators,
      (SELECT COUNT(*)::int FROM zonga_listeners
       WHERE org_id = ${orgId} AND created_at >= (now() - interval '30 days')) as new_signups,
      COALESCE(
        (SELECT AVG(duration_ms)::int FROM zonga_playback_events WHERE org_id = ${orgId}),
        0
      ) as avg_stream_duration
  `)
  const stats = (statsRows as unknown as Array<Record<string, unknown>>)[0]!

  // Top genre
  const genreRows = await platformDb.execute(sql`
    SELECT genre, COUNT(*)::int as cnt FROM zonga_content_assets
    WHERE org_id = ${orgId} AND status = 'published' AND genre IS NOT NULL
    GROUP BY genre ORDER BY cnt DESC LIMIT 1
  `)
  const topGenre = (genreRows as unknown as Array<{ genre: string }>)[0]?.genre ?? 'unknown'

  // Persist snapshot
  const insertRows = await platformDb.execute(sql`
    INSERT INTO zonga_platform_health_snapshots (
      org_id, period, total_tracks, total_artists, total_listeners,
      total_events, total_streams, total_revenue, active_creators,
      new_signups, avg_stream_duration, top_genre
    ) VALUES (
      ${orgId}, ${period},
      ${stats.total_tracks as number}, ${stats.total_artists as number},
      ${stats.total_listeners as number}, ${stats.total_events as number},
      ${Number(stats.total_streams)}, ${Number(stats.total_revenue)},
      ${stats.active_creators as number}, ${stats.new_signups as number},
      ${stats.avg_stream_duration as number}, ${topGenre}
    )
    RETURNING id, created_at
  `)
  const row = (insertRows as unknown as Array<{ id: string; created_at: string }>)[0]

  logger.info('Platform snapshot captured', { period, orgId })

  return {
    id: row.id,
    orgId,
    period,
    totalTracks: stats.total_tracks as number,
    totalArtists: stats.total_artists as number,
    totalListeners: stats.total_listeners as number,
    totalEvents: stats.total_events as number,
    totalStreams: Number(stats.total_streams),
    totalRevenue: Number(stats.total_revenue),
    activeCreators: stats.active_creators as number,
    newSignups: stats.new_signups as number,
    avgStreamDuration: stats.avg_stream_duration as number,
    topGenre,
    snapshotAt: new Date(row.created_at),
  }
}

/**
 * Get analytics for a specific creator.
 */
export async function getCreatorAnalytics(
  creatorId: string,
  orgId: string,
): Promise<CreatorAnalytics> {
  const statsRows = await platformDb.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM zonga_content_assets WHERE uploader_id = ${creatorId} AND org_id = ${orgId}) as total_tracks,
      (SELECT COUNT(*)::bigint FROM zonga_playback_events pe
       JOIN zonga_content_assets ca ON ca.id = pe.track_id
       WHERE ca.uploader_id = ${creatorId} AND ca.org_id = ${orgId}) as total_streams,
      COALESCE(
        (SELECT SUM(net_amount)::numeric FROM zonga_earnings_entries
         WHERE creator_id = ${creatorId} AND org_id = ${orgId}),
        0
      ) as total_earnings
  `)
  const stats = (statsRows as unknown as Array<Record<string, unknown>>)[0]!

  // Top track
  const topTrackRows = await platformDb.execute(sql`
    SELECT ca.id, ca.title, COUNT(pe.id)::int as streams
    FROM zonga_content_assets ca
    LEFT JOIN zonga_playback_events pe ON pe.track_id = ca.id
    WHERE ca.uploader_id = ${creatorId} AND ca.org_id = ${orgId}
    GROUP BY ca.id, ca.title
    ORDER BY streams DESC
    LIMIT 1
  `)
  const topTrack = (topTrackRows as unknown as Array<Record<string, unknown>>)[0]

  // Earnings by month
  const monthlyRows = await platformDb.execute(sql`
    SELECT period, SUM(net_amount)::numeric as amount
    FROM zonga_earnings_entries
    WHERE creator_id = ${creatorId} AND org_id = ${orgId}
    GROUP BY period
    ORDER BY period DESC
    LIMIT 12
  `)

  return {
    creatorId,
    orgId,
    totalTracks: stats.total_tracks as number,
    totalStreams: Number(stats.total_streams),
    totalEarnings: Number(stats.total_earnings),
    totalFollowers: 0, // placeholder — social follows table not yet wired
    avgDailyStreams: Math.round(Number(stats.total_streams) / 30),
    topTrackId: topTrack?.id as string | undefined,
    topTrackTitle: topTrack?.title as string | undefined,
    topTrackStreams: (topTrack?.streams as number) ?? 0,
    streamsByCountry: {},
    streamsByGenre: {},
    earningsByMonth: (monthlyRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      month: r.period as string,
      amount: Number(r.amount),
    })),
  }
}

/**
 * Get performance metrics for a specific piece of content.
 */
export async function getContentPerformance(
  contentId: string,
  orgId: string,
): Promise<ContentPerformance | null> {
  const rows = await platformDb.execute(sql`
    SELECT
      ca.id as content_id,
      ca.title,
      COUNT(pe.id)::int as total_streams,
      COUNT(DISTINCT pe.listener_id)::int as unique_listeners,
      COALESCE(
        (SELECT COUNT(*)::int FROM zonga_discovery_signals
         WHERE content_id = ca.id::text AND signal_type = 'save'),
        0
      ) as saves,
      COALESCE(
        (SELECT COUNT(*)::int FROM zonga_discovery_signals
         WHERE content_id = ca.id::text AND signal_type = 'share'),
        0
      ) as shares,
      COALESCE(
        (SELECT SUM(net_amount)::numeric FROM zonga_earnings_entries
         WHERE reference_id = ca.id::text),
        0
      ) as revenue,
      COALESCE(
        (SELECT score FROM zonga_trending_scores
         WHERE content_id = ca.id::text AND content_type = 'track'
         ORDER BY computed_at DESC LIMIT 1),
        0
      ) as trending_score
    FROM zonga_content_assets ca
    LEFT JOIN zonga_playback_events pe ON pe.track_id = ca.id
    WHERE ca.id = ${contentId}::uuid AND ca.org_id = ${orgId}
    GROUP BY ca.id, ca.title
  `)

  const r = (rows as unknown as Array<Record<string, unknown>>)[0]
  if (!r) return null

  return {
    contentId: r.content_id as string,
    contentType: 'track',
    title: r.title as string,
    totalStreams: r.total_streams as number,
    uniqueListeners: r.unique_listeners as number,
    saves: r.saves as number,
    shares: r.shares as number,
    avgCompletionRate: 0, // requires duration tracking
    revenueGenerated: Number(r.revenue),
    trendingScore: Number(r.trending_score),
    listenerRetention: 0, // requires cohort analysis
  }
}
