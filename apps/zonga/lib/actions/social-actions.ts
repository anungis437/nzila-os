/**
 * Zonga Server Actions — Social & Engagement.
 *
 * Follow creators, like content, post comments, and tip artists.
 * Reads/writes domain tables (zonga_listener_follows, zonga_listener_favorites,
 * zonga_listener_activity, zonga_revenue_events) + audit_log for traceability.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { resolveListenerContext, resolveListenerUUID } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { RevenueType } from '@/lib/zonga-services'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export interface Follow {
  id: string
  listenerId: string
  creatorId: string
  creatorName?: string
  createdAt?: Date
}

export interface Like {
  id: string
  listenerId: string
  targetEntityId: string
  entityType: string
  createdAt?: Date
}

export interface Comment {
  id: string
  userId: string
  userName?: string
  assetId: string
  content: string
  createdAt?: Date
}

export interface SocialStats {
  followers: number
  following: number
  likes: number
  comments: number
}

/* ─── Follow ─── */

export async function followCreator(creatorId: string): Promise<{ success: boolean }> {
  await auth()
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    // Check if already following
    const [existing] = (await platformDb.execute(
      sql`SELECT id FROM zonga_listener_follows
      WHERE listener_id = ${listenerId} AND creator_id = ${creatorId}
      LIMIT 1`,
    )) as unknown as [{ id: string } | undefined]

    if (existing) {
      return { success: true }
    }

    await platformDb.execute(
      sql`INSERT INTO zonga_listener_follows (org_id, listener_id, creator_id)
      VALUES (${ctx.orgId}, ${listenerId}, ${creatorId})`,
    )

    // Activity tracking
    await platformDb.execute(
      sql`INSERT INTO zonga_listener_activity (org_id, listener_id, activity_type, entity_type, entity_id)
      VALUES (${ctx.orgId}, ${listenerId}, 'follow', 'creator', ${creatorId})`,
    )

    logger.info('Creator followed', { listenerId: ctx.actorId, creatorId })
    return { success: true }
  } catch (error) {
    logger.error('followCreator failed', { error })
    return { success: false }
  }
}

/** @deprecated Use followCreator instead */
export const followUser = followCreator

export async function unfollowCreator(creatorId: string): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    await platformDb.execute(
      sql`DELETE FROM zonga_listener_follows
      WHERE listener_id = ${listenerId} AND creator_id = ${creatorId}`,
    )

    logger.info('Creator unfollowed', { listenerId: ctx.actorId, creatorId })
    return { success: true }
  } catch (error) {
    logger.error('unfollowCreator failed', { error })
    return { success: false }
  }
}

/** @deprecated Use unfollowCreator instead */
export const unfollowUser = unfollowCreator

export async function listFollowers(creatorId: string): Promise<Follow[]> {
  await resolveListenerContext()

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        f.id,
        f.listener_id as "listenerId",
        f.creator_id as "creatorId",
        c.display_name as "creatorName",
        f.created_at as "createdAt"
      FROM zonga_listener_follows f
      LEFT JOIN zonga_creators c ON c.id = f.creator_id
      WHERE f.creator_id = ${creatorId}
      ORDER BY f.created_at DESC`,
    )) as unknown as Follow[]

    return rows
  } catch (error) {
    logger.error('listFollowers failed', { error })
    return []
  }
}

export async function listFollowing(_userId?: string): Promise<Follow[]> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        f.id,
        f.listener_id as "listenerId",
        f.creator_id as "creatorId",
        c.display_name as "creatorName",
        f.created_at as "createdAt"
      FROM zonga_listener_follows f
      LEFT JOIN zonga_creators c ON c.id = f.creator_id
      WHERE f.listener_id = ${listenerId}
      ORDER BY f.created_at DESC`,
    )) as unknown as Follow[]

    return rows
  } catch (error) {
    logger.error('listFollowing failed', { error })
    return []
  }
}

/* ─── Favorites (replaces likes) ─── */

export async function favoriteEntity(
  entityType: string,
  targetEntityId: string,
): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    // Idempotent: skip if already favorited
    const [existing] = (await platformDb.execute(
      sql`SELECT id FROM zonga_listener_favorites
      WHERE listener_id = ${listenerId} AND entity_id = ${targetEntityId}
      LIMIT 1`,
    )) as unknown as [{ id: string } | undefined]

    if (existing) return { success: true }

    await platformDb.execute(
      sql`INSERT INTO zonga_listener_favorites (org_id, listener_id, entity_type, entity_id)
      VALUES (${ctx.orgId}, ${listenerId}, ${entityType}, ${targetEntityId})`,
    )

    logger.info('Entity favorited', { listenerId: ctx.actorId, entityType, targetEntityId })
    return { success: true }
  } catch (error) {
    logger.error('favoriteEntity failed', { error })
    return { success: false }
  }
}

/** @deprecated Use favoriteEntity instead */
export async function likeAsset(assetId: string, _assetTitle?: string) {
  return favoriteEntity('asset', assetId)
}

export async function unfavoriteEntity(targetEntityId: string): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    await platformDb.execute(
      sql`DELETE FROM zonga_listener_favorites
      WHERE listener_id = ${listenerId} AND entity_id = ${targetEntityId}`,
    )

    return { success: true }
  } catch (error) {
    logger.error('unfavoriteEntity failed', { error })
    return { success: false }
  }
}

