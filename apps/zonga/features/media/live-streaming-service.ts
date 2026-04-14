/**
 * Zonga — Live Streaming Service
 *
 * Orchestrates live stream lifecycle:
 * - DB record management (source of truth)
 * - AWS IVS provisioning (delivery substrate)
 * - Credential management
 * - Entitlement-gated playback
 * - Audit event emission
 *
 * Zonga's event/entitlement model is authoritative.
 * AWS resources are created/destroyed as side-effects.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { LiveStreamStatus, StreamEventType } from '@nzila/zonga-streaming-aws'

// ── Types ───────────────────────────────────────────────────────────────────

export interface LiveStream {
  id: string
  orgId: string
  eventId: string
  creatorId: string
  provider: string
  providerChannelId: string | null
  ingestEndpoint: string | null
  playbackReference: string | null
  status: LiveStreamStatus
  scheduledStart: string | null
  scheduledEnd: string | null
  startedAt: string | null
  endedAt: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateLiveStreamInput {
  orgId: string
  eventId: string
  creatorId: string
  scheduledStart?: string
  scheduledEnd?: string
  metadata?: Record<string, unknown>
}

export interface IngestDetails {
  ingestEndpoint: string
  rtmpUrl: string
  streamKeyRef: string
}

export interface ViewerPlaybackGrant {
  ok: boolean
  playbackUrl?: string
  status: LiveStreamStatus
  error?: string
}

// ── Live Stream CRUD ────────────────────────────────────────────────────────

/**
 * Create a live stream record for an event.
 * Provisions the AWS IVS channel and stores references.
 */
export async function createLiveStream(
  input: CreateLiveStreamInput,
): Promise<LiveStream> {
  // Import dynamically to allow this module to work without AWS deps in tests
  const { createLiveChannel } = await import(
    '@nzila/zonga-streaming-aws/ivs-live'
  )
  const { resolveIvsConfig } = await import('@nzila/zonga-streaming-aws')

  const config = resolveIvsConfig()

  // Provision IVS channel
  const channel = await createLiveChannel(config, {
    eventId: input.eventId,
    creatorId: input.creatorId,
    orgId: input.orgId,
    name: `event-${input.eventId}`,
  })

  // Persist live stream record
  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_live_streams (
      org_id, event_id, creator_id, provider,
      provider_channel_id, ingest_endpoint, playback_reference,
      status, scheduled_start, scheduled_end, metadata_json
    ) VALUES (
      ${input.orgId}, ${input.eventId}, ${input.creatorId}, 'aws_ivs',
      ${channel.channelArn}, ${channel.ingestEndpoint}, ${channel.playbackUrl},
      'scheduled',
      ${input.scheduledStart ?? null}::timestamptz,
      ${input.scheduledEnd ?? null}::timestamptz,
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING *
  `)

  const stream = mapStreamRow((rows as unknown as Array<Record<string, unknown>>)[0]!)

  // Store credential reference (NOT the raw key — only the ARN)
  await platformDb.execute(sql`
    INSERT INTO zonga_stream_credentials (
      live_stream_id, credential_ref, is_active
    ) VALUES (
      ${stream.id}, ${channel.streamKeyArn}, true
    )
  `)

  // Emit audit event
  await emitStreamEvent(stream.orgId, stream.id, 'stream_created', {
    eventId: input.eventId,
    creatorId: input.creatorId,
    channelArn: channel.channelArn,
  })

  // Store the stream key value transiently for the creator response
  // We attach it to metadata so getIngestDetails can return it on first call
  await platformDb.execute(sql`
    UPDATE zonga_live_streams
    SET metadata_json = metadata_json || ${JSON.stringify({ _initialStreamKeyValue: channel.streamKeyValue })}::jsonb
    WHERE id = ${stream.id}
  `)

  logger.info('Live stream created', { streamId: stream.id, eventId: input.eventId })

  return stream
}

/**
 * Get a live stream by ID (with org scope check).
 */
export async function getLiveStream(
  streamId: string,
  orgId: string,
): Promise<LiveStream | null> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_live_streams
    WHERE id = ${streamId} AND org_id = ${orgId}
  `)

  const row = (rows as unknown as Array<Record<string, unknown>>)[0]
  return row ? mapStreamRow(row) : null
}

