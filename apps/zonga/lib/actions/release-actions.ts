/**
 * Zonga Server Actions — Releases + Analytics + Integrity.
 *
 * Release bundling, analytics queries, and content integrity checks.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
  ReleaseStatus,
  CreateReleaseSchema,
  type Release,
} from '@/lib/zonga-services'
import { runPrediction } from '@/lib/ml-client'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { logTransition } from '@/lib/commerce-telemetry'

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
        entity_id as id, metadata->>'title' as title,
        metadata->>'status' as status,
        metadata->>'type' as type,
        metadata->>'trackCount' as "trackCount",
        metadata->>'creatorName' as "creatorName",
        metadata->>'releaseDate' as "releaseDate",
        metadata->>'upc' as upc,
        created_at as "createdAt"
      FROM audit_log WHERE (action = 'release.created' OR action = 'release.published')
      AND org_id = ${ctx.entityId}
      ORDER BY created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: Release[] }

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log WHERE action LIKE 'release.%' AND org_id = ${ctx.entityId}`,
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
  type: 'single' | 'ep' | 'album' | 'compilation'
  creatorName?: string
  trackCount?: number
  releaseDate?: string
}): Promise<{ success: boolean; releaseId?: string; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const parsed = CreateReleaseSchema.safeParse(data)
  if (!parsed.success) {
    logger.warn('createRelease validation failed', { errors: parsed.error.flatten().fieldErrors })
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  try {
    const releaseId = crypto.randomUUID()

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('release.created', ${ctx.actorId}, 'release', ${releaseId}, ${ctx.entityId},
        ${JSON.stringify({ ...data, status: ReleaseStatus.DRAFT, id: releaseId })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.RELEASE_PUBLISH,
      entityType: ZongaEntityType.RELEASE,
      entityId: releaseId,
      actorId: ctx.actorId,
      targetId: releaseId,
      metadata: { title: data.title, type: data.type },
    })
    logger.info('Release created', { ...auditEvent })

    revalidatePath('/dashboard/releases')
    return { success: true, releaseId }
  } catch (error) {
    logger.error('createRelease failed', { error })
    return { success: false }
  }
}

export async function publishRelease(
  releaseId: string,
): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext()

  try {
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('release.published', ${ctx.actorId}, 'release', ${releaseId}, ${ctx.entityId},
        ${JSON.stringify({ status: ReleaseStatus.RELEASED, publishedAt: new Date().toISOString() })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.RELEASE_PUBLISH,
      entityType: ZongaEntityType.RELEASE,
      entityId: releaseId,
      actorId: ctx.actorId,
      targetId: releaseId,
    })
    logger.info('Release published', { ...auditEvent })

    logTransition(
      { orgId: releaseId },
      'release',
      ReleaseStatus.DRAFT,
      ReleaseStatus.RELEASED,
      true,
    )

    const pack = buildEvidencePackFromAction({
      actionType: 'RELEASE_PUBLISHED',
      entityId: releaseId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/releases')
    return { success: true }
  } catch (error) {
    logger.error('publishRelease failed', { error })
    return { success: false }
  }
}

/* ─── Analytics ─── */

export interface AnalyticsOverview {
  totalStreams: number
  totalDownloads: number
  uniqueListeners: number
  topAssets: Array<{ assetId: string; title: string; streams: number }>
  revenueByMonth: Array<{ month: string; amount: number }>
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const ctx = await resolveOrgContext()

  try {
    const [streams] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log
      WHERE action = 'revenue.recorded' AND metadata->>'type' = 'stream' AND org_id = ${ctx.entityId}`,
    )) as unknown as [{ total: number }]

    const [downloads] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log
      WHERE action = 'revenue.recorded' AND metadata->>'type' = 'download' AND org_id = ${ctx.entityId}`,
    )) as unknown as [{ total: number }]

    const topAssets = (await platformDb.execute(
      sql`SELECT
        metadata->>'assetId' as "assetId",
        COALESCE(metadata->>'assetTitle', metadata->>'assetId') as title,
        COUNT(*) as streams
      FROM audit_log
      WHERE action = 'revenue.recorded' AND metadata->>'type' = 'stream' AND org_id = ${ctx.entityId}
      GROUP BY metadata->>'assetId', COALESCE(metadata->>'assetTitle', metadata->>'assetId')
      ORDER BY streams DESC LIMIT 10`,
    )) as unknown as { rows: Array<{ assetId: string; title: string; streams: number }> }

    const revenueByMonth = (await platformDb.execute(
      sql`SELECT
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COALESCE(SUM(CAST(metadata->>'amount' AS NUMERIC)), 0) as amount
      FROM audit_log WHERE action = 'revenue.recorded' AND org_id = ${ctx.entityId}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC LIMIT 12`,
    )) as unknown as { rows: Array<{ month: string; amount: number }> }

    return {
      totalStreams: Number(streams?.total ?? 0),
      totalDownloads: Number(downloads?.total ?? 0),
      uniqueListeners: 0, // Requires dedicated listener tracking
      topAssets: topAssets.rows ?? [],
      revenueByMonth: revenueByMonth.rows ?? [],
    }
  } catch (error) {
    logger.error('getAnalyticsOverview failed', { error })
    return {
      totalStreams: 0,
      totalDownloads: 0,
      uniqueListeners: 0,
      topAssets: [],
      revenueByMonth: [],
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
