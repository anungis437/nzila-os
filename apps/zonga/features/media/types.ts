/**
 * Zonga — Media Infrastructure Types
 *
 * Canonical types for the media storage, processing, and delivery pipeline.
 */

// ── Track Asset ─────────────────────────────────────────────────────────────

export interface TrackAsset {
  id: string
  contentAssetId: string
  orgId: string
  creatorId: string
  storageBucket: 'raw-uploads' | 'processed-audio' | 'artwork' | 'event-assets'
  storageKey: string
  originalFilename: string
  mimeType: string
  fileSizeBytes: number
  sha256Fingerprint?: string
  durationSeconds?: number
  sampleRate?: number
  bitDepth?: number
  channels?: number
  uploadStatus: UploadStatus
  createdAt: Date
  updatedAt: Date
}

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed'

// ── Processed Variant ───────────────────────────────────────────────────────

export interface ProcessedVariant {
  id: string
  trackAssetId: string
  qualityTier: QualityTier
  format: AudioFormat
  bitrate: number
  codec: string
  storageKey: string
  fileSizeBytes: number
  durationSeconds?: number
  loudnessLufs?: number
  createdAt: Date
}

export type QualityTier = 'free' | 'standard' | 'high' | 'premium' | 'hifi' | 'preview'
export type AudioFormat = 'aac' | 'mp3' | 'flac' | 'opus' | 'ogg'

// ── Artwork Asset ───────────────────────────────────────────────────────────

export interface ArtworkAsset {
  id: string
  entityType: 'track' | 'release' | 'event' | 'artist' | 'playlist'
  resourceId: string
  orgId: string
  storageKey: string
  mimeType: string
  width?: number
  height?: number
  fileSizeBytes: number
  isPrimary: boolean
  createdAt: Date
}

// ── Upload Job ──────────────────────────────────────────────────────────────

export interface UploadJob {
  id: string
  trackAssetId: string
  orgId: string
  creatorId: string
  jobType: JobType
  status: JobStatus
  priority: number
  attempts: number
  maxAttempts: number
  errorMessage?: string
  inputKey: string
  outputKey?: string
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type JobType = 'transcode' | 'normalize' | 'waveform' | 'fingerprint' | 'metadata_extract'
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retrying'

// ── Processing Config ───────────────────────────────────────────────────────

export const PROCESSING_PROFILES: Record<QualityTier, {
  format: AudioFormat
  bitrate: number
  codec: string
  sampleRate: number
}> = {
  free: { format: 'opus', bitrate: 48, codec: 'opus', sampleRate: 22050 },
  preview: { format: 'opus', bitrate: 64, codec: 'opus', sampleRate: 22050 },
  standard: { format: 'aac', bitrate: 128, codec: 'aac', sampleRate: 44100 },
  high: { format: 'aac', bitrate: 256, codec: 'aac', sampleRate: 44100 },
  premium: { format: 'flac', bitrate: 1411, codec: 'flac', sampleRate: 96000 },
  hifi: { format: 'flac', bitrate: 1411, codec: 'flac', sampleRate: 96000 },
}

export const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg', 'audio/mp4', 'audio/aac',
  'audio/wav', 'audio/flac', 'audio/ogg', 'audio/webm',
])

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
])

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024  // 500 MB
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024   // 10 MB

// ── Playback Event ──────────────────────────────────────────────────────────

export interface PlaybackEvent {
  id: string
  listenerId?: string
  contentAssetId: string
  qualityTier: QualityTier
  durationMs: number
  completed: boolean
  skipped: boolean
  skipPositionMs?: number
  source: PlaybackSource
  deviceType?: string
  country?: string
  createdAt: Date
}

export type PlaybackSource = 'catalog' | 'playlist' | 'search' | 'radio' | 'event' | 'share_link' | 'embed'