/**
 * Get a live stream by event ID.
 */
export async function getLiveStreamByEvent(
  eventId: string,
  orgId: string,
): Promise<LiveStream | null> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_live_streams
    WHERE event_id = ${eventId} AND org_id = ${orgId}
    ORDER BY created_at DESC
    LIMIT 1
  `)

  const row = (rows as unknown as Array<Record<string, unknown>>)[0]
  return row ? mapStreamRow(row) : null
}

/**
 * List live streams for an org, optionally filtered by status.
 */
export async function listLiveStreams(
  orgId: string,
  statusFilter?: LiveStreamStatus[],
): Promise<LiveStream[]> {
  const statusClause = statusFilter?.length
    ? sql`AND status = ANY(${statusFilter})`
    : sql``

  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_live_streams
    WHERE org_id = ${orgId}
    ${statusClause}
    ORDER BY created_at DESC
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map(mapStreamRow)
}

// ── Stream Lifecycle ────────────────────────────────────────────────────────

/**
 * Transition stream to 'ready' state.
 */
export async function markStreamReady(
  streamId: string,
  orgId: string,
): Promise<void> {
  await updateStreamStatus(streamId, orgId, 'ready')
  await emitStreamEvent(orgId, streamId, 'stream_ready', {})
}

/**
 * Transition stream to 'live' state.
 */
export async function markStreamLive(
  streamId: string,
  orgId: string,
): Promise<void> {
  await platformDb.execute(sql`
    UPDATE zonga_live_streams
    SET status = 'live', started_at = now(), updated_at = now()
    WHERE id = ${streamId} AND org_id = ${orgId}
  `)
  await emitStreamEvent(orgId, streamId, 'stream_started', {})
}

/**
 * End a live stream. Stops the IVS stream and updates DB.
 */
export async function endLiveStream(
  streamId: string,
  orgId: string,
): Promise<void> {
  const stream = await getLiveStream(streamId, orgId)
  if (!stream) throw new Error('Stream not found')

  if (stream.providerChannelId) {
    try {
      const { stopLiveStream: stopIvs } = await import('@nzila/zonga-streaming-aws/ivs-live')
      const { resolveIvsConfig } = await import('@nzila/zonga-streaming-aws')
      await stopIvs(resolveIvsConfig(), stream.providerChannelId)
    } catch (err) {
      logger.warn('Failed to stop IVS stream', { err, streamId })
    }
  }

  await platformDb.execute(sql`
    UPDATE zonga_live_streams
    SET status = 'ended', ended_at = now(), updated_at = now()
    WHERE id = ${streamId} AND org_id = ${orgId}
  `)

  await emitStreamEvent(orgId, streamId, 'stream_ended', {})
  logger.info('Live stream ended', { streamId })
}

/**
 * Mark a stream as failed.
 */
export async function markStreamFailed(
  streamId: string,
  orgId: string,
  reason: string,
): Promise<void> {
  await platformDb.execute(sql`
    UPDATE zonga_live_streams
    SET status = 'failed', ended_at = now(), updated_at = now(),
        metadata_json = metadata_json || ${JSON.stringify({ failureReason: reason })}::jsonb
    WHERE id = ${streamId} AND org_id = ${orgId}
  `)

  await emitStreamEvent(orgId, streamId, 'stream_failed', { reason })
  logger.error('Live stream failed', { streamId, reason })
}

// ── Creator Ingest Details ──────────────────────────────────────────────────

/**
 * Get ingest details for the authorized creator.
 * Returns the RTMP URL and stream key reference.
 */
export async function getIngestDetails(
  streamId: string,
  orgId: string,
  creatorId: string,
): Promise<IngestDetails | null> {
  const stream = await getLiveStream(streamId, orgId)
  if (!stream) return null
  if (stream.creatorId !== creatorId) return null
  if (!stream.ingestEndpoint) return null

  // Get active credential
  const credRows = await platformDb.execute(sql`
    SELECT credential_ref FROM zonga_stream_credentials
    WHERE live_stream_id = ${streamId} AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  `)
  const cred = (credRows as unknown as Array<{ credential_ref: string }>)[0]

  const { buildRtmpIngestUrl } = await import('@nzila/zonga-streaming-aws/ivs-live')

  // On first call, return the initial stream key from metadata, then clear it
  const initialKey = stream.metadataJson._initialStreamKeyValue as string | undefined
  if (initialKey) {
    // Clear the transient key from metadata
    await platformDb.execute(sql`
      UPDATE zonga_live_streams
      SET metadata_json = metadata_json - '_initialStreamKeyValue'
      WHERE id = ${streamId}
    `)

    await emitStreamEvent(orgId, streamId, 'credential_issued', {
      creatorId,
    })

    return {
      ingestEndpoint: stream.ingestEndpoint,
      rtmpUrl: buildRtmpIngestUrl(stream.ingestEndpoint, initialKey),
      streamKeyRef: cred?.credential_ref ?? '',
    }
  }

  // Subsequent calls: creator must rotate the key to get a new one
  return {
    ingestEndpoint: stream.ingestEndpoint,
    rtmpUrl: `rtmps://${stream.ingestEndpoint}:443/app/[use-your-stream-key]`,
    streamKeyRef: cred?.credential_ref ?? '',
  }
}

