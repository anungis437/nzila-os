/**
 * @nzila/zonga-core — Streaming & Media Service Interfaces
 *
 * Contracts for media pipeline operations. Pure interfaces and adapters.
 * Implementations are injected at the app layer; this package provides
 * the contract signatures and in-memory test doubles.
 *
 * @module @nzila/zonga-core/services/media
 */

import type {
  AudioQuality,
  StreamProtocol,
  TranscodeJobStatus,
  MediaValidationResult,
} from '../enums'

import type {
  TranscodeJob,
  TranscodeOutput,
  AssetManifest,
  StreamingToken,
} from '../types/index'

// ── Media Validation ────────────────────────────────────────────────────────

export interface MediaValidationInput {
  readonly fileName: string
  readonly contentType: string
  readonly fileSizeBytes: number
  readonly durationSeconds: number | null
}

export interface MediaValidationOutput {
  readonly result: MediaValidationResult
  readonly errors: readonly string[]
}

/** Max file sizes by type (bytes). */
export const MEDIA_LIMITS = {
  AUDIO_MAX_SIZE: 500_000_000, // 500 MB
  COVER_ART_MAX_SIZE: 10_000_000, // 10 MB
  AUDIO_MIN_DURATION: 5, // seconds
  AUDIO_MAX_DURATION: 7200, // 2 hours
  ALLOWED_AUDIO_TYPES: [
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
    'audio/flac',
    'audio/ogg',
    'audio/webm',
  ] as const,
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
  ] as const,
} as const

/**
 * Validates an uploaded media file against platform constraints.
 * Pure function — no I/O.
 */
export function validateMediaFile(input: MediaValidationInput): MediaValidationOutput {
  const errors: string[] = []

  if (!MEDIA_LIMITS.ALLOWED_AUDIO_TYPES.includes(input.contentType as typeof MEDIA_LIMITS.ALLOWED_AUDIO_TYPES[number])) {
    return { result: 'invalid_format', errors: [`Unsupported format: ${input.contentType}`] }
  }

  if (input.fileSizeBytes > MEDIA_LIMITS.AUDIO_MAX_SIZE) {
    return { result: 'exceeds_size_limit', errors: [`File size ${input.fileSizeBytes} exceeds limit of ${MEDIA_LIMITS.AUDIO_MAX_SIZE} bytes`] }
  }

  if (input.durationSeconds !== null) {
    if (input.durationSeconds < MEDIA_LIMITS.AUDIO_MIN_DURATION) {
      errors.push(`Duration ${input.durationSeconds}s is below minimum of ${MEDIA_LIMITS.AUDIO_MIN_DURATION}s`)
      return { result: 'duration_too_short', errors }
    }
    if (input.durationSeconds > MEDIA_LIMITS.AUDIO_MAX_DURATION) {
      errors.push(`Duration ${input.durationSeconds}s exceeds maximum of ${MEDIA_LIMITS.AUDIO_MAX_DURATION}s`)
      return { result: 'duration_too_long', errors }
    }
  }

  return { result: 'valid', errors: [] }
}

// ── Service Interfaces (Ports) ──────────────────────────────────────────────

/** Port for media upload operations. */
export interface MediaUploadService {
  /** Upload an audio file and return the blob path + fingerprint. */
  uploadAudio(params: {
    creatorId: string
    assetId: string
    file: Uint8Array
    fileName: string
    contentType: string
  }): Promise<{ blobPath: string; sha256: string; sizeBytes: number }>

  /** Upload cover art and return the blob path. */
  uploadCoverArt(params: {
    assetId: string
    file: Uint8Array
    fileName: string
    contentType: string
  }): Promise<{ blobPath: string; sizeBytes: number }>
}

/** Port for transcoding operations. */
export interface TranscodeService {
  /** Submit a transcoding job for an asset. */
  submitJob(params: {
    assetId: string
    sourceUrl: string
    targetQualities: readonly AudioQuality[]
  }): Promise<{ jobId: string }>

  /** Query transcode job status. */
  getJobStatus(jobId: string): Promise<TranscodeJob | null>

  /** Cancel a pending/queued transcoding job. */
  cancelJob(jobId: string): Promise<boolean>
}

/** Port for streaming URL resolution. */
export interface StreamingService {
  /** Resolve a signed streaming URL for an asset at a given quality. */
  resolveStreamUrl(params: {
    assetId: string
    quality: AudioQuality
    listenerId: string | null
    protocol?: StreamProtocol
  }): Promise<{ url: string; token: StreamingToken; expiresAt: string }>

  /** Get the asset manifest with all available qualities. */
  getAssetManifest(assetId: string): Promise<AssetManifest | null>

  /** Generate a preview clip URL (30 seconds). */
  getPreviewUrl(assetId: string): Promise<string | null>
}

/** Port for artwork transformation. */
export interface ArtworkService {
  /** Resize cover art to standard dimensions. */
  resize(params: {
    blobPath: string
    widths: readonly number[]
  }): Promise<readonly { width: number; url: string }[]>

  /** Generate a blurred placeholder for progressive loading. */
  generatePlaceholder(blobPath: string): Promise<string>
}

// ── Bitrate Mapping ─────────────────────────────────────────────────────────

/** Target bitrates (kbps) for each quality tier. */
export const QUALITY_BITRATE_MAP: Readonly<Record<AudioQuality, number>> = {
  low: 32,
  medium: 64,
  high: 128,
  lossless: 320,
}

/**
 * Estimates download size in bytes for a track at a given quality.
 */
export function estimateDownloadSize(durationSeconds: number, quality: AudioQuality): number {
  const bitrateKbps = QUALITY_BITRATE_MAP[quality]
  return Math.ceil((bitrateKbps * 1000 * durationSeconds) / 8)
}
