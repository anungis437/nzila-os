/**
 * Zonga Server Actions — Listener / Fan Layer.
 *
 * Listener profile management, activity feed, playlist saves,
 * and discovery queries. All reads/writes target domain tables.
 */
'use server'

import { resolveListenerContext, resolveListenerUUID } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { getListenerPlan } from '@/lib/guards/plan-queries'
import { isListenerPremium } from '@/lib/guards/subscription-guards'
import {
  createRecommendationEngine,
  type RecommendationPorts,
  type Recommendation,
} from '@nzila/zonga-intelligence'

/* ─── Types ─── */

export interface ListenerProfile {
  id: string
  displayName: string
  email?: string
  avatarUrl?: string
  bio?: string
  city?: string
  country?: string
  plan?: string
  subscriptionStatus?: string
  followingCount: number
  favoritesCount: number
  createdAt?: Date
}

export interface ListenerActivity {
  id: string
  activityType: string
  entityType: string
  targetEntityId: string
  metadataJson?: Record<string, unknown>
  createdAt?: Date
}

export interface SavedPlaylist {
  id: string
  playlistId: string
  playlistTitle?: string
  playlistDescription?: string
  savedAt?: Date
}

export interface DiscoverArtist {
  id: string
  displayName: string
  genre?: string
  country?: string
  verified: boolean
  assetCount: number
  followerCount: number
}

export interface DiscoverRelease {
  id: string
  title: string
  creatorName?: string
  releaseType?: string
  coverAssetId?: string
  publishedAt?: Date
  trackCount: number
}

/* ─── Profile ─── */

export async function getListenerProfile(listenerId?: string): Promise<ListenerProfile | null> {
  const ctx = await resolveListenerContext()
  const targetId = listenerId ?? ctx.actorId

  try {
    const [listener] = (await platformDb.execute(
      sql`SELECT
        l.id,
        l.display_name as "displayName",
        l.email,
        l.avatar_url as "avatarUrl",
        l.bio,
        l.city,
        l.country,
        l.plan,
        l.subscription_status as "subscriptionStatus",
        l.created_at as "createdAt",
        COALESCE((SELECT COUNT(*) FROM zonga_listener_follows WHERE listener_id = l.id), 0) as "followingCount",
        COALESCE((SELECT COUNT(*) FROM zonga_listener_favorites WHERE listener_id = l.id), 0) as "favoritesCount"
      FROM zonga_listeners l
      WHERE l.user_id = ${targetId}
      ORDER BY l.created_at DESC
      LIMIT 1`,
    )) as unknown as [ListenerProfile | undefined]

    return listener ?? null
  } catch (error) {
    logger.error('getListenerProfile failed', { error })
    return null
  }
}

export async function ensureListenerProfile(data: {
  displayName: string
  email?: string
}): Promise<{ id: string }> {
  const ctx = await resolveListenerContext()

  try {
    // Atomic upsert — unique index on user_id prevents duplicates
    // org_id is a UUID FK — auth orgId is a string, so always pass null here
    const [row] = (await platformDb.execute(
      sql`INSERT INTO zonga_listeners (user_id, org_id, display_name, email)
      VALUES (${ctx.actorId}, ${null}, ${data.displayName}, ${data.email ?? null})
      ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
      RETURNING id`,
    )) as unknown as [{ id: string }]

    return row
  } catch (error) {
    logger.error('ensureListenerProfile failed', { error })
    return { id: ctx.actorId }
  }
}

/* ─── Update Profile ─── */

