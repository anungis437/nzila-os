/**
 * Streaming Metrics — telemetry collection for Control Plane observability.
 *
 * Provides structured metrics aggregation for:
 * - Live stream state and viewer counts
 * - Media processing job lifecycle
 * - Playback grant success/failure rates
 * - Provider error tracking
 *
 * These functions operate on data passed in (DB rows, event arrays).
 * They do NOT call AWS APIs — they compute summaries from Zonga-owned data.
 */
import type {
  LiveStreamStatus,
  MediaJobStatus,
  StreamEventType,
} from '../types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface LiveStreamRecord {
  id: string
  orgId: string
  eventId: string
  status: LiveStreamStatus
  startedAt: string | null
  endedAt: string | null
  viewerCount?: number
}

export interface MediaJobRecord {
  id: string
  orgId: string
  contentAssetId: string
  jobType: string
  status: MediaJobStatus
  submittedAt: string
  completedAt: string | null
  errorSummary: string | null
}

export interface StreamEventRecord {
  id: string
  orgId: string
  eventType: StreamEventType
  createdAt: string
  liveStreamId: string | null
}

export interface StreamingDashboardMetrics {
  liveStreams: {
    active: number
    scheduled: number
    failed: number
    ended: number
    totalViewers: number
  }
  mediaJobs: {
    pending: number
    processing: number
    completed: number
    failed: number
    backlogSize: number
    avgProcessingTimeSec: number | null
  }
  playbackGrants: {
    granted: number
    denied: number
    successRate: number
  }
  providerErrors: {
    total: number
    recentErrors: { eventType: string; createdAt: string; orgId: string }[]
  }
  topStreamedAssets: { assetId: string; grantCount: number }[]
}

// ── Metrics Computation ─────────────────────────────────────────────────────

/**
 * Compute the full streaming dashboard metrics from raw records.
 */
export function computeStreamingMetrics(
  streams: LiveStreamRecord[],
  jobs: MediaJobRecord[],
  events: StreamEventRecord[],
): StreamingDashboardMetrics {
  return {
    liveStreams: computeLiveStreamMetrics(streams),
    mediaJobs: computeMediaJobMetrics(jobs),
    playbackGrants: computePlaybackGrantMetrics(events),
    providerErrors: computeProviderErrorMetrics(events),
    topStreamedAssets: computeTopStreamedAssets(events),
  }
}

/**
 * Live stream summary counts.
 */
export function computeLiveStreamMetrics(streams: LiveStreamRecord[]) {
  let active = 0
  let scheduled = 0
  let failed = 0
  let ended = 0
  let totalViewers = 0

  for (const s of streams) {
    switch (s.status) {
      case 'live':
        active++
        totalViewers += s.viewerCount ?? 0
        break
      case 'scheduled':
      case 'ready':
        scheduled++
        break
      case 'failed':
        failed++
        break
      case 'ended':
        ended++
        break
    }
  }

  return { active, scheduled, failed, ended, totalViewers }
}

/**
 * Media processing job metrics.
 */
export function computeMediaJobMetrics(jobs: MediaJobRecord[]) {
  let pending = 0
  let processing = 0
  let completed = 0
  let failed = 0
  const processingTimes: number[] = []

  for (const j of jobs) {
    switch (j.status) {
      case 'pending':
      case 'submitted':
        pending++
        break
      case 'processing':
        processing++
        break
      case 'completed':
        completed++
        if (j.completedAt && j.submittedAt) {
          const diff = (new Date(j.completedAt).getTime() - new Date(j.submittedAt).getTime()) / 1000
          if (diff > 0) processingTimes.push(diff)
        }
        break
      case 'failed':
        failed++
        break
    }
  }

  const avgProcessingTimeSec =
    processingTimes.length > 0
      ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
      : null

  return {
    pending,
    processing,
    completed,
    failed,
    backlogSize: pending + processing,
    avgProcessingTimeSec,
  }
}

/**
 * Playback grant success/failure rates.
 */
export function computePlaybackGrantMetrics(events: StreamEventRecord[]) {
  let granted = 0
  let denied = 0

  for (const e of events) {
    if (e.eventType === 'playback_granted') granted++
    if (e.eventType === 'playback_denied') denied++
  }

  const total = granted + denied
  return {
    granted,
    denied,
    successRate: total > 0 ? Math.round((granted / total) * 100) : 100,
  }
}

/**
 * Provider error metrics.
 */
export function computeProviderErrorMetrics(events: StreamEventRecord[]) {
  const errorTypes: StreamEventType[] = ['stream_failed', 'media_job_failed']
  const errors = events.filter((e) => errorTypes.includes(e.eventType as StreamEventType))

  return {
    total: errors.length,
    recentErrors: errors
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((e) => ({
        eventType: e.eventType,
        createdAt: e.createdAt,
        orgId: e.orgId,
      })),
  }
}

/**
 * Top streamed assets by playback grant count.
 */
export function computeTopStreamedAssets(events: StreamEventRecord[]) {
  const counts = new Map<string, number>()
  for (const e of events) {
    if (e.eventType === 'playback_granted' && e.liveStreamId) {
      counts.set(e.liveStreamId, (counts.get(e.liveStreamId) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([assetId, grantCount]) => ({ assetId, grantCount }))
    .sort((a, b) => b.grantCount - a.grantCount)
    .slice(0, 10)
}
