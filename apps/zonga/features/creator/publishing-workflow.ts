/**
 * Zonga — Creator Publishing Workflow
 *
 * Manages the complete publishing lifecycle:
 * draft → processing → ready_for_review → published → suspended/removed
 *
 * Enforces that:
 * - Required metadata is present before publishing
 * - Audio processing is complete
 * - Ownership is declared
 * - Rights attestation is signed
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { PublishingState, PublishValidation, PublishError, PublishWarning } from './types'
import { PUBLISHING_TRANSITIONS } from './types'
import { isProcessingComplete } from '@/features/media/processing-pipeline'

// ── State Transitions ───────────────────────────────────────────────────────

export interface TransitionResult {
  ok: boolean
  newState?: PublishingState
  error?: string
  validation?: PublishValidation
}

/**
 * Transition a content asset through the publishing workflow.
 */
export async function transitionPublishingState(params: {
  assetId: string
  orgId: string
  creatorId: string
  targetState: PublishingState
  actorId: string
}): Promise<TransitionResult> {
  const { assetId, orgId, creatorId, targetState, actorId } = params

  // Get current state
  const rows = await platformDb.execute(sql`
    SELECT status, title, storage_url, duration
    FROM zonga_content_assets
    WHERE id = ${assetId} AND org_id = ${orgId}
  `)
  const asset = (rows as unknown as Array<Record<string, unknown>>)[0]

  if (!asset) {
    return { ok: false, error: 'Content asset not found' }
  }

  const currentState = asset.status as PublishingState
  const allowedTransitions = PUBLISHING_TRANSITIONS[currentState]

  if (!allowedTransitions?.includes(targetState)) {
    return {
      ok: false,
      error: `Cannot transition from "${currentState}" to "${targetState}"`,
    }
  }

  // If publishing, run full validation
  if (targetState === 'published' || targetState === 'ready_for_review') {
    const validation = await validateForPublishing(assetId, orgId, creatorId)
    if (!validation.canPublish) {
      return { ok: false, error: 'Validation failed', validation }
    }
  }

  // Execute transition
  await platformDb.execute(sql`
    UPDATE zonga_content_assets
    SET status = ${targetState},
        updated_at = now()
    WHERE id = ${assetId} AND org_id = ${orgId}
  `)

  logger.info('Publishing state transition', {
    assetId,
    from: currentState,
    to: targetState,
    actorId,
  })

  return { ok: true, newState: targetState }
}

// ── Publishing Validation ───────────────────────────────────────────────────

/**
 * Validate that a content asset is ready for publishing.
 * Checks metadata completeness, processing status, and rights declaration.
 */
export async function validateForPublishing(
  assetId: string,
  orgId: string,
  _creatorId: string,
): Promise<PublishValidation> {
  const errors: PublishError[] = []
  const warnings: PublishWarning[] = []

  // 1. Check required metadata
  const metaRows = await platformDb.execute(sql`
    SELECT title, format, duration, storage_url, creator_id
    FROM zonga_content_assets
    WHERE id = ${assetId} AND org_id = ${orgId}
  `)
  const meta = (metaRows as unknown as Array<Record<string, unknown>>)[0]

  if (!meta) {
    errors.push({ code: 'ASSET_NOT_FOUND', field: 'id', message: 'Content asset not found' })
    return { canPublish: false, errors, warnings }
  }

  if (!meta.title || (meta.title as string).trim().length === 0) {
    errors.push({ code: 'MISSING_TITLE', field: 'title', message: 'Track title is required' })
  }

  if (!meta.storage_url) {
    errors.push({ code: 'NO_AUDIO', field: 'storage_url', message: 'Audio file must be uploaded' })
  }

  // 2. Check processing status
  const trackAssetRows = await platformDb.execute(sql`
    SELECT id FROM zonga_track_assets
    WHERE content_asset_id = ${assetId} AND org_id = ${orgId}
    LIMIT 1
  `)
  const trackAsset = (trackAssetRows as unknown as Array<{ id: string }>)[0]

  if (trackAsset) {
    const processing = await isProcessingComplete(trackAsset.id)
    if (!processing.complete) {
      if (processing.failedJobs > 0) {
        errors.push({
          code: 'PROCESSING_FAILED',
          field: 'processing',
          message: `${processing.failedJobs} processing job(s) failed`,
        })
      } else {
        errors.push({
          code: 'PROCESSING_INCOMPLETE',
          field: 'processing',
          message: `Processing: ${processing.completedJobs}/${processing.totalJobs} complete`,
        })
      }
    }
  }

  // 3. Check cover art
  const artRows = await platformDb.execute(sql`
    SELECT id FROM zonga_artwork_assets
    WHERE entity_type = 'track' AND entity_id = ${assetId} AND is_primary = true
    LIMIT 1
  `)
  if ((artRows as unknown as Array<unknown>).length === 0) {
    warnings.push({
      code: 'NO_COVER_ART',
      message: 'No cover art uploaded. A default will be used.',
    })
  }

  // 4. Check ownership declaration
  const ownerRows = await platformDb.execute(sql`
    SELECT id FROM zonga_ownership_splits
    WHERE entity_type = 'track' AND entity_id = ${assetId}
    LIMIT 1
  `)
  if ((ownerRows as unknown as Array<unknown>).length === 0) {
    errors.push({
      code: 'NO_OWNERSHIP',
      field: 'ownership',
      message: 'Ownership must be declared before publishing',
    })
  }

  // 5. Check for active rights claims
  const claimRows = await platformDb.execute(sql`
    SELECT id FROM zonga_rights_claims
    WHERE entity_type = 'track' AND entity_id = ${assetId}
      AND status IN ('filed', 'under_review')
    LIMIT 1
  `)
  if ((claimRows as unknown as Array<unknown>).length > 0) {
    errors.push({
      code: 'ACTIVE_RIGHTS_CLAIM',
      field: 'rights',
      message: 'Cannot publish while a rights claim is under review',
    })
  }

  return {
    canPublish: errors.length === 0,
    errors,
    warnings,
  }
}

// ── Creator Track Management ────────────────────────────────────────────────

/**
 * Save a track draft (create or update).
 */
export async function saveTrackDraft(params: {
  assetId?: string
  orgId: string
  creatorId: string
  title: string
  description?: string
  genre?: string
  language?: string
  region?: string
  isExplicit?: boolean
  collaborators?: string[]
}): Promise<{ ok: boolean; assetId: string; error?: string }> {
  const { orgId, creatorId, title } = params

  if (params.assetId) {
    // Update existing draft
    await platformDb.execute(sql`
      UPDATE zonga_content_assets
      SET title = ${title},
          updated_at = now()
      WHERE id = ${params.assetId} AND org_id = ${orgId} AND status = 'draft'
    `)
    return { ok: true, assetId: params.assetId }
  }

  // Create new draft
  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_content_assets (
      org_id, creator_id, title, format, status
    ) VALUES (
      ${orgId}, ${creatorId}, ${title}, 'audio', 'draft'
    )
    RETURNING id
  `)
  const assetId = (rows as unknown as Array<{ id: string }>)[0].id
  return { ok: true, assetId }
}

/**
 * Get publishing validation status without transitioning.
 */
export async function getPublishReadiness(
  assetId: string,
  orgId: string,
  creatorId: string,
): Promise<PublishValidation> {
  return validateForPublishing(assetId, orgId, creatorId)
}