export async function updateListenerProfile(data: {
  displayName?: string
  email?: string
  avatarUrl?: string
  bio?: string
  city?: string
  country?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await resolveListenerContext()

  try {
    await platformDb.execute(
      sql`UPDATE zonga_listeners SET
        display_name = COALESCE(${data.displayName ?? null}, display_name),
        email = COALESCE(${data.email ?? null}, email),
        avatar_url = COALESCE(${data.avatarUrl ?? null}, avatar_url),
        bio = COALESCE(${data.bio ?? null}, bio),
        city = COALESCE(${data.city ?? null}, city),
        country = COALESCE(${data.country ?? null}, country),
        updated_at = NOW()
      WHERE user_id = ${ctx.actorId}`,
    )

    revalidatePath('/dashboard/profile')
    return { success: true }
  } catch (error) {
    logger.error('updateListenerProfile failed', { error })
    return { success: false, error: 'Failed to update profile' }
  }
}

/* ─── Activity Feed ─── */

export async function getListenerFeed(opts?: {
  limit?: number
}): Promise<ListenerActivity[]> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)
  const limit = opts?.limit ?? 50

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        id,
        activity_type as "activityType",
        entity_type as "entityType",
        entity_id as "targetEntityId",
        metadata_json as "metadataJson",
        created_at as "createdAt"
      FROM zonga_listener_activity
      WHERE listener_id = ${listenerId}
      ORDER BY created_at DESC
      LIMIT ${limit}`,
    )) as unknown as ListenerActivity[]

    return rows
  } catch (error) {
    logger.error('getListenerFeed failed', { error })
    return []
  }
}

export async function recordActivity(data: {
  activityType: string
  entityType: string
  targetEntityId: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    await platformDb.execute(
      sql`INSERT INTO zonga_listener_activity (org_id, listener_id, activity_type, entity_type, entity_id, metadata_json)
      VALUES (${ctx.orgId}, ${listenerId}, ${data.activityType}, ${data.entityType}, ${data.targetEntityId},
        ${data.metadata ? JSON.stringify(data.metadata) + '::jsonb' : null})`,
    )

    return { success: true }
  } catch (error) {
    logger.error('recordActivity failed', { error })
    return { success: false }
  }
}

/* ─── Playlist Saves ─── */

export async function savePlaylist(playlistId: string): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    const [existing] = (await platformDb.execute(
      sql`SELECT id FROM zonga_listener_playlist_saves
      WHERE listener_id = ${listenerId} AND playlist_id = ${playlistId}
      LIMIT 1`,
    )) as unknown as [{ id: string } | undefined]

    if (existing) return { success: true }

    await platformDb.execute(
      sql`INSERT INTO zonga_listener_playlist_saves (org_id, listener_id, playlist_id)
      VALUES (${ctx.orgId}, ${listenerId}, ${playlistId})`,
    )

    return { success: true }
  } catch (error) {
    logger.error('savePlaylist failed', { error })
    return { success: false }
  }
}

export async function unsavePlaylist(playlistId: string): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    await platformDb.execute(
      sql`DELETE FROM zonga_listener_playlist_saves
      WHERE listener_id = ${listenerId} AND playlist_id = ${playlistId}`,
    )

    return { success: true }
  } catch (error) {
    logger.error('unsavePlaylist failed', { error })
    return { success: false }
  }
}

export async function listSavedPlaylists(): Promise<SavedPlaylist[]> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    const rows = await platformDb.execute(
      sql`SELECT
        s.id,
        s.playlist_id as "playlistId",
        p.title as "playlistTitle",
        p.description as "playlistDescription",
        s.created_at as "savedAt"
      FROM zonga_listener_playlist_saves s
      LEFT JOIN zonga_playlists p ON p.id = s.playlist_id
      WHERE s.listener_id = ${listenerId}
      ORDER BY s.created_at DESC`,
    )

    return (rows as unknown as SavedPlaylist[]) ?? []
  } catch (error) {
    logger.error('listSavedPlaylists failed', { error })
    return []
  }
}

/* ─── Discovery Queries ─── */

export async function discoverArtists(opts?: {
  genre?: string
  country?: string
  limit?: number
}): Promise<DiscoverArtist[]> {
  const _ctx = await resolveListenerContext()
  const limit = opts?.limit ?? 20

  try {
    const genreFilter = opts?.genre ? sql` AND c.genre = ${opts.genre}` : sql``
    const countryFilter = opts?.country ? sql` AND c.country = ${opts.country}` : sql``

    const rows = (await platformDb.execute(
      sql`SELECT
        c.id,
        c.display_name as "displayName",
        c.genre,
        c.country,
        c.verified,
        COALESCE((SELECT COUNT(*) FROM zonga_content_assets a WHERE a.creator_id = c.id), 0)::int as "assetCount",
        COALESCE((SELECT COUNT(*) FROM zonga_listener_follows f WHERE f.creator_id = c.id), 0)::int as "followerCount"
      FROM zonga_creators c
      WHERE c.status = 'active'
      ${genreFilter} ${countryFilter}
      ORDER BY "followerCount" DESC
      LIMIT ${limit}`,
    )) as unknown as DiscoverArtist[]

    return rows
  } catch (error) {
    logger.error('discoverArtists failed', { error })
    return []
  }
}

export async function discoverReleases(opts?: {
  limit?: number
}): Promise<DiscoverRelease[]> {
  const ctx = await resolveListenerContext()
  const limit = opts?.limit ?? 20

  // S1: Free listeners don't see exclusive releases
  const planInfo = await getListenerPlan(ctx.actorId, ctx.orgId)
  const premium = isListenerPremium(planInfo.plan, planInfo.subscriptionStatus)
  const exclusiveFilter = premium ? sql`` : sql` AND r.exclusive IS NOT TRUE`

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        r.id,
        r.title,
        c.display_name as "creatorName",
        r.release_type as "releaseType",
        r.cover_asset_id as "coverAssetId",
        r.published_at as "publishedAt",
        COALESCE((SELECT COUNT(*) FROM zonga_release_tracks t WHERE t.release_id = r.id), 0)::int as "trackCount"
      FROM zonga_releases r
      LEFT JOIN zonga_creators c ON c.id = r.creator_id
      WHERE r.status = 'published'
      ${exclusiveFilter}
      ORDER BY r.published_at DESC NULLS LAST
      LIMIT ${limit}`,
    )) as unknown as DiscoverRelease[]

    return rows
  } catch (error) {
    logger.error('discoverReleases failed', { error })
    return []
  }
}

