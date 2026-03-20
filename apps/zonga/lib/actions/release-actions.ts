/**
 * Zonga Server Actions — Releases + Analytics + Integrity.
 *
 * Release bundling, analytics queries, and content integrity checks.
 * Reads/writes domain tables (zonga_releases, zonga_content_assets,
 * zonga_revenue_events) + audit_log for traceability.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  ReleaseStatus,
  type Release,
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
} from '@/lib/zonga-services'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { runPrediction } from '@/lib/ml-client'
import { executeCommand } from '@/lib/control'

/* ─── Releases ─── */

export interface ReleaseListResult {
  releases: Release[]
  total: number
}

export async function listReleases(opts?: {
  page?: number
  status?: string
}): Promise<ReleaseListResult> {
  const ctx = await resolveOrgContext()

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        r.id,
        r.title,
        r.status,
        r.release_type as type,
        r.release_date as "releaseDate",
        r.published_at as "publishedAt",
        c.display_name as "creatorName",
        (SELECT COUNT(*) FROM zonga_release_tracks rt WHERE rt.release_id = r.id) as "trackCount",
        r.metadata->>'upc' as upc,
        r.created_at as "createdAt"
      FROM zonga_releases r
      JOIN zonga_creators c ON c.id = r.creator_id
      WHERE r.org_id = ${ctx.orgId}
      ORDER BY r.created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: Release[] }

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_releases WHERE org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    return {
      releases: rows.rows ?? [],
      total: Number(cnt?.total ?? 0),
    }
  } catch (error) {
    logger.error('listReleases failed', { error })
    return { releases: [], total: 0 }
  }
}

