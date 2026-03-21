/**
 * @nzila/media-worker — Low Data Mode
 *
 * Optimizations for bandwidth-constrained listeners (2G/3G, metered connections).
 * Forces 64kbps audio, reduces metadata payloads, disables artwork preloading,
 * and optimizes HLS segment sizing.
 *
 * @module @nzila/media-worker/low-data
 */

import type { QualityTier } from './transcoder'

// ── Low Data Config ─────────────────────────────────────────────────────────

export const LOW_DATA_CONFIG = {
  /** Forced quality tier in low-data mode. */
  FORCED_QUALITY: 'low' as QualityTier,
  /** Maximum artwork dimension to serve (px). */
  MAX_ARTWORK_SIZE: 100,
  /** Disable artwork preloading entirely. */
  PRELOAD_ARTWORK: false,
  /** Maximum number of tracks to prefetch metadata for. */
  METADATA_PREFETCH_LIMIT: 5,
  /** Maximum number of tracks to prefetch audio for. */
  AUDIO_PREFETCH_LIMIT: 1,
  /** Reduced HLS segment duration for faster startup (seconds). */
  HLS_SEGMENT_DURATION: 4,
  /** Disable waveform visualization data. */
  INCLUDE_WAVEFORM: false,
  /** Reduce recommendation batch size. */
  RECOMMENDATION_LIMIT: 10,
} as const

// ── Low Data Response Transformers ──────────────────────────────────────────

export interface TrackMetadata {
  readonly id: string
  readonly title: string
  readonly artistName: string
  readonly albumTitle: string | null
  readonly durationMs: number
  readonly genre: string
  readonly coverArtUrl: string | null
  readonly waveformData: readonly number[] | null
  readonly lyrics: string | null
  readonly credits: readonly string[]
}

export interface LightTrackMetadata {
  readonly id: string
  readonly title: string
  readonly artistName: string
  readonly durationMs: number
  readonly genre: string
  readonly coverArtUrl: string | null
}

/**
 * Strips heavy fields from track metadata for low-data mode.
 * Pure function.
 */
export function toLightMetadata(
  track: TrackMetadata,
  artworkBaseUrl: string,
): LightTrackMetadata {
  // Replace full-size artwork URL with thumbnail
  const coverArtUrl = track.coverArtUrl
    ? `${artworkBaseUrl}/${track.id}/${LOW_DATA_CONFIG.MAX_ARTWORK_SIZE}x${LOW_DATA_CONFIG.MAX_ARTWORK_SIZE}.webp`
    : null

  return {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    durationMs: track.durationMs,
    genre: track.genre,
    coverArtUrl,
  }
}

/**
 * Batch-transform an array of track metadata for low-data mode.
 * Also limits the count to METADATA_PREFETCH_LIMIT.
 */
export function toLightMetadataBatch(
  tracks: readonly TrackMetadata[],
  artworkBaseUrl: string,
): readonly LightTrackMetadata[] {
  return tracks
    .slice(0, LOW_DATA_CONFIG.METADATA_PREFETCH_LIMIT)
    .map((t) => toLightMetadata(t, artworkBaseUrl))
}

// ── Bandwidth Estimation ────────────────────────────────────────────────────

export const NetworkType = {
  WIFI: 'wifi',
  CELLULAR_4G: '4g',
  CELLULAR_3G: '3g',
  CELLULAR_2G: '2g',
  UNKNOWN: 'unknown',
} as const

export type NetworkType = (typeof NetworkType)[keyof typeof NetworkType]

/**
 * Determine if low-data mode should be suggested based on network conditions.
 * Pure function.
 */
export function shouldSuggestLowData(params: {
  networkType: NetworkType
  estimatedBandwidthKbps: number | null
  userPreference: boolean | null
}): boolean {
  // Respect explicit user preference
  if (params.userPreference !== null) return params.userPreference

  // Auto-detect: suggest for 2G/3G
  if (params.networkType === NetworkType.CELLULAR_2G) return true
  if (params.networkType === NetworkType.CELLULAR_3G) return true

  // Auto-detect: suggest when bandwidth is very low
  if (params.estimatedBandwidthKbps !== null && params.estimatedBandwidthKbps < 150) {
    return true
  }

  return false
}

/**
 * Select optimal quality tier based on available bandwidth.
 * Pure function.
 */
export function selectQualityForBandwidth(
  estimatedBandwidthKbps: number | null,
  lowDataMode: boolean,
): QualityTier {
  if (lowDataMode) return 'low'
  if (estimatedBandwidthKbps === null) return 'medium'
  if (estimatedBandwidthKbps < 100) return 'low'
  if (estimatedBandwidthKbps < 400) return 'medium'
  return 'high'
}
