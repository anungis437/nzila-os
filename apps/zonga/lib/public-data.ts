/**
 * Zonga — Public Data Access
 *
 * Read-only queries for public marketing pages.
 * No auth context required — only exposes published/public data.
 * Falls back to demo data when the database is empty or unavailable.
 */
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import {
  demoArtists,
  demoEvents,
  demoReleases,
  demoGenres,
  demoCountries,
} from './demo-data'

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

  try {
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
    `)) as unknown as PublicArtist[]

    const result = rows.map((r) => ({
      ...r,
      followerCount: Number(r.followerCount),
      releaseCount: Number(r.releaseCount),
    }))

    if (result.length > 0) return result
  } catch {
    // DB unavailable — fall through to demo data
  }

  // Demo fallback
  let filtered = demoArtists
  if (opts?.genre) filtered = filtered.filter((a) => a.genre === opts.genre)
  if (opts?.country) filtered = filtered.filter((a) => a.country === opts.country)
  return filtered.slice(0, limit)
}

export async function getPublicArtistProfile(
  creatorId: string,
): Promise<{ artist: PublicArtist | null; releases: PublicRelease[] }> {
  try {
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

    if (artist) {
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
      `)) as unknown as PublicRelease[]

      return {
        artist: {
          ...artist,
          followerCount: Number(artist.followerCount),
          releaseCount: Number(artist.releaseCount),
        },
        releases: releases.map((r) => ({
          ...r,
          trackCount: Number(r.trackCount),
        })),
      }
    }
  } catch {
    // DB unavailable — fall through to demo data
  }

  // Demo fallback
  const demoArtist = demoArtists.find((a) => a.id === creatorId) ?? null
  return {
    artist: demoArtist,
    releases: demoReleases[creatorId] ?? [],
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

export async function getPublicEvents(opts?: {
  limit?: number
  upcoming?: boolean
}): Promise<PublicEvent[]> {
  const limit = opts?.limit ?? 20

  try {
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
    `)) as unknown as PublicEvent[]

    const result = rows.map((r) => ({
      ...r,
      ticketCount: Number(r.ticketCount),
    }))

    if (result.length > 0) return result
  } catch {
    // DB unavailable — fall through to demo data
  }

  // Demo fallback
  const now = new Date()
  let filtered = demoEvents
  if (opts?.upcoming !== false) {
    filtered = filtered.filter((e) => new Date(e.startDate) >= now)
  }
  return filtered.slice(0, limit)
}

// ── Genre/Country facets ────────────────────────────────────────────────────

export async function getArtistFacets(): Promise<{
  genres: string[]
  countries: string[]
}> {
  try {
    const genreRows = (await platformDb.execute(sql`
      SELECT DISTINCT genre FROM zonga_creators
      WHERE status = 'active' AND genre IS NOT NULL
      ORDER BY genre
    `)) as unknown as { genre: string }[]

    const countryRows = (await platformDb.execute(sql`
      SELECT DISTINCT country FROM zonga_creators
      WHERE status = 'active' AND country IS NOT NULL
      ORDER BY country
    `)) as unknown as { country: string }[]

    const genres = genreRows.map((r) => r.genre)
    const countries = countryRows.map((r) => r.country)

    if (genres.length > 0 || countries.length > 0) {
      return { genres, countries }
    }
  } catch {
    // DB unavailable — fall through to demo data
  }

  return { genres: demoGenres, countries: demoCountries }
}
