/**
 * Zonga — Audio Blob Storage
 *
 * Wires @nzila/blob (Azure Blob Storage) for audio file uploads,
 * cover art, and SAS URL generation for streaming.
 *
 * Container layout:
 *   zonga-audio/   — audio master files (WAV/FLAC/MP3)
 *   zonga-covers/  — album/track cover art (JPEG/PNG/WEBP)
 *   zonga-encoded/ — transcoded quality tiers (generated offline)
 *
 * @module apps/zonga/lib/blob
 */

import { uploadBuffer, generateSasUrl, computeSha256 } from '@nzila/blob'
import { assertBufferSafeForUpload, type MalwareScanResult } from '@/lib/security/clamav'

// ── Constants ───────────────────────────────────────────────────────────────

export const AUDIO_CONTAINER = 'zonga-audio'
export const COVER_CONTAINER = 'zonga-covers'
export const ENCODED_CONTAINER = 'zonga-encoded'

/** 500 MB — hard limit on raw audio uploads. */
export const MAX_AUDIO_SIZE_BYTES = 500 * 1024 * 1024

/** 10 MB — cover art limit. */
export const MAX_COVER_SIZE_BYTES = 10 * 1024 * 1024

const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/flac',
  'audio/ogg',
  'audio/webm',
])

const COVER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

// ── Upload Audio ────────────────────────────────────────────────────────────

export interface UploadAudioParams {
  creatorId: string
  assetId: string
  fileName: string
  buffer: Buffer
  contentType: string
}

export interface UploadAudioResult {
  blobPath: string
  sha256: string
  sizeBytes: number
  malwareScan: MalwareScanResult
}

/**
 * Upload a raw audio file to Azure Blob Storage.
 *
 * Path convention: `{creatorId}/{assetId}/{fileName}`
 * SHA-256 fingerprint is computed for duplicate/integrity detection.
 */
export async function uploadAudioFile(
  params: UploadAudioParams,
): Promise<UploadAudioResult> {
  const { creatorId, assetId, fileName, buffer, contentType } = params

  if (!AUDIO_MIME_TYPES.has(contentType)) {
    throw new Error(`Unsupported audio content type: ${contentType}`)
  }

  if (buffer.length > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(
      `Audio file exceeds ${MAX_AUDIO_SIZE_BYTES / (1024 * 1024)} MB limit`,
    )
  }

  const blobPath = `${creatorId}/${assetId}/${fileName}`

  const malwareScan = await assertBufferSafeForUpload(buffer, blobPath)

  const result = await uploadBuffer({
    container: AUDIO_CONTAINER,
    blobPath,
    buffer,
    contentType,
  })

  return {
    blobPath: result.blobPath,
    sha256: result.sha256,
    sizeBytes: result.sizeBytes,
    malwareScan,
  }
}

// ── Upload Cover Art ────────────────────────────────────────────────────────

export interface UploadCoverParams {
  creatorId: string
  assetId: string
  fileName: string
  buffer: Buffer
  contentType: string
}

/**
 * Upload cover art image for a track, album, or release.
 */
export async function uploadCoverArt(
  params: UploadCoverParams,
): Promise<UploadAudioResult> {
  const { creatorId, assetId, fileName, buffer, contentType } = params

  if (!COVER_MIME_TYPES.has(contentType)) {
    throw new Error(`Unsupported image content type: ${contentType}`)
  }

  if (buffer.length > MAX_COVER_SIZE_BYTES) {
    throw new Error(
      `Cover art exceeds ${MAX_COVER_SIZE_BYTES / (1024 * 1024)} MB limit`,
    )
  }

  const blobPath = `${creatorId}/${assetId}/${fileName}`

  const malwareScan = await assertBufferSafeForUpload(buffer, blobPath)

  const result = await uploadBuffer({
    container: COVER_CONTAINER,
    blobPath,
    buffer,
    contentType,
  })

  return {
    blobPath: result.blobPath,
    sha256: result.sha256,
    sizeBytes: result.sizeBytes,
    malwareScan,
  }
}

// ── Streaming URL Generation ────────────────────────────────────────────────

/**
 * Generate a time-limited SAS URL for streaming or downloading an audio file.
 * Default expiry: 1 hour.
 */
export async function getAudioStreamUrl(
  blobPath: string,
  expiryMinutes = 60,
): Promise<string> {
  return generateSasUrl(AUDIO_CONTAINER, blobPath, expiryMinutes)
}

/**
 * Generate a time-limited SAS URL for serving cover art.
 * Default expiry: 24 hours (can be cached by CDN).
 */
export async function getCoverArtUrl(
  blobPath: string,
  expiryMinutes = 1440,
): Promise<string> {
  return generateSasUrl(COVER_CONTAINER, blobPath, expiryMinutes)
}

// ── Fingerprint ─────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 fingerprint for an audio buffer.
 * Used for duplicate detection and integrity verification.
 */
export async function fingerprintAudio(buffer: Buffer): Promise<string> {
  return computeSha256(buffer)
}
