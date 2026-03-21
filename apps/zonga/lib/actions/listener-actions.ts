/**
 * Zonga Server Actions — Listener / Fan Layer.
 *
 * Listener profile management, activity feed, playlist saves,
 * and discovery queries. All reads/writes target domain tables.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getListenerPlan } from '@/lib/guards/plan-queries'
import { isListenerPremium } from '@/lib/guards/subscription-guards'

/* ─── Types ─── */

export interface ListenerProfile {
  id: string
  displayName: string
  email?: string
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
  const ctx = await resolveOrgContext()
  const targetId = listenerId ?? ctx.actorId

  try {
    const [listener] = (await platformDb.execute(
      sql`SELECT
        l.id,
        l.display_name as "displayName",
        l.email,
        l.city,
        l.country,
        l.plan,
        l.subscription_status as "subscriptionStatus",
        l.created_at as "createdAt",
        COALESCE((SELECT COUNT(*) FROM zonga_listener_follows WHERE listener_id = l.id AND org_id = ${ctx.orgId}), 0) as "followingCount",
        COALESCE((SELECT COUNT(*) FROM zonga_listener_favorites WHERE listener_id = l.id AND org_id = ${ctx.orgId}), 0) as "favoritesCount"
      FROM zonga_listeners l
      WHERE l.id = ${targetId} AND l.org_id = ${ctx.orgId}`,
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
  const ctx = await resolveOrgContext()

  try {
    // Upsert: return existing or create new
    const [existing] = (await platformDb.execute(
      sql`SELECT id FROM zonga_listeners WHERE id = ${ctx.actorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ id: string } | undefined]

    if (existing) return existing

    const [created] = (await platformDb.execute(
      sql`INSERT INTO zonga_listeners (id, org_id, display_name, email)
      VALUES (${ctx.actorId}, ${ctx.orgId}, ${data.displayName}, ${data.email ?? null})
      RETURNING id`,
    )) as unknown as [{ id: string }]

    return created
  } catch (error) {
    logger.error('ensureListenerProfile failed', { error })
    return { id: ctx.actorId }
  }
}

/* ─── Activity Feed ─── */

export async function getListenerFeed(opts?: {
  limit?: number
}): Promise<ListenerActivity[]> {
  const ctx = await resolveOrgContext()
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
      WHERE listener_id = ${ctx.actorId} AND org_id = ${ctx.orgId}
      ORDER BY created_at DESC
      LIMIT ${limit}`,
    )) as unknown as { rows: ListenerActivity[] }

    return rows.rows ?? []
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
  const ctx = await resolveOrgContext()

  try {
    await platformDb.execute(
      sql`INSERT INTO zonga_listener_activity (org_id, listener_id, activity_type, entity_type, entity_id, metadata_json)
      VALUES (${ctx.orgId}, ${ctx.actorId}, ${data.activityType}, ${data.entityType}, ${data.targetEntityId},
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
  const ctx = await resolveOrgContext()

  try {
    const [existing] = (await platformDb.execute(
      sql`SELECT id FROM zonga_listener_playlist_saves
      WHERE listener_id = ${ctx.actorId} AND playlist_id = ${playlistId} AND org_id = ${ctx.orgId}
      LIMIT 1`,
    )) as unknown as [{ id: string } | undefined]

    if (existing) return { success: true }

    await platformDb.execute(
      sql`INSERT INTO zonga_listener_playlist_saves (org_id, listener_id, playlist_id)
      VALUES (${ctx.orgId}, ${ctx.actorId}, ${playlistId})`,
    )

    return { success: true }
  } catch (error) {
    logger.error('savePlaylist failed', { error })
    return { success: false }
  }
}

export async function unsavePlaylist(playlistId: string): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext()

  try {
    await platformDb.execute(
      sql`DELETE FROM zonga_listener_playlist_saves
      WHERE listener_id = ${ctx.actorId} AND playlist_id = ${playlistId} AND org_id = ${ctx.orgId}`,
    )

    return { success: true }
  } catch (error) {
    logger.error('unsavePlaylist failed', { error })
    return { success: false }
  }
}

export async function listSavedPlaylists(): Promise<SavedPlaylist[]> {
  const ctx = await resolveOrgContext()

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        s.id,
        s.playlist_id as "playlistId",
        p.title as "playlistTitle",
        p.description as "playlistDescription",
        s.created_at as "savedAt"
      FROM zonga_listener_playlist_saves s
      LEFT JOIN zonga_playlists p ON p.id = s.playlist_id
      WHERE s.listener_id = ${ctx.actorId} AND s.org_id = ${ctx.orgId}
      ORDER BY s.created_at DESC`,
    )) as unknown as { rows: SavedPlaylist[] }

    return rows.rows ?? []
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
  const ctx = await resolveOrgContext()
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
      WHERE c.org_id = ${ctx.orgId} AND c.status = 'active'
      ${genreFilter} ${countryFilter}
      ORDER BY "followerCount" DESC
      LIMIT ${limit}`,
    )) as unknown as { rows: DiscoverArtist[] }

    return rows.rows ?? []
  } catch (error) {
    logger.error('discoverArtists failed', { error })
    return []
  }
}

export async function discoverReleases(opts?: {
  limit?: number
}): Promise<DiscoverRelease[]> {
  const ctx = await resolveOrgContext()
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
      WHERE r.org_id = ${ctx.orgId} AND r.status = 'published'
      ${exclusiveFilter}
      ORDER BY r.published_at DESC NULLS LAST
      LIMIT ${limit}`,
    )) as unknown as { rows: DiscoverRelease[] }

    return rows.rows ?? []
  } catch (error) {
    logger.error('discoverReleases failed', { error })
    return []
  }
}
