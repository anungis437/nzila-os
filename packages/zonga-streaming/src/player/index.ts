/**
 * Player logic — playback session management, buffer strategy,
 * queue management, gapless transitions, progress tracking.
 *
 * All functions are pure (no DOM/Audio API deps). The UI layer
 * calls these to compute what to do; it then drives the actual
 * HTMLAudioElement or MediaSource API.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlaybackSession {
  id: string
  assetId: string
  listenerId: string | null
  quality: string
  startedAt: number        // Unix ms
  positionMs: number
  durationMs: number
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error'
  bufferAheadMs: number
  completionPercent: number
  playCount: number        // Incremented on each >= 30s or >= 50% completion
}

export interface BufferStrategy {
  preloadNextTrack: boolean
  bufferAheadSec: number
  maxBufferSec: number
  rebufferThresholdSec: number
  aggressivePreload: boolean
}

export interface PlaybackProgressEvent {
  sessionId: string
  assetId: string
  listenerId: string | null
  positionMs: number
  durationMs: number
  completionPercent: number
  isComplete: boolean      // >= 30s or >= 50%
  timestamp: number
}

export interface QueueState {
  items: QueueItem[]
  currentIndex: number
  repeatMode: 'off' | 'one' | 'all'
  shuffled: boolean
  shuffleOrder: number[]
}

export interface QueueItem {
  assetId: string
  title: string
  artistName: string
  durationMs: number
  coverUrl?: string
}

// ── Playback Session ────────────────────────────────────────────────────────

let sessionCounter = 0

/**
 * Create a new playback session for a track.
 */
export function createPlaybackSession(
  assetId: string,
  durationMs: number,
  listenerId: string | null,
  quality: string
): PlaybackSession {
  sessionCounter++
  return {
    id: `ps_${Date.now()}_${sessionCounter}`,
    assetId,
    listenerId,
    quality,
    startedAt: Date.now(),
    positionMs: 0,
    durationMs,
    state: 'loading',
    bufferAheadMs: 0,
    completionPercent: 0,
    playCount: 0,
  }
}

// ── Buffer Strategy ─────────────────────────────────────────────────────────

/**
 * Compute the optimal buffering strategy based on network and context.
 *
 * Strategy:
 * - On wifi/4g: aggressive preload, buffer 30s ahead, preload next track
 * - On 3g: moderate buffer (15s), preload next track if queue < 3 items
 * - On slow connections: minimal buffer (5s), no preload
 */
export function computeBufferStrategy(
  networkType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown',
  isLowDataMode: boolean,
  queueLength: number
): BufferStrategy {
  if (isLowDataMode) {
    return {
      preloadNextTrack: false,
      bufferAheadSec: 5,
      maxBufferSec: 15,
      rebufferThresholdSec: 1,
      aggressivePreload: false,
    }
  }

  switch (networkType) {
    case 'wifi':
    case '4g':
      return {
        preloadNextTrack: true,
        bufferAheadSec: 30,
        maxBufferSec: 60,
        rebufferThresholdSec: 2,
        aggressivePreload: true,
      }
    case '3g':
      return {
        preloadNextTrack: queueLength <= 3,
        bufferAheadSec: 15,
        maxBufferSec: 30,
        rebufferThresholdSec: 3,
        aggressivePreload: false,
      }
    case '2g':
    case 'slow-2g':
      return {
        preloadNextTrack: false,
        bufferAheadSec: 5,
        maxBufferSec: 10,
        rebufferThresholdSec: 5,
        aggressivePreload: false,
      }
    default:
      return {
        preloadNextTrack: queueLength <= 5,
        bufferAheadSec: 15,
        maxBufferSec: 30,
        rebufferThresholdSec: 2,
        aggressivePreload: false,
      }
  }
}

// ── Queue Management ────────────────────────────────────────────────────────

/**
 * Resolve the next track in the queue, respecting repeat and shuffle modes.
 * Returns null if the queue is exhausted.
 */
export function resolveNextTrack(queue: QueueState): {
  nextIndex: number
  item: QueueItem
} | null {
  if (queue.items.length === 0) return null

  const { currentIndex, repeatMode, shuffled, shuffleOrder } = queue

  // Repeat one: stay on current
  if (repeatMode === 'one') {
    return { nextIndex: currentIndex, item: queue.items[currentIndex]! }
  }

  // Compute effective next index
  let nextEffective: number

  if (shuffled && shuffleOrder.length > 0) {
    // Find current position in shuffle order
    const shufflePos = shuffleOrder.indexOf(currentIndex)
    const nextShufflePos = shufflePos + 1

    if (nextShufflePos >= shuffleOrder.length) {
      // End of shuffle
      if (repeatMode === 'all') {
        nextEffective = shuffleOrder[0]!
      } else {
        return null
      }
    } else {
      nextEffective = shuffleOrder[nextShufflePos]!
    }
  } else {
    // Sequential playback
    nextEffective = currentIndex + 1

    if (nextEffective >= queue.items.length) {
      if (repeatMode === 'all') {
        nextEffective = 0
      } else {
        return null
      }
    }
  }

  const item = queue.items[nextEffective]
  if (!item) return null

  return { nextIndex: nextEffective, item }
}

// ── Gapless Transition ──────────────────────────────────────────────────────

/**
 * Compute the timing for a gapless transition between tracks.
 * Returns the preload trigger point (ms before end of current track).
 */
export function computeGaplessTransition(
  currentDurationMs: number,
  bufferStrategy: BufferStrategy
): {
  preloadTriggerMs: number
  crossfadeDurationMs: number
  shouldPreload: boolean
} {
  if (!bufferStrategy.preloadNextTrack) {
    return {
      preloadTriggerMs: currentDurationMs,
      crossfadeDurationMs: 0,
      shouldPreload: false,
    }
  }

  // Start preloading the next track 10 seconds before end
  const preloadLeadMs = bufferStrategy.aggressivePreload ? 15_000 : 10_000
  const preloadTriggerMs = Math.max(0, currentDurationMs - preloadLeadMs)

  // Short crossfade for smooth transition
  const crossfadeDurationMs = 200

  return {
    preloadTriggerMs,
    crossfadeDurationMs,
    shouldPreload: true,
  }
}

// ── Progress Tracking ───────────────────────────────────────────────────────

/**
 * Track playback progress and determine if a "play" should be counted.
 *
 * Industry standard: A stream counts as a "play" when the listener has
 * listened for >= 30 seconds OR >= 50% of the track (whichever comes first).
 */
export function trackPlaybackProgress(
  session: PlaybackSession,
  newPositionMs: number
): PlaybackProgressEvent {
  const completionPercent = session.durationMs > 0
    ? Math.min(100, (newPositionMs / session.durationMs) * 100)
    : 0

  const PLAY_THRESHOLD_MS = 30_000
  const PLAY_THRESHOLD_PERCENT = 50

  const isComplete =
    newPositionMs >= PLAY_THRESHOLD_MS ||
    completionPercent >= PLAY_THRESHOLD_PERCENT

  return {
    sessionId: session.id,
    assetId: session.assetId,
    listenerId: session.listenerId,
    positionMs: newPositionMs,
    durationMs: session.durationMs,
    completionPercent: Math.round(completionPercent * 100) / 100,
    isComplete,
    timestamp: Date.now(),
  }
}
