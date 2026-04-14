/**
 * AWS IVS Live Streaming — channel management, ingest credentials, playback.
 *
 * Zonga remains the source of truth for events, entitlements, and state.
 * This module only manages AWS IVS resources and returns references.
 */
import {
  IVSClient,
  CreateChannelCommand,
  DeleteChannelCommand,
  StopStreamCommand,
  GetChannelCommand,
  GetStreamCommand,
  CreateStreamKeyCommand,
  DeleteStreamKeyCommand,
  type Channel,
} from '@aws-sdk/client-ivs'
import type { IvsConfig, LiveStreamStatus } from '../types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateLiveChannelInput {
  eventId: string
  creatorId: string
  orgId: string
  name: string
  latencyMode?: 'NORMAL' | 'LOW'
  channelType?: 'STANDARD' | 'BASIC'
}

export interface LiveChannelResult {
  channelArn: string
  ingestEndpoint: string
  playbackUrl: string
  streamKeyArn: string
  streamKeyValue: string
}

export interface LiveChannelInfo {
  channelArn: string
  ingestEndpoint: string
  playbackUrl: string
  state: LiveStreamStatus
  health: string
  viewerCount: number
}

export interface IngestCredentials {
  ingestEndpoint: string
  streamKeyValue: string
  rtmpUrl: string
}

// ── Client Factory ──────────────────────────────────────────────────────────

function createIvsClient(config: IvsConfig): IVSClient {
  return new IVSClient({
    region: config.region,
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
          },
        }
      : {}),
  })
}

// ── Channel Management ──────────────────────────────────────────────────────

/**
 * Create an IVS channel for a live event.
 * Returns channel ARN, ingest endpoint, playback URL, and stream key.
 *
 * The stream key value is returned ONCE — caller must persist the reference securely.
 */
export async function createLiveChannel(
  config: IvsConfig,
  input: CreateLiveChannelInput,
): Promise<LiveChannelResult> {
  const client = createIvsClient(config)

  const channelResponse = await client.send(
    new CreateChannelCommand({
      name: `zonga-${input.orgId}-${input.eventId}`,
      latencyMode: input.latencyMode ?? config.latencyMode,
      type: input.channelType ?? config.channelType,
      tags: {
        'zonga:event_id': input.eventId,
        'zonga:creator_id': input.creatorId,
        'zonga:org_id': input.orgId,
      },
    }),
  )

  const channel = channelResponse.channel
  const streamKey = channelResponse.streamKey
  if (!channel?.arn || !channel.ingestEndpoint || !channel.playbackUrl || !streamKey?.arn || !streamKey.value) {
    throw new Error('IVS channel creation returned incomplete data')
  }

  return {
    channelArn: channel.arn,
    ingestEndpoint: channel.ingestEndpoint,
    playbackUrl: channel.playbackUrl,
    streamKeyArn: streamKey.arn,
    streamKeyValue: streamKey.value,
  }
}

/**
 * Get current channel info including live/offline state.
 */
export async function getLiveChannelInfo(
  config: IvsConfig,
  channelArn: string,
): Promise<LiveChannelInfo> {
  const client = createIvsClient(config)

  const channelResp = await client.send(new GetChannelCommand({ arn: channelArn }))
  const channel = channelResp.channel as Channel

  let viewerCount = 0
  let state: LiveStreamStatus = 'ready'
  let health = 'unknown'

  try {
    const streamResp = await client.send(new GetStreamCommand({ channelArn }))
    if (streamResp.stream) {
      state = mapIvsStreamState(streamResp.stream.state)
      health = streamResp.stream.health ?? 'unknown'
      viewerCount = streamResp.stream.viewerCount ?? 0
    }
  } catch (err: unknown) {
    // ChannelNotBroadcasting means no active stream
    if (isAwsError(err, 'ChannelNotBroadcasting')) {
      state = 'ready'
    } else {
      throw err
    }
  }

  return {
    channelArn: channel.arn ?? channelArn,
    ingestEndpoint: channel.ingestEndpoint ?? '',
    playbackUrl: channel.playbackUrl ?? '',
    state,
    health,
    viewerCount,
  }
}

/**
 * Rotate the stream key for a channel.
 * Invalidates the previous key and returns a new one.
 */
export async function rotateStreamKey(
  config: IvsConfig,
  channelArn: string,
  oldStreamKeyArn?: string,
): Promise<{ streamKeyArn: string; streamKeyValue: string }> {
  const client = createIvsClient(config)

  // Delete old key if provided
  if (oldStreamKeyArn) {
    await client.send(new DeleteStreamKeyCommand({ arn: oldStreamKeyArn })).catch(() => {
      // Ignore if already deleted
    })
  }

  const resp = await client.send(new CreateStreamKeyCommand({ channelArn }))
  if (!resp.streamKey?.arn || !resp.streamKey.value) {
    throw new Error('IVS stream key creation returned incomplete data')
  }

  return {
    streamKeyArn: resp.streamKey.arn,
    streamKeyValue: resp.streamKey.value,
  }
}

/**
 * Stop a live stream on a channel.
 */
export async function stopLiveStream(
  config: IvsConfig,
  channelArn: string,
): Promise<void> {
  const client = createIvsClient(config)
  await client.send(new StopStreamCommand({ channelArn }))
}

/**
 * Delete an IVS channel entirely.
 */
export async function deleteLiveChannel(
  config: IvsConfig,
  channelArn: string,
): Promise<void> {
  const client = createIvsClient(config)
  await client.send(new DeleteChannelCommand({ arn: channelArn }))
}

/**
 * Build RTMP ingest URL for OBS / encoders.
 */
export function buildRtmpIngestUrl(ingestEndpoint: string, streamKey: string): string {
  return `rtmps://${ingestEndpoint}:443/app/${streamKey}`
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapIvsStreamState(state: string | undefined): LiveStreamStatus {
  switch (state) {
    case 'LIVE':
      return 'live'
    case 'OFFLINE':
      return 'ended'
    default:
      return 'ready'
  }
}

function isAwsError(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === code
  )
}
