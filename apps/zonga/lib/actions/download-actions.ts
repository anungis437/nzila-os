/**
 * Zonga Server Actions — Downloads.
 *
 * Premium-only offline downloads (S4 guard).
 * Generates time-limited download URLs for purchased / subscribed content.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getListenerPlan } from '@/lib/guards/plan-queries'
import { guardCanDownload, guardSubscriptionActive } from '@/lib/guards/subscription-guards'
import { getAudioStreamUrl } from '@/lib/blob'

export interface DownloadResult {
  ok: boolean
  downloadUrl?: string
  error?: string
}

/**
 * Request an offline-download URL for a content asset.
 * Gated by S4 (premium only) and S6 (active subscription).
 */
export async function requestDownload(assetId: string): Promise<DownloadResult> {
  const ctx = await resolveOrgContext()

  try {
    const planInfo = await getListenerPlan(ctx.actorId, ctx.orgId)

    // S6: must have active subscription
    const statusCheck = guardSubscriptionActive(planInfo.subscriptionStatus)
    if (!statusCheck.passed) {
      return { ok: false, error: statusCheck.details ?? 'Subscription not active' }
    }

    // S4: downloads require premium
    const downloadCheck = guardCanDownload(planInfo.plan)
    if (!downloadCheck.passed) {
      return { ok: false, error: downloadCheck.details ?? 'Premium subscription required for downloads' }
    }

    // Fetch the asset's storage path
    const [asset] = (await platformDb.execute(
      sql`SELECT storage_url, title
      FROM zonga_content_assets
      WHERE id = ${assetId} AND org_id = ${ctx.orgId} AND status = 'published'`,
    )) as unknown as [{ storage_url: string | null; title: string } | undefined]

    if (!asset?.storage_url) {
      return { ok: false, error: 'Asset not found or not available for download' }
    }

    // Convert blob:// URL to blob path
    const blobPath = asset.storage_url.replace('blob://', '')

    // Generate a download URL (longer expiry for offline use — 4 hours)
    const downloadUrl = await getAudioStreamUrl(blobPath, 240)

    // Record download activity
    await platformDb.execute(
      sql`INSERT INTO zonga_listener_activity (org_id, listener_id, activity_type, entity_type, entity_id, metadata_json)
      VALUES (${ctx.orgId}, ${ctx.actorId}, 'download', 'content_asset', ${assetId},
        ${JSON.stringify({ title: asset.title })}::jsonb)`,
    )

    logger.info('Download granted', { listenerId: ctx.actorId, assetId })
    return { ok: true, downloadUrl }
  } catch (error) {
    logger.error('requestDownload failed', { error })
    return { ok: false, error: 'Download request failed' }
  }
}

/**
 * Check whether the current listener can download content (without generating a URL).
 */
export async function canDownload(): Promise<{ allowed: boolean; reason?: string }> {
  const ctx = await resolveOrgContext()

  const planInfo = await getListenerPlan(ctx.actorId, ctx.orgId)
  const check = guardCanDownload(planInfo.plan)

  if (!check.passed) {
    return { allowed: false, reason: check.details }
  }

  const statusCheck = guardSubscriptionActive(planInfo.subscriptionStatus)
  if (!statusCheck.passed) {
    return { allowed: false, reason: statusCheck.details }
  }

  return { allowed: true }
}