/** @deprecated Use unfavoriteEntity instead */
export async function unlikeAsset(assetId: string) {
  return unfavoriteEntity(assetId)
}

export async function getEntityFavoriteCount(targetEntityId: string): Promise<number> {
  await resolveListenerContext()

  try {
    const [result] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_listener_favorites
      WHERE entity_id = ${targetEntityId}`,
    )) as unknown as [{ total: number }]

    return Number(result?.total ?? 0)
  } catch (error) {
    logger.error('getEntityFavoriteCount failed', { error })
    return 0
  }
}

/** @deprecated Use getEntityFavoriteCount instead */
export const getAssetLikeCount = getEntityFavoriteCount

/* ─── Comments (kept in audit_log for now — low-volume append-only) ─── */

export async function postComment(data: {
  assetId: string
  content: string
  userName?: string
}): Promise<{ success: boolean; commentId?: string }> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    const commentId = crypto.randomUUID()

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('social.commented', ${ctx.actorId}, 'comment', ${commentId}, ${ctx.orgId},
        ${JSON.stringify({
          userId: ctx.actorId,
          userName: data.userName,
          assetId: data.assetId,
          content: data.content,
        })}::jsonb)`,
    )

    // Activity tracking
    await platformDb.execute(
      sql`INSERT INTO zonga_listener_activity (org_id, listener_id, activity_type, entity_type, entity_id, metadata_json)
      VALUES (${ctx.orgId}, ${listenerId}, 'comment', 'asset', ${data.assetId},
        ${JSON.stringify({ commentId })}::jsonb)`,
    )

    logger.info('Comment posted', { userId: ctx.actorId, assetId: data.assetId })
    revalidatePath('/dashboard/catalog')
    return { success: true, commentId }
  } catch (error) {
    logger.error('postComment failed', { error })
    return { success: false }
  }
}

export async function listComments(assetId: string): Promise<Comment[]> {
  await resolveListenerContext()

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        entity_id as id,
        metadata->>'userId' as "userId",
        metadata->>'userName' as "userName",
        metadata->>'assetId' as "assetId",
        metadata->>'content' as content,
        created_at as "createdAt"
      FROM audit_log
      WHERE action = 'social.commented' AND metadata->>'assetId' = ${assetId}
      ORDER BY created_at DESC`,
    )) as unknown as Comment[]

    return rows
  } catch (error) {
    logger.error('listComments failed', { error })
    return []
  }
}

/* ─── Tip (send creator a tip) ─── */

export async function tipCreator(data: {
  creatorId: string
  creatorName?: string
  amount: number
  currency: string
  message?: string
}): Promise<{ success: boolean }> {
  const ctx = await resolveListenerContext()
  const listenerId = await resolveListenerUUID(ctx)

  try {
    // Look up the creator's org for the revenue event
    const [creator] = (await platformDb.execute(
      sql`SELECT org_id FROM zonga_creators WHERE id = ${data.creatorId}`,
    )) as unknown as [{ org_id: string } | undefined]

    const creatorOrgId = creator?.org_id ?? ctx.orgId

    // Record revenue in domain table
    await platformDb.execute(
      sql`INSERT INTO zonga_revenue_events (org_id, creator_id, type, amount, currency, source, description)
      VALUES (${creatorOrgId}, ${data.creatorId}, ${RevenueType.TIP}, ${data.amount},
        ${data.currency}, 'tip', ${data.message ?? null})`,
    )

    // Activity tracking
    await platformDb.execute(
      sql`INSERT INTO zonga_listener_activity (org_id, listener_id, activity_type, entity_type, entity_id, metadata_json)
      VALUES (${ctx.orgId}, ${listenerId}, 'tip', 'creator', ${data.creatorId},
        ${JSON.stringify({ amount: data.amount, currency: data.currency })}::jsonb)`,
    )

    logger.info('Tip sent', { senderId: ctx.actorId, creatorId: data.creatorId, amount: data.amount })

    const pack = buildEvidencePackFromAction({
      actionType: 'CREATOR_TIP_SENT',
      orgId: ctx.orgId ?? '',
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    return { success: true }
  } catch (error) {
    logger.error('tipCreator failed', { error })
    return { success: false }
  }
}

/* ─── Social Stats ─── */

export async function getSocialStats(targetEntityId: string): Promise<SocialStats> {
  await resolveListenerContext()

  try {
    const [followers] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_listener_follows
      WHERE creator_id = ${targetEntityId}`,
    )) as unknown as [{ total: number }]

    const [following] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_listener_follows
      WHERE listener_id = ${targetEntityId}`,
    )) as unknown as [{ total: number }]

    const [likes] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_listener_favorites
      WHERE listener_id = ${targetEntityId}`,
    )) as unknown as [{ total: number }]

    const [comments] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_listener_activity
      WHERE listener_id = ${targetEntityId} AND activity_type = 'comment'`,
    )) as unknown as [{ total: number }]

    return {
      followers: Number(followers?.total ?? 0),
      following: Number(following?.total ?? 0),
      likes: Number(likes?.total ?? 0),
      comments: Number(comments?.total ?? 0),
    }
  } catch (error) {
    logger.error('getSocialStats failed', { error })
    return { followers: 0, following: 0, likes: 0, comments: 0 }
  }
}
