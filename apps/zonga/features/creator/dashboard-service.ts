/**
 * Zonga — Creator Dashboard Service
 *
 * Aggregates data for the creator dashboard: tracks, releases,
 * earnings, events, and rights status.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import type {
  CreatorProfile,
  CreatorDashboardData,
  CreatorTrackSummary,
  CreatorReleaseSummary,
  CreatorEarningsSummary,
  CreatorEventSummary,
  RightsStatusSummary,
} from './types'

/**
 * Load the full creator dashboard data in a single call.
 */
export async function getCreatorDashboard(
  creatorId: string,
  orgId: string,
): Promise<CreatorDashboardData | null> {
  const [profile, tracks, releases, earnings, events, rightsStatus] = await Promise.all([
    getCreatorProfile(creatorId, orgId),
    getCreatorTracks(creatorId, orgId),
    getCreatorReleases(creatorId, orgId),
    getCreatorEarnings(creatorId, orgId),
    getCreatorEvents(creatorId, orgId),
    getCreatorRightsStatus(creatorId, orgId),
  ])

  if (!profile) return null

  return { profile, tracks, releases, earnings, events, rightsStatus }
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function getCreatorProfile(
  creatorId: string,
  orgId: string,
): Promise<CreatorProfile | null> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_artist_profiles
    WHERE creator_id = ${creatorId} AND org_id = ${orgId}
    LIMIT 1
  `)
  const row = (rows as unknown as Array<Record<string, unknown>>)[0]
  if (!row) return null

  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    orgId: row.org_id as string,
    displayName: row.display_name as string,
    slug: row.slug as string | undefined,
    bio: row.bio as string | undefined,
    genre: row.genre as string | undefined,
    subGenres: (row.sub_genres as string[]) ?? [],
    country: row.country as string | undefined,
    city: row.city as string | undefined,
    languages: (row.languages as string[]) ?? [],
    websiteUrl: row.website_url as string | undefined,
    socialLinks: (row.social_links as Record<string, string>) ?? {},
    avatarUrl: row.avatar_url as string | undefined,
    bannerUrl: row.banner_url as string | undefined,
    isVerified: row.is_verified as boolean,
    followerCount: row.follower_count as number,
    trackCount: row.track_count as number,
    monthlyListeners: row.monthly_listeners as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

/**
 * Create or update an artist profile for a creator.
 */
export async function upsertArtistProfile(params: {
  creatorId: string
  orgId: string
  displayName: string
  bio?: string
  genre?: string
  country?: string
  city?: string
  languages?: string[]
  websiteUrl?: string
  socialLinks?: Record<string, string>
}): Promise<{ ok: boolean; profileId: string }> {
  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_artist_profiles (
      creator_id, org_id, display_name, bio, genre,
      country, city, languages, website_url, social_links,
      slug
    ) VALUES (
      ${params.creatorId}, ${params.orgId}, ${params.displayName},
      ${params.bio ?? null}, ${params.genre ?? null},
      ${params.country ?? null}, ${params.city ?? null},
      ${JSON.stringify(params.languages ?? [])},
      ${params.websiteUrl ?? null},
      ${JSON.stringify(params.socialLinks ?? {})}::jsonb,
      ${params.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}
    )
    ON CONFLICT (creator_id, org_id)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio,
      genre = EXCLUDED.genre,
      country = EXCLUDED.country,
      city = EXCLUDED.city,
      languages = EXCLUDED.languages,
      website_url = EXCLUDED.website_url,
      social_links = EXCLUDED.social_links,
      updated_at = now()
    RETURNING id
  `)
  const profileId = (rows as unknown as Array<{ id: string }>)[0].id
  return { ok: true, profileId }
}

// ── Tracks ──────────────────────────────────────────────────────────────────

async function getCreatorTracks(
  creatorId: string,
  orgId: string,
): Promise<CreatorTrackSummary[]> {
  const rows = await platformDb.execute(sql`
    SELECT
      ca.id,
      ca.title,
      ca.status,
      ca.created_at as uploaded_at,
      COALESCE(
        (SELECT COUNT(*)::int FROM zonga_playback_events pe WHERE pe.content_asset_id = ca.id),
        0
      ) as total_plays,
      COALESCE(
        (SELECT SUM(ee.creator_net) FROM zonga_earnings_entries ee
         WHERE ee.source_entity_id = ca.id AND ee.creator_id = ${creatorId}),
        0
      )::numeric as revenue
    FROM zonga_content_assets ca
    WHERE ca.creator_id = ${creatorId} AND ca.org_id = ${orgId}
    ORDER BY ca.created_at DESC
    LIMIT 100
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    status: r.status as CreatorTrackSummary['status'],
    totalPlays: r.total_plays as number,
    revenue: Number(r.revenue ?? 0),
    currency: 'USD',
    uploadedAt: new Date(r.uploaded_at as string),
  }))
}

// ── Releases ────────────────────────────────────────────────────────────────

async function getCreatorReleases(
  creatorId: string,
  orgId: string,
): Promise<CreatorReleaseSummary[]> {
  const rows = await platformDb.execute(sql`
    SELECT
      r.id,
      r.title,
      r.type,
      r.status,
      r.release_date,
      (SELECT COUNT(*)::int FROM zonga_release_tracks rt WHERE rt.release_id = r.id) as track_count,
      0 as total_plays
    FROM zonga_releases r
    WHERE r.creator_id = ${creatorId} AND r.org_id = ${orgId}
    ORDER BY r.created_at DESC
    LIMIT 50
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    type: r.type as 'single' | 'ep' | 'album',
    status: r.status as string,
    trackCount: r.track_count as number,
    totalPlays: r.total_plays as number,
    releaseDate: r.release_date ? new Date(r.release_date as string) : undefined,
  }))
}

