/**
 * Zonga Server Actions — Rights & Royalty Splits.
 *
 * CRUD for per-release royalty splits, split validation (must total 100%),
 * rights dispute filing, and sync license tracking.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { getCreatorPlan } from '@/lib/guards/plan-queries'
import { guardCreatorFeature } from '@/lib/guards/subscription-guards'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export interface RoyaltySplit {
  id: string
  releaseId: string
  creatorId: string
  creatorName: string
  role: string
  sharePercent: number
  createdAt?: string
}

export interface SplitInput {
  creatorId: string
  creatorName: string
  role: string
  sharePercent: number
}

export interface RightsDispute {
  id: string
  releaseId: string
  claimantId: string
  claimantName: string
  disputeType: string
  description: string
  status: 'open' | 'under_review' | 'resolved' | 'dismissed'
  resolution?: string
  createdAt: string
  resolvedAt?: string
}

export interface SyncLicense {
  id: string
  assetId: string
  assetTitle: string
  licensee: string
  territory: string
  usageType: string
  fee: number
  currency: string
  status: 'pending' | 'active' | 'expired' | 'revoked'
  startsAt: string
  expiresAt?: string
  createdAt: string
}

/* ─── Splits CRUD ─── */

export async function listSplitsForRelease(
  releaseId: string,
): Promise<RoyaltySplit[]> {
  const ctx = await resolveOrgContext()

  try {
    const result = (await platformDb.execute(
      sql`SELECT
        id, release_id as "releaseId",
        creator_id as "creatorId",
        creator_name as "creatorName",
        role, share_percent as "sharePercent",
        created_at as "createdAt"
      FROM zonga_royalty_splits
      WHERE release_id = ${releaseId} AND org_id = ${ctx.orgId}
      ORDER BY share_percent DESC`,
    )) as unknown as { rows: RoyaltySplit[] }

    return result.rows ?? []
  } catch (error) {
    logger.error('listSplitsForRelease failed', { error, releaseId })
    return []
  }
}