export async function createRelease(data: {
  title: string
  type?: 'single' | 'ep' | 'album' | 'compilation'
  releaseType?: 'single' | 'ep' | 'album' | 'compilation'
  creatorId?: string
  creatorName?: string
  trackCount?: number
  releaseDate?: string
  description?: string
  upc?: string
  tracks?: Array<{ assetId: string; trackNumber: number }>
  distributionTargets?: string[]
  splits?: Array<{ creatorName: string; sharePercent: number }>
}): Promise<{ success: boolean; releaseId?: string; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const releaseType = data.releaseType ?? data.type ?? 'single'
  const result = await executeCommand({
    type: 'create_release' as const,
    title: data.title,
    release_type: releaseType,
    creator_id: data.creatorId,
    creator_name: data.creatorName,
    track_count: data.trackCount ?? data.tracks?.length,
    release_date: data.releaseDate,
    description: data.description,
    upc: data.upc,
    tracks: data.tracks,
    distribution_targets: data.distributionTargets,
    splits: data.splits,
    actor_id: ctx.actorId,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const releaseId = result.data?.entity_id

  const auditEvent = buildZongaAuditEvent({
    action: ZongaAuditAction.RELEASE_PUBLISH,
    entityType: ZongaEntityType.RELEASE,
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    targetId: releaseId ?? 'unknown',
    metadata: { title: data.title, type: releaseType },
  })
  logger.info('Release created', { ...auditEvent })

  const pack = buildEvidencePackFromAction({
    actionType: 'RELEASE_CREATED',
    orgId: ctx.orgId,
    executedBy: ctx.actorId,
    actionId: crypto.randomUUID(),
  })
  await processEvidencePack(pack)

  revalidatePath('/dashboard/releases')
  return { success: true, releaseId }
}

export async function transitionReleaseStatus(
  releaseId: string,
  targetStatus: ReleaseStatus,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await resolveOrgContext()

  const result = await executeCommand({
    type: 'transition_release_status' as const,
    release_id: releaseId,
    target_status: targetStatus,
    actor_id: ctx.actorId,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Audit: record 'release.status_changed' for all status transitions
  logger.info('release.status_changed', { releaseId, targetStatus, orgId: ctx.orgId, actorId: ctx.actorId })

  revalidatePath('/dashboard/releases')
  return { success: true }
}

/** @deprecated Use transitionReleaseStatus instead */
export async function publishRelease(
  releaseId: string,
): Promise<{ success: boolean }> {
  return transitionReleaseStatus(releaseId, ReleaseStatus.PUBLISHED)
}

/* ─── Analytics ─── */

export interface AnalyticsOverview {
  totalStreams: number
  totalDownloads: number
  uniqueListeners: number
  topAssets: Array<{ assetId: string; title: string; streams: number }>
  revenueByMonth: Array<{ month: string; amount: number }>
  totalFollowers: number
  totalFavorites: number
  totalCreators: number
  totalReleases: number
  topCreators: Array<{ creatorId: string; name: string; streams: number }>
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const ctx = await resolveOrgContext()

  try {
    const [streams] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_revenue_events
      WHERE type = 'stream' AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    const [downloads] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_revenue_events
      WHERE type = 'download' AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    const [listeners] = (await platformDb.execute(
      sql`SELECT COUNT(DISTINCT la.listener_id) as total
      FROM zonga_listener_activity la
      WHERE la.org_id = ${ctx.orgId} AND la.activity_type = 'stream'`,
    )) as unknown as [{ total: number }]

    const topAssets = (await platformDb.execute(
      sql`SELECT
        r.asset_id as "assetId",
        COALESCE(a.title, r.asset_id::text) as title,
        COUNT(*) as streams
      FROM zonga_revenue_events r
      LEFT JOIN zonga_content_assets a ON a.id = r.asset_id
      WHERE r.type = 'stream' AND r.org_id = ${ctx.orgId}
      GROUP BY r.asset_id, a.title
      ORDER BY streams DESC LIMIT 10`,
    )) as unknown as { rows: Array<{ assetId: string; title: string; streams: number }> }

    const revenueByMonth = (await platformDb.execute(
      sql`SELECT
        TO_CHAR(occurred_at, 'YYYY-MM') as month,
        COALESCE(SUM(amount::numeric), 0) as amount
      FROM zonga_revenue_events WHERE org_id = ${ctx.orgId}
      GROUP BY TO_CHAR(occurred_at, 'YYYY-MM')
      ORDER BY month DESC LIMIT 12`,
    )) as unknown as { rows: Array<{ month: string; amount: number }> }

    const [followers] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_listener_follows
      WHERE org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    const [favorites] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_listener_favorites
      WHERE org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    const [creators] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_creators
      WHERE org_id = ${ctx.orgId} AND status = 'active'`,
    )) as unknown as [{ total: number }]

    const [releases] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_releases
      WHERE org_id = ${ctx.orgId} AND status = 'published'`,
    )) as unknown as [{ total: number }]

    const topCreators = (await platformDb.execute(
      sql`SELECT
        r.creator_id as "creatorId",
        COALESCE(c.display_name, r.creator_id::text) as name,
        COUNT(*) as streams
      FROM zonga_revenue_events r
      LEFT JOIN zonga_creators c ON c.id = r.creator_id
      WHERE r.type = 'stream' AND r.org_id = ${ctx.orgId}
      GROUP BY r.creator_id, c.display_name
      ORDER BY streams DESC LIMIT 10`,
    )) as unknown as { rows: Array<{ creatorId: string; name: string; streams: number }> }

    return {
      totalStreams: Number(streams?.total ?? 0),
      totalDownloads: Number(downloads?.total ?? 0),
      uniqueListeners: Number(listeners?.total ?? 0),
      topAssets: topAssets.rows ?? [],
      revenueByMonth: revenueByMonth.rows ?? [],
      totalFollowers: Number(followers?.total ?? 0),
      totalFavorites: Number(favorites?.total ?? 0),
      totalCreators: Number(creators?.total ?? 0),
      totalReleases: Number(releases?.total ?? 0),
      topCreators: topCreators.rows ?? [],
    }
  } catch (error) {
    logger.error('getAnalyticsOverview failed', { error })
    return {
      totalStreams: 0,
      totalDownloads: 0,
      uniqueListeners: 0,
      topAssets: [],
      revenueByMonth: [],
      totalFollowers: 0,
      totalFavorites: 0,
      totalCreators: 0,
      totalReleases: 0,
      topCreators: [],
    }
  }
}

/* ─── Content Integrity ─── */

export interface IntegrityCheck {
  id: string
  type: 'duplicate' | 'metadata-mismatch' | 'rights-conflict' | 'ai-flagged'
  assetId: string
  assetTitle: string
  severity: 'info' | 'warning' | 'critical' | 'high' | 'medium' | 'low'
  message: string
  checkType: string
  confidence: number | null
  checkedAt: string
  description: string
  createdAt: Date
  resolved: boolean
}

export interface IntegritySummary {
  total: number
  passed: number
  flagged: number
  critical: number
}

export interface IntegrityResult {
  checks: IntegrityCheck[]
  summary: IntegritySummary
}

export async function getIntegrityChecks(): Promise<IntegrityResult> {
  const _ctx = await resolveOrgContext()

  try {
    // Run ML-based content integrity check
    const prediction = await runPrediction({
      model: 'content-integrity-checker',
      features: { scope: 'platform' },
    })

    const checks: IntegrityCheck[] = []

    if (prediction?.issues && Array.isArray(prediction.issues)) {
      for (const issue of prediction.issues) {
        checks.push({
          id: `integrity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: issue.type ?? 'ai-flagged',
          assetId: issue.assetId ?? '',
          assetTitle: issue.assetTitle ?? 'Unknown Asset',
          severity: issue.severity ?? 'info',
          message: issue.description ?? 'AI-flagged content issue',
          checkType: issue.type ?? 'ai-flagged',
          confidence: issue.confidence ?? null,
          checkedAt: new Date().toISOString(),
          description: issue.description ?? 'AI-flagged content issue',
          createdAt: new Date(),
          resolved: false,
        })
      }
    }

    const critical = checks.filter((c) => c.severity === 'critical' || c.severity === 'high').length
    const flagged = checks.filter((c) => c.severity === 'warning' || c.severity === 'medium').length
    const passed = checks.length - critical - flagged

    return {
      checks,
      summary: {
        total: checks.length,
        passed: Math.max(0, passed),
        flagged,
        critical,
      },
    }
  } catch (error) {
    logger.error('getIntegrityChecks failed', { error })
    return { checks: [], summary: { total: 0, passed: 0, flagged: 0, critical: 0 } }
  }
}