/**
 * Rotate the stream key and return new ingest credentials.
 */
export async function rotateCreatorCredentials(
  streamId: string,
  orgId: string,
  creatorId: string,
): Promise<IngestDetails | null> {
  const stream = await getLiveStream(streamId, orgId)
  if (!stream || stream.creatorId !== creatorId) return null
  if (!stream.providerChannelId || !stream.ingestEndpoint) return null

  const { rotateStreamKey, buildRtmpIngestUrl } = await import('@nzila/zonga-streaming-aws/ivs-live')
  const { resolveIvsConfig } = await import('@nzila/zonga-streaming-aws')

  // Get old credential ARN
  const oldCredRows = await platformDb.execute(sql`
    SELECT credential_ref FROM zonga_stream_credentials
    WHERE live_stream_id = ${streamId} AND is_active = true
    LIMIT 1
  `)
  const oldRef = (oldCredRows as unknown as Array<{ credential_ref: string }>)[0]?.credential_ref

  // Rotate on AWS
  const newKey = await rotateStreamKey(resolveIvsConfig(), stream.providerChannelId, oldRef)

  // Mark old credentials inactive
  await platformDb.execute(sql`
    UPDATE zonga_stream_credentials
    SET is_active = false, rotated_at = now()
    WHERE live_stream_id = ${streamId} AND is_active = true
  `)

  // Store new credential reference
  await platformDb.execute(sql`
    INSERT INTO zonga_stream_credentials (live_stream_id, credential_ref, is_active)
    VALUES (${streamId}, ${newKey.streamKeyArn}, true)
  `)

  await emitStreamEvent(orgId, streamId, 'credential_rotated', { creatorId })

  return {
    ingestEndpoint: stream.ingestEndpoint,
    rtmpUrl: buildRtmpIngestUrl(stream.ingestEndpoint, newKey.streamKeyValue),
    streamKeyRef: newKey.streamKeyArn,
  }
}

// ── Viewer Playback ─────────────────────────────────────────────────────────

/**
 * Generate a playback grant for a viewer after entitlement check.
 * Entitlement check is performed by the caller (API route).
 */
