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

    // Update the content asset record with storage URL
    const storageUrl = `blob://${result.blobPath}`

    await platformDb.execute(sql`
      UPDATE audit_log SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{storageUrl}',
        ${JSON.stringify(storageUrl)}::jsonb
      )
      WHERE id = ${meta.assetId} AND org_id = ${ctx.entityId}
    `)

    // Audit
    const audit = buildZongaAuditEvent({
      entityId: meta.creatorId,
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
      VALUES (${audit.entityId}, ${audit.actorId}, ${audit.action}, ${JSON.stringify(audit.metadata)}::jsonb, ${ctx.entityId})
    `)

    // Evidence pack
    const evidence = buildEvidencePackFromAction({
      actionType: 'uploadAudio',
      entityId: meta.assetId,
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
      UPDATE audit_log SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{coverArtUrl}',
        ${JSON.stringify(coverUrl)}::jsonb
      )
      WHERE id = ${assetId} AND org_id = ${ctx.entityId}
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
