/**
 * Zonga — Upload Service
 *
 * Handles the complete upload lifecycle:
 * validate → persist metadata → store raw file → enqueue processing
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { uploadBuffer, computeSha256 } from '@nzila/blob'
import { uploadToS3, computeRawStorageKey } from '@nzila/zonga-streaming-aws/s3-storage'
import { resolveS3Config } from '@nzila/zonga-streaming-aws'
import { assertBufferSafeForUpload, isMalwareScanError } from '@/lib/security/clamav'
import { ALLOWED_AUDIO_TYPES, ALLOWED_IMAGE_TYPES, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES } from './types'
import type { ArtworkAsset } from './types'
import { enqueueProcessingJobs } from './processing-pipeline'
import { checkForDuplicate } from '@/features/safety/duplicate-detection'

// ── Audio Upload ────────────────────────────────────────────────────────────

export interface UploadAudioResult {
  ok: boolean
  trackAssetId?: string
  processingJobIds?: string[]
  error?: string
  isDuplicate?: boolean
}

export async function uploadTrackAudio(params: {
  contentAssetId: string
  orgId: string
  creatorId: string
  file: File
}): Promise<UploadAudioResult> {
  const { contentAssetId, orgId, creatorId, file } = params

  // Validate file type
  if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
    return { ok: false, error: `Unsupported audio format: ${file.type}` }
  }

  // Validate file size
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: `File too large. Maximum: ${MAX_AUDIO_BYTES / 1024 / 1024}MB` }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const sha256 = await computeSha256(buffer)

  // Malware scan — must run before any S3/blob persistence
  try {
    await assertBufferSafeForUpload(buffer, file.name)
  } catch (error) {
    if (isMalwareScanError(error)) {
      logger.warn('Audio upload blocked by malware scanner', {
        contentAssetId,
        reason: error.result.reason ?? error.result.signature,
        status: error.result.status,
      })
      return {
        ok: false,
        error:
          error.result.status === 'infected'
            ? 'File blocked: malware detected'
            : 'File could not be scanned right now. Please try again later.',
      }
    }
    throw error
  }

  // Check for duplicate fingerprint
  const dupCheck = await checkForDuplicate({
    sha256,
    title: file.name,
    artistName: '',
    orgId,
  })
  if (dupCheck.isDuplicate) {
    logger.warn('Duplicate upload detected', {
      sha256,
      existingAssetId: dupCheck.matchedAssetId,
    })
    return {
      ok: false,
      error: 'This audio file has already been uploaded',
      isDuplicate: true,
    }
  }

  // Build S3 storage key
  const s3Config = resolveS3Config()
  const storageKey = computeRawStorageKey(orgId, contentAssetId, file.name)

  try {
    // Upload raw file directly to S3 (MediaConvert reads from S3)
    await uploadToS3(s3Config, {
      orgId,
      assetId: contentAssetId,
      fileName: file.name,
      contentType: file.type,
      body: buffer,
    })

    // Create track asset record
    const rows = await platformDb.execute(sql`
      INSERT INTO zonga_track_assets (
        content_asset_id, org_id, creator_id,
        storage_bucket, storage_key,
        original_filename, mime_type, file_size_bytes,
        sha256_fingerprint, upload_status
      ) VALUES (
        ${contentAssetId}, ${orgId}, ${creatorId},
        ${s3Config.rawBucket}, ${storageKey},
        ${file.name}, ${file.type}, ${file.size},
        ${sha256}, 'completed'
      )
      RETURNING id
    `)
    const trackAssetId = (rows as unknown as Array<{ id: string }>)[0].id

    // Enqueue processing jobs
    const jobIds = await enqueueProcessingJobs({
      trackAssetId,
      orgId,
      creatorId,
      inputKey: storageKey,
    })

    logger.info('Track audio uploaded', {
      trackAssetId,
      contentAssetId,
      size: file.size,
      jobCount: jobIds.length,
    })

    return {
      ok: true,
      trackAssetId,
      processingJobIds: jobIds,
    }
  } catch (error) {
    logger.error('Audio upload failed', { error, contentAssetId })
    return { ok: false, error: 'Upload failed. Please try again.' }
  }
}

// ── Artwork Upload ──────────────────────────────────────────────────────────

export interface UploadArtworkResult {
  ok: boolean
  artworkId?: string
  storageKey?: string
  error?: string
}

export async function uploadArtwork(params: {
  entityType: ArtworkAsset['entityType']
  resourceId: string
  orgId: string
  file: File
  isPrimary?: boolean
}): Promise<UploadArtworkResult> {
  const { entityType, resourceId, orgId, file, isPrimary = true } = params

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: `Unsupported image format: ${file.type}` }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Image too large. Maximum: ${MAX_IMAGE_BYTES / 1024 / 1024}MB` }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() ?? 'jpg'
  const storageKey = `artwork/${entityType}/${resourceId}/${Date.now()}.${ext}`

  try {
    await assertBufferSafeForUpload(buffer, storageKey)

    await uploadBuffer({
      container: 'zonga-covers',
      blobPath: storageKey,
      buffer,
      contentType: file.type,
    })

    // Unset existing primary if setting new primary
    if (isPrimary) {
      await platformDb.execute(sql`
        UPDATE zonga_artwork_assets
        SET is_primary = false
        WHERE entity_type = ${entityType}
          AND entity_id = ${resourceId}
          AND is_primary = true
      `)
    }

    const rows = await platformDb.execute(sql`
      INSERT INTO zonga_artwork_assets (
        entity_type, entity_id, org_id,
        storage_key, mime_type, file_size_bytes, is_primary
      ) VALUES (
        ${entityType}, ${resourceId}, ${orgId},
        ${storageKey}, ${file.type}, ${file.size}, ${isPrimary}
      )
      RETURNING id
    `)
    const artworkId = (rows as unknown as Array<{ id: string }>)[0].id

    return { ok: true, artworkId, storageKey }
  } catch (error) {
    if (isMalwareScanError(error)) {
      logger.warn('Artwork upload blocked by malware scanner', {
        entityType,
        resourceId,
        reason: error.result.reason ?? error.result.signature,
        status: error.result.status,
      })
      return {
        ok: false,
        error:
          error.result.status === 'infected'
            ? 'Image blocked: malware detected'
            : 'Image could not be scanned right now. Please try again later.',
      }
    }
    logger.error('Artwork upload failed', { error, entityType, resourceId })
    return { ok: false, error: 'Artwork upload failed' }
  }
}
