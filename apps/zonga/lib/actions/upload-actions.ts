/**
 * Zonga Server Actions — Audio Upload
 *
 * Handles audio file and cover art uploads via @nzila/blob.
 * Files are uploaded to Azure Blob Storage, fingerprinted,
 * and linked to content assets.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  AudioUploadMetaSchema,
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
} from '@/lib/zonga-services'
import {
  uploadAudioFile,
  uploadCoverArt,
  getAudioStreamUrl,
  getCoverArtUrl,
  fingerprintAudio,
} from '@/lib/blob'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { getCreatorPlan } from '@/lib/guards/plan-queries'
import { guardCreatorFeature } from '@/lib/guards/subscription-guards'

// ── Upload Audio ────────────────────────────────────────────────────────────

export interface AudioUploadActionResult {
  ok: boolean
  blobPath?: string
  sha256?: string
  sizeBytes?: number
  streamUrl?: string
  error?: string
}

/**
 * Upload an audio file for a content asset.
 * Accepts FormData with the audio file + metadata fields.
 */
export async function uploadAudio(
  formData: FormData,
): Promise<AudioUploadActionResult> {
  const ctx = await resolveOrgContext()

  try {
    const file = formData.get('file') as File | null
    if (!file) return { ok: false, error: 'No file provided' }

    const meta = AudioUploadMetaSchema.parse({
      creatorId: formData.get('creatorId'),
      assetId: formData.get('assetId'),
      fileName: file.name,
      contentType: file.type,
      fileSizeBytes: file.size,
    })

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await uploadAudioFile({
      creatorId: meta.creatorId,
      assetId: meta.assetId,
      fileName: meta.fileName,
      buffer,
      contentType: meta.contentType,
    })

    // Compute fingerprint for integrity / duplicate detection
    const sha256 = await fingerprintAudio(buffer)

    // Update the content asset record with storage URL + fingerprint
    const storageUrl = `blob://${result.blobPath}`

    await platformDb.execute(sql`
      UPDATE zonga_content_assets
      SET storage_url = ${storageUrl},
          updated_at  = now()
      WHERE id = ${meta.assetId} AND org_id = ${ctx.orgId}
    `)

    // Audit
    const audit = buildZongaAuditEvent({
      orgId: meta.creatorId,
      actorId: ctx.actorId,
      action: ZongaAuditAction.CONTENT_UPLOAD,
      entityType: ZongaEntityType.CONTENT_ASSET,
      targetId: meta.assetId,
      metadata: {
        fileName: meta.fileName,
        contentType: meta.contentType,
        sizeBytes: result.sizeBytes,
        sha256,
      },
    })
    await platformDb.execute(sql`
      INSERT INTO audit_log (entity_id, actor_id, action, metadata, org_id)
      VALUES (${audit.orgId}, ${audit.actorId}, ${audit.action}, ${JSON.stringify(audit.metadata)}::jsonb, ${ctx.orgId})
    `)

    // Evidence pack
    const evidence = buildEvidencePackFromAction({
      actionType: 'uploadAudio',
      orgId: meta.assetId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(evidence)

    // Generate a streaming URL for immediate playback
    const streamUrl = await getAudioStreamUrl(result.blobPath)

    revalidatePath('/dashboard/catalog')
    logger.info('Audio uploaded', { assetId: meta.assetId, sizeBytes: result.sizeBytes })

    return {
      ok: true,
      blobPath: result.blobPath,
      sha256,
      sizeBytes: result.sizeBytes,
      streamUrl,
    }
  } catch (err) {
    logger.error('Audio upload failed', { error: String(err) })
    return { ok: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }
}

// ── Upload Cover Art ────────────────────────────────────────────────────────

export interface CoverUploadResult {
  ok: boolean
  coverUrl?: string
  error?: string
}

/**
 * Upload cover art for a content asset.
 * Accepts FormData with the image file + metadata fields.
 */
export async function uploadCover(
  formData: FormData,
): Promise<CoverUploadResult> {
  const ctx = await resolveOrgContext()

  try {
    const file = formData.get('file') as File | null
    if (!file) return { ok: false, error: 'No file provided' }

    const creatorId = formData.get('creatorId') as string
    const assetId = formData.get('assetId') as string

    if (!creatorId || !assetId) {
      return { ok: false, error: 'Missing creatorId or assetId' }
    }

    // Validate cover art size (max 10 MB) and content type before loading into memory
    const COVER_MAX_BYTES = 10 * 1024 * 1024
    if (file.size > COVER_MAX_BYTES) {
      return { ok: false, error: `Cover art too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.` }
    }
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { ok: false, error: `Invalid image type: ${file.type}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` }
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await uploadCoverArt({
      creatorId,
      assetId,
      fileName: file.name,
      buffer,
      contentType: file.type,
    })

    const coverUrl = await getCoverArtUrl(result.blobPath)

    // Update asset with cover art URL
    await platformDb.execute(sql`
      UPDATE zonga_content_assets
      SET cover_art_url = ${coverUrl},
          updated_at    = now()
      WHERE id = ${assetId} AND org_id = ${ctx.orgId}
    `)

    revalidatePath('/dashboard/catalog')
    logger.info('Cover art uploaded', { assetId, sizeBytes: result.sizeBytes })

    return { ok: true, coverUrl }
  } catch (err) {
    logger.error('Cover upload failed', { error: String(err) })
    return { ok: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }
}

// ── Get Stream URL ──────────────────────────────────────────────────────────

/**
 * Generate a new time-limited streaming URL for an existing audio file.
 */
export async function getStreamUrl(blobPath: string): Promise<string> {
  const _ctx = await resolveOrgContext()

  return getAudioStreamUrl(blobPath)
}

// ── Bulk Upload (Label Plan Required — S2 Guard) ────────────────────────────

export interface BulkUploadResult {
  ok: boolean
  uploaded: Array<{ assetId: string; fileName: string; blobPath: string }>
  failed: Array<{ fileName: string; error: string }>
  error?: string
}

/**
 * Upload multiple audio files at once. Requires label plan or above (S2 guard).
 * Accepts FormData with multiple files + a creatorId field.
 */
export async function bulkUploadAudio(
  formData: FormData,
): Promise<BulkUploadResult> {
  const ctx = await resolveOrgContext()
  const creatorId = formData.get('creatorId') as string

  if (!creatorId) {
    return { ok: false, uploaded: [], failed: [], error: 'Missing creatorId' }
  }

  // S2: bulk upload requires label plan
  const planInfo = await getCreatorPlan(creatorId, ctx.orgId)
  const guard = guardCreatorFeature(planInfo.plan, 'bulk_upload')
  if (!guard.passed) {
    return { ok: false, uploaded: [], failed: [], error: guard.details ?? 'Label plan required for bulk uploads' }
  }

  const files = formData.getAll('files') as File[]
  if (files.length === 0) {
    return { ok: false, uploaded: [], failed: [], error: 'No files provided' }
  }

  // Limit batch size to prevent memory exhaustion
  const MAX_BULK_FILES = 50
  if (files.length > MAX_BULK_FILES) {
    return { ok: false, uploaded: [], failed: [], error: `Too many files (${files.length}). Maximum is ${MAX_BULK_FILES} per batch.` }
  }

  const AUDIO_MAX_BYTES = 500_000_000 // 500 MB per file
  const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/webm']

  const uploaded: BulkUploadResult['uploaded'] = []
  const failed: BulkUploadResult['failed'] = []

  for (const file of files) {
    // Validate per-file size and content type before loading into memory
    if (file.size > AUDIO_MAX_BYTES) {
      failed.push({ fileName: file.name, error: `File too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum is 500 MB.` })
      continue
    }
    if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
      failed.push({ fileName: file.name, error: `Invalid audio type: ${file.type}` })
      continue
    }

    try {
      const assetId = crypto.randomUUID()

      // Create the content asset record first
      await platformDb.execute(
        sql`INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status)
        VALUES (${assetId}, ${ctx.orgId}, ${creatorId}, ${file.name.replace(/\.[^.]+$/, '')}, 'track', 'draft')`,
      )

      const buffer = Buffer.from(await file.arrayBuffer())

      const result = await uploadAudioFile({
        creatorId,
        assetId,
        fileName: file.name,
        buffer,
        contentType: file.type,
      })

      const sha256 = await fingerprintAudio(buffer)
      const storageUrl = `blob://${result.blobPath}`

      await platformDb.execute(
        sql`UPDATE zonga_content_assets
        SET storage_url = ${storageUrl}, updated_at = now()
        WHERE id = ${assetId} AND org_id = ${ctx.orgId}`,
      )

      uploaded.push({ assetId, fileName: file.name, blobPath: result.blobPath })

      logger.info('Bulk upload: file processed', { assetId, fileName: file.name, sha256 })
    } catch (err) {
      failed.push({ fileName: file.name, error: err instanceof Error ? err.message : 'Upload failed' })
      logger.warn('Bulk upload: file failed', { fileName: file.name, error: String(err) })
    }
  }

  // Audit the bulk operation
  const audit = buildZongaAuditEvent({
    orgId: creatorId,
    actorId: ctx.actorId,
    action: ZongaAuditAction.CONTENT_UPLOAD,
    entityType: ZongaEntityType.CONTENT_ASSET,
    targetId: creatorId,
    metadata: { bulkUpload: true, totalFiles: files.length, succeeded: uploaded.length, failed: failed.length },
  })
  await platformDb.execute(
    sql`INSERT INTO audit_log (entity_id, actor_id, action, metadata, org_id)
    VALUES (${audit.orgId}, ${audit.actorId}, ${audit.action}, ${JSON.stringify(audit.metadata)}::jsonb, ${ctx.orgId})`,
  )

  revalidatePath('/dashboard/catalog')

  return {
    ok: failed.length === 0,
    uploaded,
    failed,
  }
}