export async function getViewerPlayback(
  streamId: string,
  orgId: string,
  viewerId: string,
): Promise<ViewerPlaybackGrant> {
  const stream = await getLiveStream(streamId, orgId)
  if (!stream) {
    return { ok: false, status: 'ended', error: 'Stream not found' }
  }

  if (stream.status === 'ended' || stream.status === 'failed') {
    return { ok: false, status: stream.status, error: `Stream is ${stream.status}` }
  }

  if (stream.status === 'scheduled') {
    return { ok: false, status: 'scheduled', error: 'Stream has not started yet' }
  }

  if (!stream.playbackReference) {
    return { ok: false, status: stream.status, error: 'Playback URL not available' }
  }

  await emitStreamEvent(orgId, streamId, 'playback_granted', {
    viewerId,
  })

  return {
    ok: true,
    playbackUrl: stream.playbackReference,
    status: stream.status,
  }
}

/**
 * Deny playback and record the denial for metrics.
 */
export async function denyViewerPlayback(
  streamId: string,
  orgId: string,
  viewerId: string,
  reason: string,
): Promise<void> {
  await emitStreamEvent(orgId, streamId, 'playback_denied', {
    viewerId,
    reason,
  })
}

// ── Stream Status Query ─────────────────────────────────────────────────────

/**
 * Get the real-time status of a live stream.
 * Queries the provider for current state if the stream is live/ready.
 */
export async function getStreamStatus(
  streamId: string,
  orgId: string,
): Promise<{
  status: LiveStreamStatus
  viewerCount: number
  health: string
} | null> {
  const stream = await getLiveStream(streamId, orgId)
  if (!stream) return null

  // For non-active states, return DB state
  if (stream.status === 'ended' || stream.status === 'failed' || stream.status === 'scheduled') {
    return { status: stream.status, viewerCount: 0, health: 'n/a' }
  }

  // Query IVS for real-time state
  if (stream.providerChannelId) {
    try {
      const { getLiveChannelInfo } = await import('@nzila/zonga-streaming-aws/ivs-live')
      const { resolveIvsConfig } = await import('@nzila/zonga-streaming-aws')
      const info = await getLiveChannelInfo(resolveIvsConfig(), stream.providerChannelId)

      // Sync DB status if it drifted
      if (info.state !== stream.status) {
        await updateStreamStatus(streamId, orgId, info.state)
      }

      return {
        status: info.state,
        viewerCount: info.viewerCount,
        health: info.health,
      }
    } catch (err) {
      logger.warn('Failed to query IVS channel', { err, streamId })
    }
  }

  return { status: stream.status, viewerCount: 0, health: 'unknown' }
}

// ── Internals ───────────────────────────────────────────────────────────────

async function updateStreamStatus(
  streamId: string,
  orgId: string,
  status: LiveStreamStatus,
): Promise<void> {
  await platformDb.execute(sql`
    UPDATE zonga_live_streams
    SET status = ${status}, updated_at = now()
    WHERE id = ${streamId} AND org_id = ${orgId}
  `)
}

async function emitStreamEvent(
  orgId: string,
  liveStreamId: string | null,
  eventType: StreamEventType,
  payload: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  try {
    await platformDb.execute(sql`
      INSERT INTO zonga_stream_events (
        org_id, live_stream_id, event_type, payload_json, actor_id
      ) VALUES (
        ${orgId}, ${liveStreamId}, ${eventType},
        ${JSON.stringify(payload)}::jsonb, ${actorId ?? null}
      )
    `)
  } catch (err) {
    logger.error('Failed to emit stream event', { err, eventType })
  }
}

function mapStreamRow(row: Record<string, unknown>): LiveStream {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    eventId: row.event_id as string,
    creatorId: row.creator_id as string,
    provider: row.provider as string,
    providerChannelId: row.provider_channel_id as string | null,
    ingestEndpoint: row.ingest_endpoint as string | null,
    playbackReference: row.playback_reference as string | null,
    status: row.status as LiveStreamStatus,
    scheduledStart: row.scheduled_start as string | null,
    scheduledEnd: row.scheduled_end as string | null,
    startedAt: row.started_at as string | null,
    endedAt: row.ended_at as string | null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
