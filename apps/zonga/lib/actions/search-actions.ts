/**
 * Zonga Server Actions — Search & Discovery.
 *
 * Global search across assets, creators, events, and playlists.
 * All searches query dedicated domain tables.
 */
'use server'

import { auth } from '@clerk/nextjs/server'
import { resolveListenerContext, resolveListenerUUID } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

/* ─── Types ─── */

export interface SearchResult {
  id: string
  type: 'asset' | 'creator' | 'event' | 'playlist'
  title: string
  subtitle?: string
  status?: string
  genre?: string
  createdAt?: Date
}

export interface SearchResults {
  assets: SearchResult[]
  creators: SearchResult[]
  events: SearchResult[]
  playlists: SearchResult[]
  total: number
}

/* ─── Global Search ─── */

export async function globalSearch(query: string): Promise<SearchResults> {
  await auth()
  await resolveListenerContext()

  if (!query || query.trim().length < 2) {
    return { assets: [], creators: [], events: [], playlists: [], total: 0 }
  }

  const pattern = `%${query.trim().toLowerCase()}%`

  try {
    // Search assets
    const assetRows = (await platformDb.execute(
      sql`SELECT
        a.id,
        a.title,
        c.display_name as subtitle,
        a.status,
        a.genre,
        a.created_at as "createdAt"
      FROM zonga_content_assets a
      LEFT JOIN zonga_creators c ON c.id = a.creator_id
      WHERE a.status = 'published'
        AND (
          LOWER(a.title) LIKE ${pattern}
          OR LOWER(c.display_name) LIKE ${pattern}
          OR LOWER(a.genre) LIKE ${pattern}
        )
      ORDER BY a.created_at DESC
      LIMIT 20`,
    )) as unknown as Omit<SearchResult, 'type'>[]

    // Search creators
    const creatorRows = (await platformDb.execute(
      sql`SELECT
        id,
        display_name as title,
        genre as subtitle,
        status,
        genre,
        created_at as "createdAt"
      FROM zonga_creators
      WHERE status = 'active'
        AND (
          LOWER(display_name) LIKE ${pattern}
          OR LOWER(genre) LIKE ${pattern}
          OR LOWER(country) LIKE ${pattern}
        )
      ORDER BY created_at DESC
      LIMIT 20`,
    )) as unknown as Omit<SearchResult, 'type'>[]

    // Search events
    const eventRows = (await platformDb.execute(
      sql`SELECT
        id,
        title,
        venue as subtitle,
        status,
        NULL as genre,
        created_at as "createdAt"
      FROM zonga_events
      WHERE status = 'published'
        AND (
          LOWER(title) LIKE ${pattern}
          OR LOWER(venue) LIKE ${pattern}
          OR LOWER(city) LIKE ${pattern}
        )
      ORDER BY created_at DESC
      LIMIT 20`,
    )) as unknown as Omit<SearchResult, 'type'>[]

    // Search playlists
    const playlistRows = (await platformDb.execute(
      sql`SELECT
        id,
        title,
        description as subtitle,
        visibility as status,
        NULL as genre,
        created_at as "createdAt"
      FROM zonga_playlists
      WHERE visibility = 'public'
        AND (
          LOWER(title) LIKE ${pattern}
          OR LOWER(description) LIKE ${pattern}
        )
      ORDER BY created_at DESC
      LIMIT 20`,
    )) as unknown as Omit<SearchResult, 'type'>[]

    const assets = assetRows.map((r) => ({ ...r, type: 'asset' as const }))
    const creators = creatorRows.map((r) => ({ ...r, type: 'creator' as const }))
    const events = eventRows.map((r) => ({ ...r, type: 'event' as const }))
    const playlists = playlistRows.map((r) => ({ ...r, type: 'playlist' as const }))

    return {
      assets,
      creators,
      events,
      playlists,
      total: assets.length + creators.length + events.length + playlists.length,
    }
  } catch (error) {
    logger.error('globalSearch failed', { error })
    return { assets: [], creators: [], events: [], playlists: [], total: 0 }
  }
}

/* ─── Trending / Featured ─── */

export async function getTrending(): Promise<SearchResult[]> {
  await resolveListenerContext()

  try {
    // Assets with most favorites in the last 30 days
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
    logger.error('getTrending failed', { error })
    return []
  }
}

/* ─── Recently Played ─── */

export async function getRecentlyPlayed(): Promise<SearchResult[]> {
  const ctx = await resolveListenerContext()

  try {
    const listenerId = await resolveListenerUUID(ctx)
    const rows = (await platformDb.execute(
      sql`SELECT
        a.id,
        a.title,
        c.display_name as subtitle,
        a.genre,
        la.created_at as "createdAt"
      FROM zonga_listener_activity la
      JOIN zonga_content_assets a ON a.id = la.entity_id
      LEFT JOIN zonga_creators c ON c.id = a.creator_id
      WHERE la.listener_id = ${listenerId}
        AND la.activity_type = 'stream'
        AND la.entity_type = 'asset'
      ORDER BY la.created_at DESC
      LIMIT 20`,
    )) as unknown as Omit<SearchResult, 'type'>[]

    return rows.map((r) => ({ ...r, type: 'asset' as const }))
  } catch (error) {
    logger.error('getRecentlyPlayed failed', { error })
    return []
  }
}
