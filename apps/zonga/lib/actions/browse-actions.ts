/**
 * Zonga Server Actions — Browse / Discover (Listener-safe).
 *
 * These actions use resolveListenerContext() instead of resolveOrgContext(),
 * so they work for listeners who have no active organization selected.
 * They query only published / public content visible to all users.
 */
'use server'

import { resolveListenerContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { CatalogListResult } from './catalog-actions'
import type { PlaylistListResult } from './playlist-actions'
import type { SearchResult } from './search-actions'
import type { EventListResult } from './event-actions'

/* ─── Browse Published Assets ─── */

export async function browsePublishedAssets(opts?: {
  page?: number
  pageSize?: number
  search?: string
  type?: string
}): Promise<CatalogListResult> {
  await resolveListenerContext()

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 25
  const offset = (page - 1) * pageSize

  try {
    const searchFilter = opts?.search
      ? sql` AND LOWER(a.title) LIKE ${'%' + opts.search.toLowerCase() + '%'}`
      : sql``
    const typeFilter = opts?.type ? sql` AND a.type = ${opts.type}` : sql``

    const assets = (await platformDb.execute(
      sql`SELECT
        a.id,
        a.title,
        a.type,
        a.status,
        a.creator_id as "creatorId",
        c.display_name as "creatorName",
        a.duration_seconds as duration,
        a.genre,
        a.created_at as "createdAt"
      FROM zonga_content_assets a
      LEFT JOIN zonga_creators c ON c.id = a.creator_id
      WHERE a.status = 'published'
      ${searchFilter} ${typeFilter}
      ORDER BY a.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    )) as unknown as { rows: Array<Record<string, unknown>> }

    const [countResult] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_content_assets
      WHERE status = 'published'`,
    )) as unknown as [{ total: number }]

    const total = Number(countResult?.total ?? 0)
    return {
      assets: (assets.rows ?? assets) as unknown as CatalogListResult['assets'],
      total,
      hasMore: offset + pageSize < total,
    }
  } catch (error) {
    logger.error('browsePublishedAssets failed', { error })
    return { assets: [], total: 0, hasMore: false }
  }
}

/* ─── Browse Public Playlists ─── */

export async function browsePublicPlaylists(opts?: {
  page?: number
  search?: string
}): Promise<PlaylistListResult> {
  await resolveListenerContext()

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    const searchFilter = opts?.search
      ? sql` AND LOWER(p.title) LIKE ${'%' + opts.search.toLowerCase() + '%'}`
      : sql``

    const rows = (await platformDb.execute(
      sql`SELECT
        p.id,
        p.title,
        p.description,
        p.owner_type as "ownerType",
        p.owner_id as "ownerId",
        p.visibility,
        COALESCE((SELECT COUNT(*) FROM zonga_playlist_items WHERE playlist_id = p.id), 0)::int as "trackCount",
        p.created_at as "createdAt"
      FROM zonga_playlists p
      WHERE p.visibility = 'public'
      ${searchFilter}
      ORDER BY p.created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as Array<Record<string, unknown>>

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_playlists WHERE visibility = 'public'`,
    )) as unknown as [{ total: number }]

    return {
      playlists: rows as unknown as PlaylistListResult['playlists'],
      total: Number(cnt?.total ?? 0),
    }
  } catch (error) {
    logger.error('browsePublicPlaylists failed', { error })
    return { playlists: [], total: 0 }
  }
}

/* ─── Browse Trending ─── */

export async function browseTrending(): Promise<SearchResult[]> {
  await resolveListenerContext()

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        a.id,
        a.title,
        c.display_name as subtitle,
        a.genre,
        COUNT(f.id) as fav_count
      FROM zonga_content_assets a
      LEFT JOIN zonga_creators c ON c.id = a.creator_id
      LEFT JOIN zonga_listener_favorites f
        ON f.entity_id = a.id AND f.entity_type = 'asset'
        AND f.created_at >= NOW() - INTERVAL '30 days'
      WHERE a.status = 'published'
      GROUP BY a.id, a.title, c.display_name, a.genre
      ORDER BY fav_count DESC
      LIMIT 10`,
    )) as unknown as Array<{ id: string; title: string; subtitle: string; genre: string }>

    return rows.map((r) => ({
      ...r,
      type: 'asset' as const,
    }))
  } catch (error) {
    logger.error('browseTrending failed', { error })
    return []
  }
}

/* ─── Browse Published Events ─── */

export async function browsePublishedEvents(opts?: {
  page?: number
}): Promise<EventListResult> {
  await resolveListenerContext()

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        e.id,
        e.title,
        e.description,
        e.venue,
        e.city,
        e.country,
        e.starts_at as "startsAt",
        e.ends_at as "endsAt",
        e.status,
        e.image_url as "imageUrl",
        e.creator_id as "creatorId",
        c.display_name as "creatorName",
        e.created_at as "createdAt"
      FROM zonga_events e
      LEFT JOIN zonga_creators c ON c.id = e.creator_id
      WHERE e.status IN ('published', 'sold_out')
      ORDER BY e.starts_at ASC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as Array<Record<string, unknown>>

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_events WHERE status IN ('published', 'sold_out')`,
    )) as unknown as [{ total: number }]

    return {
      events: rows as unknown as EventListResult['events'],
      total: Number(cnt?.total ?? 0),
    }
  } catch (error) {
    logger.error('browsePublishedEvents failed', { error })
    return { events: [], total: 0 }
  }
}
