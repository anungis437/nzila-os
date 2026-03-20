/**
 * Zonga — Offline-First & Africa Optimization
 *
 * Pure utility functions for building offline-capable features:
 * - Queue management for deferred operations (plays, purchases)
 * - Bandwidth-adaptive streaming quality selection
 * - Cache key generation for service worker strategies
 * - Sync conflict resolution utilities
 *
 * This module is framework-agnostic — works in service workers,
 * React components, or server-side code.
 */

// ── Network Quality ─────────────────────────────────────────────────────────

export const NetworkQuality = {
  OFFLINE: 'offline',
  EDGE: 'edge',       // 2G (~50kbps)
  SLOW: 'slow',       // 3G (~300kbps)
  MODERATE: 'moderate', // Low 4G (~1Mbps)
  FAST: 'fast',       // 4G+ (~5Mbps+)
  WIFI: 'wifi',       // Wi-Fi / broadband
} as const

export type NetworkQuality = (typeof NetworkQuality)[keyof typeof NetworkQuality]

export const StreamingQuality = {
  LOW: 'low',         // 64kbps AAC — 2G/Edge
  MEDIUM: 'medium',   // 128kbps AAC — 3G
  HIGH: 'high',       // 256kbps AAC — 4G
  LOSSLESS: 'lossless', // FLAC — Wi-Fi only
} as const

export type StreamingQuality = (typeof StreamingQuality)[keyof typeof StreamingQuality]

/**
 * Select optimal streaming quality based on network conditions.
 * Prioritizes uninterrupted playback over quality in low-bandwidth scenarios.
 */
export function selectStreamingQuality(
  network: NetworkQuality,
  dataSaverEnabled: boolean,
): StreamingQuality {
  if (dataSaverEnabled) return StreamingQuality.LOW

  switch (network) {
    case NetworkQuality.OFFLINE:
    case NetworkQuality.EDGE:
      return StreamingQuality.LOW
    case NetworkQuality.SLOW:
      return StreamingQuality.MEDIUM
    case NetworkQuality.MODERATE:
      return StreamingQuality.HIGH
    case NetworkQuality.FAST:
    case NetworkQuality.WIFI:
      return StreamingQuality.HIGH
    default:
      return StreamingQuality.MEDIUM
  }
}

// ── Offline Queue ───────────────────────────────────────────────────────────

export const OfflineActionType = {
  STREAM_PLAY: 'stream_play',
  TICKET_PURCHASE: 'ticket_purchase',
  CHECKIN_SCAN: 'checkin_scan',
  TIP: 'tip',
  FOLLOW: 'follow',
  SAVE: 'save',
  REVIEW: 'review',
} as const

export type OfflineActionType = (typeof OfflineActionType)[keyof typeof OfflineActionType]

export interface QueuedAction {
  readonly id: string
  readonly type: OfflineActionType
  readonly payload: Record<string, unknown>
  readonly queuedAt: string  // ISO 8601
  readonly retryCount: number
  readonly maxRetries: number
  readonly priority: number  // Lower = higher priority
}

export interface SyncResult {
  readonly actionId: string
  readonly success: boolean
  readonly serverTimestamp?: string
  readonly error?: string
  readonly conflictResolution?: 'client_wins' | 'server_wins' | 'merged'
}

/**
 * Sort queued actions by priority (ascending), then by queue time (FIFO).
 */
export function sortByPriority(actions: readonly QueuedAction[]): QueuedAction[] {
  return [...actions].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.queuedAt.localeCompare(b.queuedAt)
  })
}

/**
 * Filter actions that have not exceeded their retry limit.
 */
export function retryableActions(actions: readonly QueuedAction[]): QueuedAction[] {
  return actions.filter(a => a.retryCount < a.maxRetries)
}

/**
 * Compute exponential backoff delay for a queued action.
 * Caps at 5 minutes. Adds jitter to avoid thundering herd.
 */
export function computeBackoffMs(retryCount: number): number {
  const baseMs = 1000
  const maxMs = 300_000 // 5 minutes
  const exponential = Math.min(baseMs * Math.pow(2, retryCount), maxMs)
  const jitter = Math.random() * 0.3 * exponential
  return Math.floor(exponential + jitter)
}

// ── Cache Keys ──────────────────────────────────────────────────────────────

/**
 * Generate cache key for a track's audio data at a specific quality tier.
 */
export function trackCacheKey(trackId: string, quality: StreamingQuality): string {
  return `zonga:audio:${trackId}:${quality}`
}

/**
 * Generate cache key for artist/album artwork.
 */
export function artworkCacheKey(entityType: 'album' | 'artist' | 'event' | 'playlist', entityId: string): string {
  return `zonga:artwork:${entityType}:${entityId}`
}

/**
 * Generate cache key for event check-in data (offline check-in support).
 */
export function checkinCacheKey(eventId: string): string {
  return `zonga:checkin:${eventId}`
}

// ── Offline Download Budget ─────────────────────────────────────────────────

/** Approximate bytes per second for each quality tier */
const QUALITY_BITRATE_BPS: Record<StreamingQuality, number> = {
  [StreamingQuality.LOW]: 64_000 / 8,       // 8 KB/s
  [StreamingQuality.MEDIUM]: 128_000 / 8,    // 16 KB/s
  [StreamingQuality.HIGH]: 256_000 / 8,      // 32 KB/s
  [StreamingQuality.LOSSLESS]: 1_411_000 / 8, // ~176 KB/s
}

/**
 * Estimate download size for a track at a given quality.
 * @param durationSeconds Track duration in seconds
 * @param quality Streaming quality tier
 * @returns Estimated size in bytes
 */
export function estimateTrackSize(durationSeconds: number, quality: StreamingQuality): number {
  return Math.ceil(durationSeconds * QUALITY_BITRATE_BPS[quality])
}

/**
 * Compute how many tracks fit within a storage budget.
 * Assumes average track duration.
 */
export function tracksWithinBudget(
  budgetBytes: number,
  quality: StreamingQuality,
  avgTrackDurationSeconds: number = 210, // 3.5 min
): number {
  const perTrack = estimateTrackSize(avgTrackDurationSeconds, quality)
  return Math.floor(budgetBytes / perTrack)
}

// ── USSD Payment Formatting ─────────────────────────────────────────────────

/**
 * Format amount for USSD display (no decimals, space-separated thousands).
 * Optimized for feature phone readability.
 */
export function formatUssdAmount(amount: number, currencyCode: string): string {
  const rounded = Math.round(amount)
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${currencyCode} ${formatted}`
}

/**
 * Build a USSD-friendly order summary for mobile money payments.
 * Must fit within USSD character limits (~182 chars per page).
 */
export function buildUssdOrderSummary(items: readonly { name: string; amount: number }[], currency: string): string {
  const lines = items.map(i => `${i.name}: ${formatUssdAmount(i.amount, currency)}`)
  const total = items.reduce((s, i) => s + i.amount, 0)
  lines.push(`Total: ${formatUssdAmount(total, currency)}`)
  return lines.join('\n')
}
