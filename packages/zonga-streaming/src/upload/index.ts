/**
 * Upload pipeline — validate, parse metadata, generate storage keys.
 */
import { z } from 'zod'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AudioMetadata {
  durationMs: number
  sampleRate: number
  channels: number
  bitrate: number
  codec: string
  format: string
  fileSize: number
}

export interface UploadPolicy {
  maxFileSizeMb: number
  allowedFormats: string[]
  maxDurationMinutes: number
  minBitrate: number
}

export interface UploadValidationResult {
  valid: boolean
  errors: string[]
  metadata: AudioMetadata | null
  suggestedKey: string | null
}

// ── Schemas ─────────────────────────────────────────────────────────────────

export const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(512),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string(),
  creatorId: z.string().uuid(),
  orgId: z.string().uuid(),
  title: z.string().min(1).max(255),
  genre: z.string().max(100).optional(),
})

// ── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_AUDIO_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/mp4']
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']
const MAX_FILE_SIZE_MB = 500
const MAX_DURATION_MINUTES = 120
const MIN_BITRATE = 128

export const DEFAULT_UPLOAD_POLICY: UploadPolicy = {
  maxFileSizeMb: MAX_FILE_SIZE_MB,
  allowedFormats: ALLOWED_AUDIO_FORMATS,
  maxDurationMinutes: MAX_DURATION_MINUTES,
  minBitrate: MIN_BITRATE,
}

// ── Upload Validation ───────────────────────────────────────────────────────

export function validateUpload(
  file: { name: string; size: number; mimeType: string },
  metadata: AudioMetadata | null,
  policy: UploadPolicy = DEFAULT_UPLOAD_POLICY
): UploadValidationResult {
  const errors: string[] = []

  // File size check
  const fileSizeMb = file.size / (1024 * 1024)
  if (fileSizeMb > policy.maxFileSizeMb) {
    errors.push(`File size ${fileSizeMb.toFixed(1)}MB exceeds maximum ${policy.maxFileSizeMb}MB`)
  }

  // MIME type check
  if (!policy.allowedFormats.includes(file.mimeType)) {
    errors.push(`Format '${file.mimeType}' is not supported. Allowed: ${policy.allowedFormats.join(', ')}`)
  }

  // Extension check
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push(`Extension '${ext}' is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }

  // Metadata-dependent checks
  if (metadata) {
    const durationMinutes = metadata.durationMs / 60_000
    if (durationMinutes > policy.maxDurationMinutes) {
      errors.push(`Duration ${durationMinutes.toFixed(1)} min exceeds maximum ${policy.maxDurationMinutes} min`)
    }
    if (metadata.bitrate < policy.minBitrate) {
      errors.push(`Bitrate ${metadata.bitrate}kbps is below minimum ${policy.minBitrate}kbps`)
    }
    if (metadata.channels < 1 || metadata.channels > 8) {
      errors.push(`Invalid channel count: ${metadata.channels}`)
    }
    if (metadata.sampleRate < 8000 || metadata.sampleRate > 384000) {
      errors.push(`Invalid sample rate: ${metadata.sampleRate}Hz`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    metadata,
    suggestedKey: errors.length === 0 ? computeUploadKey(file.name) : null,
  }
}

// ── Audio Metadata Parsing ──────────────────────────────────────────────────

/**
 * Parse audio metadata from raw probe output.
 * In production, ffprobe or a WASM probe provides the raw data;
 * this function normalizes it into our domain type.
 */
export function parseAudioMetadata(probeOutput: {
  duration?: number
  sample_rate?: number
  channels?: number
  bit_rate?: number
  codec_name?: string
  format_name?: string
  size?: number
}): AudioMetadata {
  return {
    durationMs: Math.round((probeOutput.duration ?? 0) * 1000),
    sampleRate: probeOutput.sample_rate ?? 44100,
    channels: probeOutput.channels ?? 2,
    bitrate: Math.round((probeOutput.bit_rate ?? 0) / 1000),
    codec: probeOutput.codec_name ?? 'unknown',
    format: probeOutput.format_name ?? 'unknown',
    fileSize: probeOutput.size ?? 0,
  }
}

// ── Storage Key Generation ──────────────────────────────────────────────────

/**
 * Compute a deterministic, collision-resistant storage key for an upload.
 * Format: uploads/{YYYY}/{MM}/{DD}/{timestamp}-{sanitized-name}
 */
export function computeUploadKey(fileName: string, timestamp?: Date): string {
  const now = timestamp ?? new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  const ts = now.getTime()

  const sanitized = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 128)

  return `uploads/${year}/${month}/${day}/${ts}-${sanitized}`
}
