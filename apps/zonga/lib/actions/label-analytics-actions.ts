'use server'

import { sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { resolveOrgContext } from '@/lib/resolve-org'

export type LabelRangePreset = 'today' | '7d' | '30d' | 'custom'

export interface LabelDashboardData {
  range: { startIso: string; endIso: string; preset: LabelRangePreset }
  totals: {
    totalStreams: number
    uniqueListeners: number
    repeatListeners: number
    saves: number
    follows: number
    completionPct: number
    eventCampaignTraffic: number
  }
  topSongs: Array<{ title: string; streams: number }>
  topArtists: Array<{ artist: string; streams: number }>
  topCountries: Array<{ country: string; streams: number }>
  topCities: Array<{ city: string; streams: number }>
  sourceTraffic: Array<{ source: string; streams: number }>
  growth: Array<{ day: string; streams: number }>
}

function buildRange(preset: LabelRangePreset, start?: string, end?: string): { startIso: string; endIso: string } {
  const now = new Date()
  const endDate = end ? new Date(end) : now
  let startDate = new Date(endDate)

  if (preset === 'today') startDate.setHours(0, 0, 0, 0)
  if (preset === '7d') startDate = new Date(endDate.getTime() - 7 * 86_400_000)
  if (preset === '30d') startDate = new Date(endDate.getTime() - 30 * 86_400_000)
  if (preset === 'custom') {
    startDate = start ? new Date(start) : new Date(endDate.getTime() - 30 * 86_400_000)
  }

  return { startIso: startDate.toISOString(), endIso: endDate.toISOString() }
}

export async function getLabelDashboardData(input: {
  preset: LabelRangePreset
  start?: string
  end?: string
}): Promise<LabelDashboardData> {
  const ctx = await resolveOrgContext()
  const range = buildRange(input.preset, input.start, input.end)

  const [
    totalStreamsRows,
    uniqueRows,
    repeatRows,
    saveRows,
    followRows,
    completionRows,
    campaignRows,
    topSongsRows,
    topArtistsRows,
    topCountriesRows,
    topCitiesRows,
    sourceRows,
    growthRows,
  ] = await Promise.all([
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_revenue_events
      WHERE org_id = ${ctx.orgId}
        AND type = 'stream'
        AND occurred_at >= ${range.startIso}::timestamptz
        AND occurred_at <= ${range.endIso}::timestamptz
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(DISTINCT listener_id)::int as total
      FROM zonga_listener_activity
      WHERE org_id = ${ctx.orgId}
        AND activity_type = 'play'
        AND created_at >= ${range.startIso}::timestamptz
        AND created_at <= ${range.endIso}::timestamptz
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM (
        SELECT listener_id
        FROM zonga_listener_activity
        WHERE org_id = ${ctx.orgId}
          AND activity_type = 'play'
          AND created_at >= ${range.startIso}::timestamptz
          AND created_at <= ${range.endIso}::timestamptz
        GROUP BY listener_id
        HAVING COUNT(*) >= 2
      ) t
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_listener_favorites
      WHERE org_id = ${ctx.orgId}
        AND created_at >= ${range.startIso}::timestamptz
        AND created_at <= ${range.endIso}::timestamptz
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_listener_follows
      WHERE org_id = ${ctx.orgId}
        AND created_at >= ${range.startIso}::timestamptz
        AND created_at <= ${range.endIso}::timestamptz
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COALESCE(AVG(CASE WHEN completed THEN 1 ELSE 0 END), 0)::float as completion_rate
      FROM zonga_playback_events
      WHERE created_at >= ${range.startIso}::timestamptz
        AND created_at <= ${range.endIso}::timestamptz
    `) as Promise<Array<{ completion_rate: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_playback_events
      WHERE created_at >= ${range.startIso}::timestamptz
        AND created_at <= ${range.endIso}::timestamptz
        AND source = 'event_campaign'
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COALESCE(ca.title, re.asset_id::text) as title, COUNT(*)::int as streams
      FROM zonga_revenue_events re
      LEFT JOIN zonga_content_assets ca ON ca.id = re.asset_id
      WHERE re.org_id = ${ctx.orgId}
        AND re.type = 'stream'
        AND re.occurred_at >= ${range.startIso}::timestamptz
        AND re.occurred_at <= ${range.endIso}::timestamptz
      GROUP BY COALESCE(ca.title, re.asset_id::text)
      ORDER BY streams DESC
      LIMIT 10
    `) as Promise<Array<{ title: string; streams: number }>>,
    platformDb.execute(sql`
      SELECT COALESCE(c.display_name, re.creator_id::text) as artist, COUNT(*)::int as streams
      FROM zonga_revenue_events re
      LEFT JOIN zonga_creators c ON c.id = re.creator_id
      WHERE re.org_id = ${ctx.orgId}
        AND re.type = 'stream'
        AND re.occurred_at >= ${range.startIso}::timestamptz
        AND re.occurred_at <= ${range.endIso}::timestamptz
      GROUP BY COALESCE(c.display_name, re.creator_id::text)
      ORDER BY streams DESC
      LIMIT 10
    `) as Promise<Array<{ artist: string; streams: number }>>,
    platformDb.execute(sql`
      SELECT COALESCE(l.country, 'Unknown') as country, COUNT(*)::int as streams
      FROM zonga_listener_activity a
      LEFT JOIN zonga_listeners l ON l.id = a.listener_id
      WHERE a.org_id = ${ctx.orgId}
        AND a.activity_type = 'play'
        AND a.created_at >= ${range.startIso}::timestamptz
        AND a.created_at <= ${range.endIso}::timestamptz
      GROUP BY COALESCE(l.country, 'Unknown')
      ORDER BY streams DESC
      LIMIT 10
    `) as Promise<Array<{ country: string; streams: number }>>,
    platformDb.execute(sql`
      SELECT COALESCE(l.city, 'Unknown') as city, COUNT(*)::int as streams
      FROM zonga_listener_activity a
      LEFT JOIN zonga_listeners l ON l.id = a.listener_id
      WHERE a.org_id = ${ctx.orgId}
        AND a.activity_type = 'play'
        AND a.created_at >= ${range.startIso}::timestamptz
        AND a.created_at <= ${range.endIso}::timestamptz
      GROUP BY COALESCE(l.city, 'Unknown')
      ORDER BY streams DESC
      LIMIT 10
    `) as Promise<Array<{ city: string; streams: number }>>,
    platformDb.execute(sql`
      SELECT COALESCE(source, 'unknown') as source, COUNT(*)::int as streams
      FROM zonga_playback_events
      WHERE created_at >= ${range.startIso}::timestamptz
        AND created_at <= ${range.endIso}::timestamptz
      GROUP BY COALESCE(source, 'unknown')
      ORDER BY streams DESC
    `) as Promise<Array<{ source: string; streams: number }>>,
    platformDb.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('day', occurred_at), 'YYYY-MM-DD') as day, COUNT(*)::int as streams
      FROM zonga_revenue_events
      WHERE org_id = ${ctx.orgId}
        AND type = 'stream'
        AND occurred_at >= ${range.startIso}::timestamptz
        AND occurred_at <= ${range.endIso}::timestamptz
      GROUP BY DATE_TRUNC('day', occurred_at)
      ORDER BY day ASC
    `) as Promise<Array<{ day: string; streams: number }>>,
  ])

  return {
    range: { ...range, preset: input.preset },
    totals: {
      totalStreams: Number(totalStreamsRows[0]?.total ?? 0),
      uniqueListeners: Number(uniqueRows[0]?.total ?? 0),
      repeatListeners: Number(repeatRows[0]?.total ?? 0),
      saves: Number(saveRows[0]?.total ?? 0),
      follows: Number(followRows[0]?.total ?? 0),
      completionPct: Number(completionRows[0]?.completion_rate ?? 0) * 100,
      eventCampaignTraffic: Number(campaignRows[0]?.total ?? 0),
    },
    topSongs: topSongsRows,
    topArtists: topArtistsRows,
    topCountries: topCountriesRows,
    topCities: topCitiesRows,
    sourceTraffic: sourceRows,
    growth: growthRows,
  }
}