/* ─── AI Recommendations ─── */

export interface ListenerRecommendation {
  itemId: string
  itemType: string
  score: number
  reason: string
  strategy: string
}

/**
 * Fetch AI-powered recommendations for the current listener.
 * Falls back to trending content when the engine has insufficient signals.
 */
export async function getRecommendationsForUser(opts?: {
  limit?: number
}): Promise<{ items: ListenerRecommendation[]; strategy: string }> {
  const ctx = await resolveListenerContext()
  const listenerUUID = await resolveListenerUUID(ctx)
  const limit = opts?.limit ?? 8

  const ports: RecommendationPorts = {
    fetchUserSignals: async (_userId, maxAgeDays) => {
      try {
        const rows = (await platformDb.execute(
          sql`SELECT
            id as "signalId",
            signal_type as "signalType",
            entity_id as "itemId",
            entity_type as "itemType",
            1.0 as weight,
            created_at as "timestamp"
          FROM zonga_listener_activity
          WHERE listener_id = ${listenerUUID}
            AND created_at > NOW() - INTERVAL '1 day' * ${maxAgeDays}
          ORDER BY created_at DESC
          LIMIT 200`,
        )) as unknown as Array<Record<string, unknown>>
        return rows.map((r) => ({
          userId: _userId,
          signalType: String(r.signalType ?? 'stream') as 'play' | 'skip' | 'save' | 'share' | 'purchase',
          targetId: String(r.itemId),
          targetType: (String(r.itemType ?? 'track')) as 'track' | 'artist' | 'event' | 'playlist',
          weight: Number(r.weight ?? 1),
          timestamp: r.timestamp instanceof Date ? r.timestamp : new Date(),
        }))
      } catch {
        return []
      }
    },
    fetchTrendingItems: async (_region, itemType, trendLimit) => {
      try {
        const rows = (await platformDb.execute(
          sql`SELECT
            r.id as "itemId",
            'track' as "itemType",
            COALESCE(r.stream_count, 0) as velocity,
            COALESCE(r.stream_count, 0) as volume,
            'global' as region
          FROM zonga_releases r
          WHERE r.status = 'published'
          ORDER BY r.published_at DESC NULLS LAST
          LIMIT ${trendLimit}`,
        )) as unknown as Array<Record<string, unknown>>
        return rows.map((r) => ({
          itemId: String(r.itemId),
          itemType: itemType,
          velocity: Number(r.velocity ?? 0),
          volume: Number(r.volume ?? 0),
          region: String(r.region ?? 'global'),
        }))
      } catch {
        return []
      }
    },
    fetchContentSimilar: async () => [],
    fetchUserRegion: async () => 'global',
  }

  try {
    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({
      userId: ctx.actorId,
      targetType: 'track',
      limit,
    })

    const items: ListenerRecommendation[] = result.recommendations.map((r: Recommendation) => ({
      itemId: r.itemId,
      itemType: r.itemType,
      score: r.score,
      reason: r.reason,
      strategy: r.strategy,
    }))

    return { items, strategy: result.strategy }
  } catch (error) {
    logger.error('getRecommendationsForUser failed', { error })
    return { items: [], strategy: 'fallback' }
  }
}
