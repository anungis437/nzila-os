/**
 * @nzila/media-worker — Player Contract
 *
 * Defines the client-server contract for playback sessions:
 * resume position, bitrate switching, play/skip/completion events,
 * and playback analytics hooks.
 *
 * @module @nzila/media-worker/player
 */

// ── Playback Session ────────────────────────────────────────────────────────

export interface PlaybackSession {
  readonly sessionId: string
  readonly listenerId: string
  readonly assetId: string
  readonly orgId: string
  readonly quality: string
  readonly protocol: 'hls' | 'progressive'
  readonly startedAt: Date
  readonly resumePositionMs: number
  readonly lowDataMode: boolean
}

export interface PlaybackState {
  readonly sessionId: string
  readonly positionMs: number
  readonly durationMs: number
  readonly quality: string
  readonly bufferHealthMs: number
  readonly isPlaying: boolean
}

// ── Playback Events ─────────────────────────────────────────────────────────

export const PlaybackEventType = {
  PLAY: 'play',
  PAUSE: 'pause',
  RESUME: 'resume',
  SEEK: 'seek',
  SKIP: 'skip',
  COMPLETE: 'complete',
  QUALITY_CHANGE: 'quality_change',
  BUFFER_STALL: 'buffer_stall',
  ERROR: 'error',
} as const

export type PlaybackEventType = (typeof PlaybackEventType)[keyof typeof PlaybackEventType]

export interface PlaybackEvent {
  readonly sessionId: string
  readonly listenerId: string
  readonly assetId: string
  readonly orgId: string
  readonly type: PlaybackEventType
  readonly positionMs: number
  readonly timestamp: Date
  readonly metadata: PlaybackEventMetadata
}

export interface PlaybackEventMetadata {
  readonly quality?: string
  readonly previousQuality?: string
  readonly seekFromMs?: number
  readonly seekToMs?: number
  readonly errorMessage?: string
  readonly bufferDurationMs?: number
  readonly networkType?: string
  readonly deviceType?: string
}

// ── Revenue-Qualifying Stream ───────────────────────────────────────────────

/**
 * Minimum playback thresholds for a stream to qualify
 * as a revenue event (per music industry standard).
 */
export const REVENUE_STREAM_THRESHOLDS = {
  /** Minimum play duration in milliseconds (30 seconds). */
  MIN_DURATION_MS: 30_000,
  /** Minimum completion percentage (0–100). */
  MIN_COMPLETION_PERCENT: 0,
  /** Maximum plays from one listener on one track per day to count. */
  MAX_DAILY_PLAYS_PER_TRACK: 50,
} as const

export interface StreamQualification {
  readonly qualifies: boolean
  readonly reason: string | null
  readonly durationPlayedMs: number
  readonly completionPercent: number
}

/**
 * Determines if a completed playback session qualifies as a revenue stream.
 * Pure function — no side effects.
 */
export function qualifyStream(params: {
  durationPlayedMs: number
  totalDurationMs: number
  dailyPlaysForTrack: number
}): StreamQualification {
  const completionPercent =
    params.totalDurationMs > 0
      ? Math.round((params.durationPlayedMs / params.totalDurationMs) * 10000) / 100
      : 0

  if (params.durationPlayedMs < REVENUE_STREAM_THRESHOLDS.MIN_DURATION_MS) {
    return {
      qualifies: false,
      reason: `Duration ${params.durationPlayedMs}ms below minimum ${REVENUE_STREAM_THRESHOLDS.MIN_DURATION_MS}ms`,
      durationPlayedMs: params.durationPlayedMs,
      completionPercent,
    }
  }

  if (params.dailyPlaysForTrack >= REVENUE_STREAM_THRESHOLDS.MAX_DAILY_PLAYS_PER_TRACK) {
    return {
      qualifies: false,
      reason: `Daily play limit reached (${params.dailyPlaysForTrack}/${REVENUE_STREAM_THRESHOLDS.MAX_DAILY_PLAYS_PER_TRACK})`,
      durationPlayedMs: params.durationPlayedMs,
      completionPercent,
    }
  }

  return {
    qualifies: true,
    reason: null,
    durationPlayedMs: params.durationPlayedMs,
    completionPercent,
  }
}

// ── Session Manager ─────────────────────────────────────────────────────────

/**
 * Creates the playback session manager.
 * Tracks active sessions, handles resume, and emits analytics events.
 */
export function createPlaybackSessionManager(deps: {
  onPlaybackEvent: (event: PlaybackEvent) => Promise<void>
  onRevenueStream: (sessionId: string, qualification: StreamQualification) => Promise<void>
}) {
  const { onPlaybackEvent, onRevenueStream } = deps

  return {
    /**
     * Start a new playback session. Returns session ID.
     */
    async startSession(params: {
      sessionId: string
      listenerId: string
      assetId: string
      orgId: string
      quality: string
      protocol: 'hls' | 'progressive'
      resumePositionMs: number
      lowDataMode: boolean
    }): Promise<PlaybackSession> {
      const session: PlaybackSession = {
        sessionId: params.sessionId,
        listenerId: params.listenerId,
        assetId: params.assetId,
        orgId: params.orgId,
        quality: params.quality,
        protocol: params.protocol,
        startedAt: new Date(),
        resumePositionMs: params.resumePositionMs,
        lowDataMode: params.lowDataMode,
      }

      await onPlaybackEvent({
        sessionId: params.sessionId,
        listenerId: params.listenerId,
        assetId: params.assetId,
        orgId: params.orgId,
        type: PlaybackEventType.PLAY,
        positionMs: params.resumePositionMs,
        timestamp: session.startedAt,
        metadata: {
          quality: params.quality,
          networkType: undefined,
          deviceType: undefined,
        },
      })

      return session
    },

    /**
     * End a session and check if it qualifies as a revenue stream.
     */
    async endSession(params: {
      sessionId: string
      listenerId: string
      assetId: string
      orgId: string
      finalPositionMs: number
      totalDurationMs: number
      dailyPlaysForTrack: number
    }): Promise<StreamQualification> {
      const qualification = qualifyStream({
        durationPlayedMs: params.finalPositionMs,
        totalDurationMs: params.totalDurationMs,
        dailyPlaysForTrack: params.dailyPlaysForTrack,
      })

      await onPlaybackEvent({
        sessionId: params.sessionId,
        listenerId: params.listenerId,
        assetId: params.assetId,
        orgId: params.orgId,
        type: PlaybackEventType.COMPLETE,
        positionMs: params.finalPositionMs,
        timestamp: new Date(),
        metadata: {},
      })

      if (qualification.qualifies) {
        await onRevenueStream(params.sessionId, qualification)
      }

      return qualification
    },

    /**
     * Record a playback event (pause, seek, quality change, etc.).
     */
    async recordEvent(event: PlaybackEvent): Promise<void> {
      await onPlaybackEvent(event)
    },
  }
}