// ── Earnings ────────────────────────────────────────────────────────────────

async function getCreatorEarnings(
  creatorId: string,
  orgId: string,
): Promise<CreatorEarningsSummary> {
  const rows = await platformDb.execute(sql`
    SELECT
      COALESCE(SUM(creator_net), 0)::numeric as total_earned,
      COALESCE(SUM(creator_net) FILTER (WHERE status = 'pending'), 0)::numeric as pending,
      COALESCE(SUM(creator_net) FILTER (WHERE status = 'available'), 0)::numeric as available,
      COALESCE(SUM(creator_net) FILTER (WHERE status = 'paid'), 0)::numeric as paid
    FROM zonga_earnings_entries
    WHERE creator_id = ${creatorId} AND org_id = ${orgId}
  `)
  const row = (rows as unknown as Array<Record<string, unknown>>)[0]

  const bySourceRows = await platformDb.execute(sql`
    SELECT source_type, COALESCE(SUM(creator_net), 0)::numeric as total
    FROM zonga_earnings_entries
    WHERE creator_id = ${creatorId} AND org_id = ${orgId}
    GROUP BY source_type
  `)

  const earningsBySource: Record<string, number> = {}
  for (const r of bySourceRows as unknown as Array<Record<string, unknown>>) {
    earningsBySource[r.source_type as string] = Number(r.total ?? 0)
  }

  // Last payout date
  const payoutRows = await platformDb.execute(sql`
    SELECT processed_at FROM zonga_payout_requests
    WHERE creator_id = ${creatorId} AND status = 'completed'
    ORDER BY processed_at DESC LIMIT 1
  `)
  const lastPayout = (payoutRows as unknown as Array<Record<string, unknown>>)[0]

  return {
    totalEarned: Number(row?.total_earned ?? 0),
    pendingBalance: Number(row?.pending ?? 0),
    availableBalance: Number(row?.available ?? 0),
    paidOut: Number(row?.paid ?? 0),
    currency: 'USD',
    lastPayoutDate: lastPayout?.processed_at
      ? new Date(lastPayout.processed_at as string)
      : undefined,
    earningsBySource,
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

async function getCreatorEvents(
  creatorId: string,
  _orgId: string,
): Promise<CreatorEventSummary[]> {
  const rows = await platformDb.execute(sql`
    SELECT
      ea.event_id,
      e.title as event_title,
      ea.role,
      e.starts_at as date,
      COALESCE(
        (SELECT SUM(quantity)::int FROM zonga_ticket_orders
         WHERE event_id = ea.event_id AND status = 'confirmed'),
        0
      ) as tickets_sold
    FROM zonga_event_artists ea
    JOIN zonga_events e ON e.id = ea.event_id
    WHERE ea.artist_id = ${creatorId}
    ORDER BY e.starts_at DESC
    LIMIT 20
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    eventId: r.event_id as string,
    eventTitle: r.event_title as string,
    role: r.role as string,
    date: new Date(r.date as string),
    ticketsSold: r.tickets_sold as number,
  }))
}

// ── Rights Status ───────────────────────────────────────────────────────────

async function getCreatorRightsStatus(
  creatorId: string,
  _orgId: string,
): Promise<RightsStatusSummary> {
  const rows = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status IN ('filed', 'under_review'))::int as active,
      COUNT(*) FILTER (WHERE status IN ('upheld', 'rejected', 'withdrawn'))::int as resolved,
      COUNT(*) FILTER (WHERE status = 'escalated')::int as disputes
    FROM zonga_rights_claims
    WHERE claimant_id = ${creatorId}
  `)
  const row = (rows as unknown as Array<Record<string, unknown>>)[0]

  return {
    totalClaims: (row?.total as number) ?? 0,
    activeClaims: (row?.active as number) ?? 0,
    resolvedClaims: (row?.resolved as number) ?? 0,
    pendingDisputes: (row?.disputes as number) ?? 0,
  }
}
