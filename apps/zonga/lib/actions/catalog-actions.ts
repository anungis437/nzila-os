/**
 * Zonga Server Actions — Catalog (Content Assets).
 *
 * CRUD for tracks, albums, and other content assets.
 * Uses @nzila/zonga-core schemas for validation.
 * Reads/writes zonga_content_assets domain table.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  CreateContentAssetSchema,
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
  AssetStatus,
  type ContentAsset,
} from '@/lib/zonga-services'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { logTransition } from '@/lib/commerce-telemetry'

export interface CatalogListResult {
  assets: ContentAsset[]
  total: number
  hasMore: boolean
}

export async function listCatalogAssets(opts?: {
  page?: number
  pageSize?: number
  search?: string
  type?: string
  status?: string
}): Promise<CatalogListResult> {
  const ctx = await resolveOrgContext()

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 25
  const offset = (page - 1) * pageSize

  try {
    const searchFilter = opts?.search
      ? sql` AND LOWER(a.title) LIKE ${'%' + opts.search.toLowerCase() + '%'}`
      : sql``
    const typeFilter = opts?.type ? sql` AND a.type = ${opts.type}` : sql``
    const statusFilter = opts?.status ? sql` AND a.status = ${opts.status}` : sql``

    const assets = (await platformDb.execute(
      sql`SELECT
        a.id,
        a.title,
        a.type,
        a.status,
        a.creator_id as "creatorId",
        c.display_name as "creatorName",
        a.duration_seconds as duration,
        a.genre,
        a.fingerprint_ref as isrc,
        a.created_at as "createdAt"
      FROM zonga_content_assets a
      LEFT JOIN zonga_creators c ON c.id = a.creator_id
      WHERE a.org_id = ${ctx.orgId}
      ${searchFilter} ${typeFilter} ${statusFilter}
      ORDER BY a.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    )) as unknown as { rows: ContentAsset[] }

    const [countResult] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_content_assets
      WHERE org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    const total = Number(countResult?.total ?? 0)
    return {
      assets: assets.rows ?? [],
      total,
      hasMore: page * pageSize < total,
    }
  } catch (error) {
    logger.error('listCatalogAssets failed', { error })
    return { assets: [], total: 0, hasMore: false }
  }
}

export async function createContentAsset(data: {
  title: string
  type: string
  genre?: string
  language?: string
  creatorId?: string
  creatorName?: string
  duration?: number
  collaborators?: string[]
}): Promise<{ success: boolean; assetId?: string; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const parsed = CreateContentAssetSchema.safeParse(data)
  if (!parsed.success) {
    logger.warn('createContentAsset validation failed', { errors: parsed.error.flatten().fieldErrors })
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  try {
    const [row] = (await platformDb.execute(
      sql`INSERT INTO zonga_content_assets (org_id, creator_id, title, type, status, genre, duration_seconds)
      VALUES (${ctx.orgId}, ${data.creatorId ?? null}, ${data.title}, ${data.type},
        ${AssetStatus.DRAFT}, ${data.genre ?? null}, ${data.duration ?? null})
      RETURNING id`,
    )) as unknown as [{ id: string }]

    const assetId = row.id

    // Supplementary audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('asset.created', ${ctx.actorId}, 'content_asset', ${assetId}, ${ctx.orgId},
        ${JSON.stringify({ title: data.title, type: data.type, language: data.language, collaborators: data.collaborators })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.CONTENT_UPLOAD,
      entityType: ZongaEntityType.CONTENT_ASSET,
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      targetId: assetId,
      metadata: { title: data.title, type: data.type },
    })
    logger.info('Content asset created', { ...auditEvent })

    const pack = buildEvidencePackFromAction({
      actionType: 'CONTENT_ASSET_CREATED',
      orgId: ctx.orgId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/catalog')
    return { success: true, assetId }
  } catch (error) {
    logger.error('createContentAsset failed', { error })
    return { success: false }
  }
}

export async function publishAsset(assetId: string): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext()

  try {
    await platformDb.execute(
      sql`UPDATE zonga_content_assets SET status = ${AssetStatus.PUBLISHED}
      WHERE id = ${assetId} AND org_id = ${ctx.orgId}`,
    )

    // Supplementary audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('asset.published', ${ctx.actorId}, 'content_asset', ${assetId}, ${ctx.orgId},
        ${JSON.stringify({ status: AssetStatus.PUBLISHED, publishedAt: new Date().toISOString() })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.CONTENT_PUBLISH,
      entityType: ZongaEntityType.CONTENT_ASSET,
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      targetId: assetId,
    })
    logger.info('Content asset published', { ...auditEvent })

    logTransition(
      { orgId: ctx.orgId },
      'content_asset',
      AssetStatus.DRAFT,
      AssetStatus.PUBLISHED,
      true,
    )

    revalidatePath('/dashboard/catalog')
    return { success: true }
  } catch (error) {
    logger.error('publishAsset failed', { error })
    return { success: false }
  }
}

export async function getAssetDetail(assetId: string): Promise<ContentAsset | null> {
  const ctx = await resolveOrgContext()

  try {
    const [row] = (await platformDb.execute(
      sql`SELECT
        a.id,
        a.title,
        a.type,
        a.status,
        a.creator_id as "creatorId",
        c.display_name as "creatorName",
        a.duration_seconds as duration,
        a.genre,
        a.fingerprint_ref as isrc,
        a.storage_url as "storageUrl",
        a.cover_art_url as "coverArtUrl",
        a.description,
        a.created_at as "createdAt"
      FROM zonga_content_assets a
      LEFT JOIN zonga_creators c ON c.id = a.creator_id
      WHERE a.id = ${assetId} AND a.org_id = ${ctx.orgId}`,
    )) as unknown as [ContentAsset | undefined]

    return row ?? null
  } catch (error) {
    logger.error('getAssetDetail failed', { error })
    return null
  }
}
