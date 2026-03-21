/**
 * Zonga — Public Data Access
 *
 * Read-only queries for public marketing pages.
 * No auth context required — only exposes published/public data.
 */
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

// ── Types ──────────────────────────────────────────────────────────────────

export interface PublicArtist {
  id: string
  name: string
  genre: string | null
  country: string | null
  bio: string | null
  avatarUrl: string | null
  followerCount: number
  releaseCount: number
}

export interface PublicRelease {
  id: string
  title: string
  releaseType: string
  coverArtUrl: string | null
  releaseDate: string | null
  trackCount: number
  creatorId: string
  creatorName: string
}

export interface PublicEvent {
  id: string
  title: string
  description: string | null
  venue: string | null
  city: string | null
  country: string | null
  startDate: string
  endDate: string | null
  coverImageUrl: string | null
  creatorName: string
  ticketCount: number
}

// ── Artists ─────────────────────────────────────────────────────────────────

export async function getPublicArtists(opts?: {
  genre?: string
  country?: string
  limit?: number
}): Promise<PublicArtist[]> {
  const limit = opts?.limit ?? 50

  const genreFilter = opts?.genre
    ? sql` AND c.genre = ${opts.genre}`
    : sql``
  const countryFilter = opts?.country
    ? sql` AND c.country = ${opts.country}`
    : sql``

  const rows = (await platformDb.execute(sql`
    SELECT
      c.id,
      c.display_name AS name,
      c.genre,
      c.country,
      c.bio,
      c.avatar_url AS "avatarUrl",
      (SELECT COUNT(*) FROM zonga_listener_follows f WHERE f.creator_id = c.id) AS "followerCount",
      (SELECT COUNT(*) FROM zonga_releases r WHERE r.creator_id = c.id AND r.status = 'published') AS "releaseCount"
    FROM zonga_creators c
    WHERE c.status = 'active'
    ${genreFilter}
    ${countryFilter}
    ORDER BY "followerCount" DESC, c.display_name ASC
    LIMIT ${limit}
  `)) as unknown as { rows: PublicArtist[] }

  return (rows.rows ?? []).map((r) => ({
    ...r,
    followerCount: Number(r.followerCount),
    releaseCount: Number(r.releaseCount),
  }))
}

export async function getPublicArtistProfile(
  creatorId: string,
): Promise<{ artist: PublicArtist | null; releases: PublicRelease[] }> {
  const [artist] = (await platformDb.execute(sql`
    SELECT
      c.id,
      c.display_name AS name,
      c.genre,
      c.country,
      c.bio,
      c.avatar_url AS "avatarUrl",
      (SELECT COUNT(*) FROM zonga_listener_follows f WHERE f.creator_id = c.id) AS "followerCount",
      (SELECT COUNT(*) FROM zonga_releases r WHERE r.creator_id = c.id AND r.status = 'published') AS "releaseCount"
    FROM zonga_creators c
    WHERE c.id = ${creatorId} AND c.status = 'active'
    LIMIT 1
  `)) as unknown as [PublicArtist | undefined]

  if (!artist) return { artist: null, releases: [] }

  const releases = (await platformDb.execute(sql`
    SELECT
      r.id,
      r.title,
      r.release_type AS "releaseType",
      r.cover_art_url AS "coverArtUrl",
      r.release_date AS "releaseDate",
      (SELECT COUNT(*) FROM zonga_release_tracks rt WHERE rt.release_id = r.id) AS "trackCount",
      r.creator_id AS "creatorId",
      c.display_name AS "creatorName"
    FROM zonga_releases r
    JOIN zonga_creators c ON c.id = r.creator_id
    WHERE r.creator_id = ${creatorId} AND r.status = 'published'
    ORDER BY r.release_date DESC NULLS LAST
  `)) as unknown as { rows: PublicRelease[] }

  return {
    artist: {
      ...artist,
      followerCount: Number(artist.followerCount),
      releaseCount: Number(artist.releaseCount),
    },
    releases: (releases.rows ?? []).map((r) => ({
      ...r,
      trackCount: Number(r.trackCount),
    })),
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

export async function getPublicEvents(opts?: {
  limit?: number
  upcoming?: boolean
}): Promise<PublicEvent[]> {
  const limit = opts?.limit ?? 20
  const dateFilter = opts?.upcoming !== false
    ? sql` AND e.starts_at >= now()`
    : sql``

  const rows = (await platformDb.execute(sql`
    SELECT
      e.id,
      e.title,
      e.description,
      e.venue,
      e.city,
      e.country,
      e.starts_at AS "startDate",
      e.ends_at AS "endDate",
      e.image_url AS "coverImageUrl",
      c.display_name AS "creatorName",
      (SELECT COUNT(*) FROM zonga_ticket_types tt WHERE tt.event_id = e.id) AS "ticketCount"
    FROM zonga_events e
    JOIN zonga_creators c ON c.id = e.creator_id
    WHERE e.status = 'published'
    ${dateFilter}
    ORDER BY e.starts_at ASC
    LIMIT ${limit}
  `)) as unknown as { rows: PublicEvent[] }

  return (rows.rows ?? []).map((r) => ({
    ...r,
    ticketCount: Number(r.ticketCount),
  }))
}

// ── Genre/Country facets ────────────────────────────────────────────────────

export async function getArtistFacets(): Promise<{
  genres: string[]
  countries: string[]
}> {
  const genreRows = (await platformDb.execute(sql`
    SELECT DISTINCT genre FROM zonga_creators
    WHERE status = 'active' AND genre IS NOT NULL
    ORDER BY genre
  `)) as unknown as { rows: { genre: string }[] }

  const countryRows = (await platformDb.execute(sql`
    SELECT DISTINCT country FROM zonga_creators
    WHERE status = 'active' AND country IS NOT NULL
    ORDER BY country
  `)) as unknown as { rows: { country: string }[] }

  return {
    genres: (genreRows.rows ?? []).map((r) => r.genre),
    countries: (countryRows.rows ?? []).map((r) => r.country),
  }
}
