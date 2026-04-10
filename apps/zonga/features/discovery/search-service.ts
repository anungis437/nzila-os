/**
 * Zonga — Search Service
 *
 * Full-text search across tracks, artists, events, and releases.
 * Uses PostgreSQL full-text search with ranking.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { BrowseFilters, PaginatedResult } from '@/features/catalog/types'

export interface SearchResult {
  entityType: 'track' | 'artist' | 'event' | 'release'
  entityId: string
  title: string
  subtitle?: string
  imageUrl?: string
  relevanceScore: number
}

/**
 * Global search across all content types.
 */
export async function globalSearch(
  query: string,
  opts?: { limit?: number; entityType?: string },
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []

  const limit = opts?.limit ?? 25
  const sanitized = query.replace(/[^\w\s]/g, '')
  const tsQuery = sanitized.split(/\s+/).filter(Boolean).join(' & ')

  if (!tsQuery) return []

  const results: SearchResult[] = []

  // Search tracks
  if (!opts?.entityType || opts.entityType === 'track') {
    const trackRows = await platformDb.execute(sql`
      SELECT id, title, 'track' as entity_type,
             ts_rank(to_tsvector('english', COALESCE(title, '')), to_tsquery('english', ${tsQuery})) as score
      FROM zonga_content_assets
      WHERE status = 'published'
        AND to_tsvector('english', COALESCE(title, '')) @@ to_tsquery('english', ${tsQuery})
      ORDER BY score DESC
      LIMIT ${limit}
    `)
    for (const r of trackRows as unknown as Array<Record<string, unknown>>) {
      results.push({
        entityType: 'track',
        entityId: r.id as string,
        title: r.title as string,
        relevanceScore: Number(r.score),
      })
    }
  }

  // Search artists
  if (!opts?.entityType || opts.entityType === 'artist') {
    const artistRows = await platformDb.execute(sql`
      SELECT id, display_name as title, slug, avatar_url, 'artist' as entity_type,
             ts_rank(to_tsvector('english', COALESCE(display_name, '') || ' ' || COALESCE(bio, '')),
                     to_tsquery('english', ${tsQuery})) as score
      FROM zonga_artist_profiles
      WHERE to_tsvector('english', COALESCE(display_name, '') || ' ' || COALESCE(bio, ''))
            @@ to_tsquery('english', ${tsQuery})
      ORDER BY score DESC
      LIMIT ${limit}
    `)
    for (const r of artistRows as unknown as Array<Record<string, unknown>>) {
      results.push({
        entityType: 'artist',
        entityId: r.id as string,
        title: r.title as string,
        imageUrl: r.avatar_url as string | undefined,
        relevanceScore: Number(r.score),
      })
    }
  }

  // Search events
  if (!opts?.entityType || opts.entityType === 'event') {
    const eventRows = await platformDb.execute(sql`
      SELECT id, title, city, image_url, 'event' as entity_type,
             ts_rank(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '')),
                     to_tsquery('english', ${tsQuery})) as score
      FROM zonga_events
      WHERE status IN ('published', 'on_sale')
        AND to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
            @@ to_tsquery('english', ${tsQuery})
      ORDER BY score DESC
      LIMIT ${limit}
    `)
    for (const r of eventRows as unknown as Array<Record<string, unknown>>) {
      results.push({
        entityType: 'event',
        entityId: r.id as string,
        title: r.title as string,
        subtitle: r.city as string | undefined,
        imageUrl: r.image_url as string | undefined,
        relevanceScore: Number(r.score),
      })
    }
  }

  // Sort by relevance across all types
  results.sort((a, b) => b.relevanceScore - a.relevanceScore)

  // Record search signal for discovery
  logger.info('Global search executed', { query: sanitized, resultCount: results.length })

  return results.slice(0, limit)
}

/**
 * Browse tracks with filters (genre, region, language, sorting).
 */
export async function browseTracks(
  filters: BrowseFilters,
): Promise<PaginatedResult<{ id: string; title: string; artistName: string; genre?: string }>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 24
  const offset = (page - 1) * pageSize

  let orderBy = sql`ca.created_at DESC`
  if (filters.sortBy === 'popular') orderBy = sql`play_count DESC`
  if (filters.sortBy === 'trending') orderBy = sql`COALESCE(ts.score, 0) DESC`

  const rows = await platformDb.execute(sql`
    SELECT
      ca.id, ca.title,
      COALESCE(ap.display_name, 'Unknown') as artist_name,
      ap.genre,
      COALESCE(
        (SELECT COUNT(*)::int FROM zonga_playback_events pe WHERE pe.content_asset_id = ca.id),
        0
      ) as play_count,
      COALESCE(ts.score, 0) as trending_score
    FROM zonga_content_assets ca
    LEFT JOIN zonga_artist_profiles ap ON ap.creator_id = ca.creator_id
    LEFT JOIN zonga_trending_scores ts ON ts.entity_id = ca.id AND ts.entity_type = 'track'
    WHERE ca.status = 'published'
      ${filters.genre ? sql`AND ap.genre = ${filters.genre}` : sql``}
      ${filters.region ? sql`AND ap.country = ${filters.region}` : sql``}
    ORDER BY ${orderBy}
    LIMIT ${pageSize}
    OFFSET ${offset}
  `)

  const countRows = await platformDb.execute(sql`
    SELECT COUNT(*)::int as total
    FROM zonga_content_assets ca
    LEFT JOIN zonga_artist_profiles ap ON ap.creator_id = ca.creator_id
    WHERE ca.status = 'published'
      ${filters.genre ? sql`AND ap.genre = ${filters.genre}` : sql``}
      ${filters.region ? sql`AND ap.country = ${filters.region}` : sql``}
  `)
  const total = (countRows as unknown as Array<{ total: number }>)[0]?.total ?? 0

  return {
    items: (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      artistName: r.artist_name as string,
      genre: r.genre as string | undefined,
    })),
    total,
    page,
    pageSize,
    hasMore: offset + pageSize < total,
  }
}
