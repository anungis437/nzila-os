/**
 * Zonga — Ranking Service
 *
 * Computes ranking scores for catalog display surfaces:
 * - Home feed composition
 * - Genre/region rankings
 * - Featured content curation
 * - New releases
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import type { HomeFeedSection, HomeFeedItem } from '@/features/catalog/types'

/**
 * Build the home feed for a listener.
 * Combines: featured, trending, new releases, upcoming events, editorial.
 */
export async function buildHomeFeed(opts?: {
  listenerId?: string
  region?: string
  limit?: number
}): Promise<HomeFeedSection[]> {
  const sections: HomeFeedSection[] = []
  const itemLimit = opts?.limit ?? 12

  // 1. Featured / Hero
  const featured = await getFeaturedContent('hero', itemLimit)
  if (featured.length > 0) {
    sections.push({
      id: 'featured',
      type: 'featured',
      title: 'Featured',
      items: featured,
    })
  }

  // 2. Trending tracks
  const trending = await getTrendingItems('track', itemLimit)
  if (trending.length > 0) {
    sections.push({
      id: 'trending',
      type: 'trending',
      title: 'Trending Now',
      subtitle: 'What Africa is listening to',
      items: trending,
    })
  }

  // 3. New releases
  const newReleases = await getNewReleases(itemLimit)
  if (newReleases.length > 0) {
    sections.push({
      id: 'new-releases',
      type: 'new_releases',
      title: 'New Releases',
      subtitle: 'Fresh from creators',
      items: newReleases,
    })
  }

  // 4. Upcoming events
  const events = await getUpcomingEvents(opts?.region, itemLimit)
  if (events.length > 0) {
    sections.push({
      id: 'upcoming-events',
      type: 'events',
      title: 'Upcoming Events',
      subtitle: 'Live experiences near you',
      items: events,
    })
  }

  // 5. Editorial spotlight
  const editorial = await getFeaturedContent('editorial', itemLimit)
  if (editorial.length > 0) {
    sections.push({
      id: 'editorial',
      type: 'editorial',
      title: 'Cultural Spotlight',
      items: editorial,
    })
  }

  // 6. Genre picks
  const genrePick = await getFeaturedContent('genre_pick', itemLimit)
  if (genrePick.length > 0) {
    sections.push({
      id: 'genre-picks',
      type: 'genre_pick',
      title: 'Genre Spotlight',
      items: genrePick,
    })
  }

  return sections
}

// ── Data Fetchers ───────────────────────────────────────────────────────────

async function getFeaturedContent(
  placement: string,
  limit: number,
): Promise<HomeFeedItem[]> {
  const rows = await platformDb.execute(sql`
    SELECT entity_type, entity_id, title, subtitle, image_url
    FROM zonga_featured_content
    WHERE is_active = true
      AND placement = ${placement}
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now())
    ORDER BY sort_order, created_at DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    entityType: r.entity_type as HomeFeedItem['entityType'],
    entityId: r.entity_id as string,
    title: r.title as string,
    subtitle: r.subtitle as string | undefined,
    imageUrl: r.image_url as string | undefined,
  }))
}

async function getTrendingItems(
  entityType: string,
  limit: number,
): Promise<HomeFeedItem[]> {
  const rows = await platformDb.execute(sql`
    SELECT ts.entity_id, ts.entity_type, ca.title, ap.display_name as subtitle
    FROM zonga_trending_scores ts
    LEFT JOIN zonga_content_assets ca ON ca.id = ts.entity_id AND ts.entity_type = 'track'
    LEFT JOIN zonga_artist_profiles ap ON ap.creator_id = ca.creator_id
    WHERE ts.entity_type = ${entityType}
      AND ts.score > 0
    ORDER BY ts.score DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    entityType: r.entity_type as HomeFeedItem['entityType'],
    resourceId: r.entity_id as string,
    title: (r.title as string) ?? 'Unknown',
    subtitle: r.subtitle as string | undefined,
  }))
}

async function getNewReleases(limit: number): Promise<HomeFeedItem[]> {
  const rows = await platformDb.execute(sql`
    SELECT r.id, r.title, r.type, ap.display_name as artist_name
    FROM zonga_releases r
    LEFT JOIN zonga_artist_profiles ap ON ap.creator_id = r.creator_id
    WHERE r.status = 'published'
      AND r.release_date >= CURRENT_DATE - 30
    ORDER BY r.release_date DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    entityType: 'release' as const,
    resourceId: r.id as string,
    title: r.title as string,
    subtitle: r.artist_name as string | undefined,
    metadata: { type: r.type },
  }))
}

async function getUpcomingEvents(
  region: string | undefined,
  limit: number,
): Promise<HomeFeedItem[]> {
  const regionFilter = region ? sql`AND e.country = ${region}` : sql``

  const rows = await platformDb.execute(sql`
    SELECT e.id, e.title, e.city, e.country, e.starts_at, e.image_url
    FROM zonga_events e
    WHERE e.status IN ('published', 'on_sale')
      AND e.starts_at > now()
      ${regionFilter}
    ORDER BY e.starts_at ASC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    entityType: 'event' as const,
    resourceId: r.id as string,
    title: r.title as string,
    subtitle: `${r.city}, ${r.country}`,
    imageUrl: r.image_url as string | undefined,
    metadata: { startsAt: r.starts_at },
  }))
}