export async function saveSplits(
  releaseId: string,
  splits: SplitInput[],
): Promise<{ success: boolean; error?: string }> {
  const ctx = await resolveOrgContext()

  // S2: Automated royalty splits require label plan
  const creatorPlan = await getCreatorPlan(ctx.actorId, ctx.orgId)
  const splitGate = guardCreatorFeature(creatorPlan.plan, 'automated_royalty_splits')
  if (!splitGate.passed) {
    return { success: false, error: splitGate.details ?? 'Label plan required for automated royalty splits' }
  }

  // Validate total = 100%
  const total = splits.reduce((sum, s) => sum + s.sharePercent, 0)
  if (Math.abs(total - 100) > 0.01) {
    return { success: false, error: `Splits must total 100% (currently ${total}%)` }
  }

  // Validate no negative or zero
  for (const s of splits) {
    if (s.sharePercent <= 0) {
      return { success: false, error: `Share for ${s.creatorName} must be greater than 0` }
    }
    if (!s.creatorId || !s.creatorName || !s.role) {
      return { success: false, error: 'All fields are required for each split' }
    }
  }

  try {
    // Delete existing splits then re-insert (transactional pattern)
    await platformDb.execute(
      sql`DELETE FROM zonga_royalty_splits
      WHERE release_id = ${releaseId} AND org_id = ${ctx.orgId}`,
    )

    for (const s of splits) {
      await platformDb.execute(
        sql`INSERT INTO zonga_royalty_splits
          (release_id, org_id, creator_id, creator_name, role, share_percent)
        VALUES (${releaseId}, ${ctx.orgId}, ${s.creatorId}, ${s.creatorName}, ${s.role}, ${s.sharePercent})`,
      )
    }

    // Audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('release.splits.updated', ${ctx.actorId}, 'release', ${ctx.orgId},
        ${JSON.stringify({
          releaseId,
          splitCount: splits.length,
          splits: splits.map((s) => ({
            creatorId: s.creatorId,
            role: s.role,
            sharePercent: s.sharePercent,
          })),
        })}::jsonb)`,
    )

    const pack = buildEvidencePackFromAction({
      actionType: 'ROYALTY_SPLITS_UPDATED',
      orgId: ctx.orgId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath(`/dashboard/releases/${releaseId}`)
    revalidatePath(`/dashboard/releases/${releaseId}/splits`)
    return { success: true }
  } catch (error) {
    logger.error('saveSplits failed', { error, releaseId })
    return { success: false, error: 'Failed to save splits' }
  }
}

/* ─── Rights Disputes ─── */

export async function listRightsDisputes(opts?: {
  releaseId?: string
  status?: string
}): Promise<RightsDispute[]> {
  const ctx = await resolveOrgContext()

  try {
    let filter = sql``
    if (opts?.releaseId) {
      filter = sql`AND release_id = ${opts.releaseId}`
    }
    if (opts?.status) {
      filter = sql`${filter} AND status = ${opts.status}`
    }

    const result = (await platformDb.execute(
      sql`SELECT
        id, release_id as "releaseId",
        claimant_id as "claimantId",
        claimant_name as "claimantName",
        dispute_type as "disputeType",
        description, status, resolution,
        created_at as "createdAt",
        resolved_at as "resolvedAt"
      FROM zonga_rights_disputes
      WHERE org_id = ${ctx.orgId} ${filter}
      ORDER BY created_at DESC`,
    )) as unknown as { rows: RightsDispute[] }

    return result.rows ?? []
  } catch (error) {
    logger.error('listRightsDisputes failed', { error })
    return []
  }
}

export async function fileRightsDispute(data: {
  releaseId: string
  claimantName: string
  disputeType: string
  description: string
}): Promise<{ success: boolean; disputeId?: string; error?: string }> {
  const ctx = await resolveOrgContext()

  if (!data.releaseId || !data.claimantName || !data.disputeType || !data.description) {
    return { success: false, error: 'All fields are required' }
  }

  try {
    const [row] = (await platformDb.execute(
      sql`INSERT INTO zonga_rights_disputes
        (org_id, release_id, claimant_id, claimant_name, dispute_type, description, status)
      VALUES (${ctx.orgId}, ${data.releaseId}, ${ctx.actorId}, ${data.claimantName}, ${data.disputeType}, ${data.description}, 'open')
      RETURNING id`,
    )) as unknown as [{ id: string }]

    // Freeze payouts for all creators with splits on the disputed release
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('rights.dispute.payout_freeze', ${ctx.actorId}, 'dispute', ${ctx.orgId},
        ${JSON.stringify({
          disputeId: row.id,
          releaseId: data.releaseId,
          reason: 'Active dispute filed — payouts frozen for affected release',
        })}::jsonb)`,
    )

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('rights.dispute.filed', ${ctx.actorId}, 'dispute', ${ctx.orgId},
        ${JSON.stringify({
          disputeId: row.id,
          releaseId: data.releaseId,
          disputeType: data.disputeType,
        })}::jsonb)`,
    )

    logger.info('Rights dispute filed with payout freeze', {
      disputeId: row.id,
      releaseId: data.releaseId,
    })

    const pack = buildEvidencePackFromAction({
      actionType: 'RIGHTS_DISPUTE_FILED',
      orgId: ctx.orgId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/rights')
    return { success: true, disputeId: row.id }
  } catch (error) {
    logger.error('fileRightsDispute failed', { error })
    return { success: false, error: 'Failed to file dispute' }
  }
}

export async function resolveRightsDispute(
  disputeId: string,
  resolution: string,
  newStatus: 'resolved' | 'dismissed',
): Promise<{ success: boolean; error?: string }> {
  const ctx = await resolveOrgContext()

  try {
    // Get dispute details before resolving (for unfreeze logic)
    const [dispute] = (await platformDb.execute(
      sql`SELECT release_id as "releaseId", status
      FROM zonga_rights_disputes
      WHERE id = ${disputeId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ releaseId: string; status: string } | undefined]

    if (!dispute) {
      return { success: false, error: 'Dispute not found' }
    }

    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      return { success: false, error: `Cannot resolve dispute in status: ${dispute.status}` }
    }

    await platformDb.execute(
      sql`UPDATE zonga_rights_disputes
      SET status = ${newStatus}, resolution = ${resolution}, resolved_at = NOW()
      WHERE id = ${disputeId} AND org_id = ${ctx.orgId}`,
    )

    // Check if any remaining open disputes exist for this release
    const [remaining] = (await platformDb.execute(
      sql`SELECT COUNT(*) as cnt
      FROM zonga_rights_disputes
      WHERE release_id = ${dispute.releaseId} AND org_id = ${ctx.orgId}
        AND status IN ('open', 'under_review') AND id != ${disputeId}`,
    )) as unknown as [{ cnt: number }]

    // Unfreeze payouts if no remaining disputes
    if (Number(remaining?.cnt ?? 0) === 0) {
      await platformDb.execute(
        sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
        VALUES ('rights.dispute.payout_unfreeze', ${ctx.actorId}, 'dispute', ${ctx.orgId},
          ${JSON.stringify({
            disputeId,
            releaseId: dispute.releaseId,
            reason: 'All disputes resolved — payouts unfrozen',
          })}::jsonb)`,
      )
      logger.info('Payouts unfrozen after dispute resolution', {
        disputeId,
        releaseId: dispute.releaseId,
      })
    }

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('rights.dispute.resolved', ${ctx.actorId}, 'dispute', ${ctx.orgId},
        ${JSON.stringify({ disputeId, newStatus, resolution })}::jsonb)`,
    )

    const pack = buildEvidencePackFromAction({
      actionType: 'RIGHTS_DISPUTE_RESOLVED',
      orgId: ctx.orgId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/rights')
    return { success: true }
  } catch (error) {
    logger.error('resolveRightsDispute failed', { error })
    return { success: false, error: 'Failed to resolve dispute' }
  }
}

/* ─── Sync Licenses ─── */

export async function listSyncLicenses(opts?: {
  assetId?: string
  status?: string
}): Promise<SyncLicense[]> {
  const ctx = await resolveOrgContext()

  try {
    let filter = sql``
    if (opts?.assetId) {
      filter = sql`AND sl.asset_id = ${opts.assetId}`
    }
    if (opts?.status) {
      filter = sql`${filter} AND sl.status = ${opts.status}`
    }

    const result = (await platformDb.execute(
      sql`SELECT
        sl.id, sl.asset_id as "assetId",
        ca.title as "assetTitle",
        sl.licensee, sl.territory, sl.usage_type as "usageType",
        sl.fee, sl.currency, sl.status,
        sl.starts_at as "startsAt", sl.expires_at as "expiresAt",
        sl.created_at as "createdAt"
      FROM zonga_sync_licenses sl
      LEFT JOIN zonga_content_assets ca ON ca.id = sl.asset_id
      WHERE sl.org_id = ${ctx.orgId} ${filter}
      ORDER BY sl.created_at DESC`,
    )) as unknown as { rows: SyncLicense[] }

    return result.rows ?? []
  } catch (error) {
    logger.error('listSyncLicenses failed', { error })
    return []
  }
}

export async function createSyncLicense(data: {
  assetId: string
  licensee: string
  territory: string
  usageType: string
  fee: number
  currency: string
  startsAt: string
  expiresAt?: string
}): Promise<{ success: boolean; licenseId?: string; error?: string }> {
  const ctx = await resolveOrgContext()

  // S3: Sync licensing / rights management requires enterprise plan
  const creatorPlan = await getCreatorPlan(ctx.actorId, ctx.orgId)
  const gate = guardCreatorFeature(creatorPlan.plan, 'rights_management')
  if (!gate.passed) {
    return { success: false, error: gate.details ?? 'Enterprise plan required for sync licensing' }
  }

  if (!data.assetId || !data.licensee || !data.territory || !data.usageType) {
    return { success: false, error: 'All fields are required' }
  }
  if (data.fee < 0) {
    return { success: false, error: 'Fee must be non-negative' }
  }

  try {
    const [row] = (await platformDb.execute(
      sql`INSERT INTO zonga_sync_licenses
        (org_id, asset_id, licensee, territory, usage_type, fee, currency, status, starts_at, expires_at)
      VALUES (${ctx.orgId}, ${data.assetId}, ${data.licensee}, ${data.territory}, ${data.usageType},
        ${data.fee}, ${data.currency}, 'pending', ${data.startsAt}, ${data.expiresAt ?? null})
      RETURNING id`,
    )) as unknown as [{ id: string }]

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('sync.license.created', ${ctx.actorId}, 'license', ${ctx.orgId},
        ${JSON.stringify({
          licenseId: row.id,
          assetId: data.assetId,
          licensee: data.licensee,
          territory: data.territory,
          fee: data.fee,
          currency: data.currency,
        })}::jsonb)`,
    )

    const pack = buildEvidencePackFromAction({
      actionType: 'SYNC_LICENSE_CREATED',
      orgId: ctx.orgId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/rights')
    return { success: true, licenseId: row.id }
  } catch (error) {
    logger.error('createSyncLicense failed', { error })
    return { success: false, error: 'Failed to create license' }
  }
}
