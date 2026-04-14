/**
 * Control Plane — Streaming Data Fetcher
 *
 * Server-side functions for the streaming dashboard.
 * Queries Zonga tables for live streams, media jobs, and aggregates.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

export interface StreamingSummary {
  totalStreams: number
  activeStreams: number
  totalMediaJobs: number
  completedJobs: number
  failedJobs: number
  totalVariants: number
}

export interface LiveStreamRow {
  id: string
  orgId: string
  eventId: string
  creatorId: string
  provider: string
  status: string
  scheduledStart: string | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string
}

export interface MediaJobRow {
  id: string
  orgId: string
  contentAssetId: string
  provider: string
  jobType: string
  status: string
  submittedAt: string | null
  completedAt: string | null
  errorSummary: string | null
  createdAt: string
}

export interface RecentStreamEvent {
  id: string
  eventType: string
  orgId: string
  liveStreamId: string | null
  createdAt: string
}

export async function getStreamingSummary(): Promise<StreamingSummary> {
  try {
    const streamRows = await platformDb.execute(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status IN ('live', 'ready'))::int as active
      FROM zonga_live_streams
    `)
    const stream = (streamRows as unknown as Array<Record<string, unknown>>)[0]

    const jobRows = await platformDb.execute(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int as failed
      FROM zonga_media_jobs
    `)
    const job = (jobRows as unknown as Array<Record<string, unknown>>)[0]

    const variantRows = await platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_media_variants
      WHERE status = 'ready'
    `)
    const variant = (variantRows as unknown as Array<Record<string, unknown>>)[0]

    return {
      totalStreams: (stream?.total as number) ?? 0,
      activeStreams: (stream?.active as number) ?? 0,
      totalMediaJobs: (job?.total as number) ?? 0,
      completedJobs: (job?.completed as number) ?? 0,
      failedJobs: (job?.failed as number) ?? 0,
      totalVariants: (variant?.total as number) ?? 0,
    }
  } catch {
    // Tables may not exist yet — return zeros
    return {
      totalStreams: 0,
      activeStreams: 0,
      totalMediaJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalVariants: 0,
    }
  }
}

export async function getRecentLiveStreams(limit = 20): Promise<LiveStreamRow[]> {
  try {
    const rows = await platformDb.execute(sql`
      SELECT id, org_id, event_id, creator_id, provider, status,
             scheduled_start, started_at, ended_at, created_at
      FROM zonga_live_streams
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      orgId: r.org_id as string,
      eventId: r.event_id as string,
      creatorId: r.creator_id as string,
      provider: r.provider as string,
      status: r.status as string,
      scheduledStart: r.scheduled_start as string | null,
      startedAt: r.started_at as string | null,
      endedAt: r.ended_at as string | null,
      createdAt: r.created_at as string,
    }))
  } catch {
    return []
  }
}

export async function getRecentMediaJobs(limit = 20): Promise<MediaJobRow[]> {
  try {
    const rows = await platformDb.execute(sql`
      SELECT id, org_id, content_asset_id, provider, job_type, status,
             submitted_at, completed_at, error_summary, created_at
      FROM zonga_media_jobs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      orgId: r.org_id as string,
      contentAssetId: r.content_asset_id as string,
      provider: r.provider as string,
      jobType: r.job_type as string,
      status: r.status as string,
      submittedAt: r.submitted_at as string | null,
      completedAt: r.completed_at as string | null,
      errorSummary: r.error_summary as string | null,
      createdAt: r.created_at as string,
    }))
  } catch {
    return []
  }
}

export async function getRecentStreamEvents(limit = 30): Promise<RecentStreamEvent[]> {
  try {
    const rows = await platformDb.execute(sql`
      SELECT id, event_type, org_id, live_stream_id, created_at
      FROM zonga_stream_events
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      eventType: r.event_type as string,
      orgId: r.org_id as string,
      liveStreamId: r.live_stream_id as string | null,
      createdAt: r.created_at as string,
    }))
  } catch {
    return []
  }
}
