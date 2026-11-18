import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  resolveListenerUUID,
  listenerFacts,
  isZongaId,
  ZongaScopeError,
  ZongaUnavailableError,
  type ListenerActionContext,
} from '@/lib/resolve-org'
import { zongaRows } from '@/queries/action-context'
import { visibleResource, resourceKind } from './listener-resources'
import { publishedCreator } from './published-catalog'
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
  following: null
  likes: number
  comments: number
}
export async function follow(context: ListenerActionContext, id: string) {
  const creator = await visibleResource(context, 'creator', id),
    listener = await resolveListenerUUID(context)
  const [existing] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`SELECT id FROM public.zonga_listener_follows WHERE listener_id=${listener}::uuid AND creator_id=${creator.id}::uuid LIMIT 1`,
    ),
  )
  if (existing) return { success: true }
  await context.db.execute(
    sql`INSERT INTO public.zonga_listener_follows(org_id,listener_id,creator_id) VALUES(${creator.orgId}::uuid,${listener}::uuid,${creator.id}::uuid)`,
  )
  const [trace] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.zonga_listener_activity(org_id,listener_id,activity_type,entity_type,entity_id) VALUES(${creator.orgId}::uuid,${listener}::uuid,'follow','creator',${creator.id}::uuid) RETURNING id`,
    ),
  )
  if (!trace) throw new Error('Follow activity was not stored')
  return { success: true }
}
export async function unfollow(context: ListenerActionContext, id: string) {
  if (!isZongaId(id)) throw new ZongaScopeError()
  const listener = await resolveListenerUUID(context)
  await context.db.execute(
    sql`DELETE FROM public.zonga_listener_follows WHERE listener_id=${listener}::uuid AND creator_id=${id}::uuid`,
  )
  return { success: true }
}
export async function followers(context: ListenerActionContext, id: string): Promise<Follow[]> {
  if (!isZongaId(id)) throw new ZongaScopeError()
  const [creator] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`SELECT id FROM public.zonga_creators WHERE id=${id}::uuid AND user_id=${context.actorId} FOR SHARE`,
    ),
  )
  if (!creator) throw new ZongaScopeError()
  return zongaRows(
    await context.db.execute(
      sql`SELECT f.id,f.listener_id AS "listenerId",f.creator_id AS "creatorId",c.display_name AS "creatorName",f.created_at AS "createdAt" FROM public.zonga_listener_follows f JOIN public.zonga_creators c ON c.id=f.creator_id WHERE f.creator_id=${creator.id}::uuid ORDER BY f.created_at DESC`,
    ),
  )
}
export async function following(
  context: ListenerActionContext,
  target?: string,
): Promise<Follow[]> {
  const listener = await resolveListenerUUID(context)
  if (target !== undefined && target !== context.actorId && target !== listener)
    throw new ZongaScopeError()
  return zongaRows(
    await context.db.execute(
      sql`SELECT f.id,f.listener_id AS "listenerId",f.creator_id AS "creatorId",c.display_name AS "creatorName",f.created_at AS "createdAt" FROM public.zonga_listener_follows f JOIN public.zonga_creators c ON c.id=f.creator_id WHERE f.listener_id=${listener}::uuid AND c.status='active' ORDER BY f.created_at DESC`,
    ),
  )
}
const favoriteType = z.enum(['asset', 'track', 'content_asset', 'release', 'playlist', 'event'])
const aliases = (kind: string) => (kind === 'asset' ? ['asset', 'track', 'content_asset'] : [kind])
export async function favorite(context: ListenerActionContext, type: string, id: string) {
  const kind = resourceKind(favoriteType.parse(type)),
    resource = await visibleResource(context, kind, id, true),
    listener = await resolveListenerUUID(context)
  const [existing] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`SELECT id FROM public.zonga_listener_favorites WHERE listener_id=${listener}::uuid AND entity_id=${resource.id}::uuid AND entity_type IN (${sql.join(
        aliases(kind).map((value) => sql`${value}`),
        sql`,`,
      )}) LIMIT 1`,
    ),
  )
  if (!existing)
    await context.db.execute(
      sql`INSERT INTO public.zonga_listener_favorites(org_id,listener_id,entity_type,entity_id) VALUES(${resource.orgId}::uuid,${listener}::uuid,${kind},${resource.id}::uuid)`,
    )
  return { success: true }
}
export async function unfavorite(context: ListenerActionContext, id: string) {
  if (!isZongaId(id)) throw new ZongaScopeError()
  const listener = await resolveListenerUUID(context)
  await context.db.execute(
    sql`DELETE FROM public.zonga_listener_favorites WHERE listener_id=${listener}::uuid AND entity_id=${id}::uuid`,
  )
  return { success: true }
}
export async function favoriteCount(
  context: ListenerActionContext,
  id: string,
  type = 'asset',
): Promise<number> {
  const kind = resourceKind(favoriteType.parse(type)),
    resource = await visibleResource(context, kind, id, true),
    [count] = zongaRows<{ total: number }>(
      await context.db.execute(
        sql`SELECT count(*) AS total FROM public.zonga_listener_favorites WHERE entity_id=${resource.id}::uuid AND entity_type IN (${sql.join(
          aliases(kind).map((value) => sql`${value}`),
          sql`,`,
        )})`,
      ),
    )
  return Number(count?.total ?? 0)
}
export async function comment(
  context: ListenerActionContext,
  data: { assetId: string; content: string; userName?: string },
) {
  const value = z
      .object({
        assetId: z.uuid(),
        content: z.string().trim().min(1),
        userName: z.string().optional(),
      })
      .strict()
      .parse(data),
    asset = await visibleResource(context, 'asset', value.assetId),
    profile = await listenerFacts(context, true)
  if (!profile || (value.userName !== undefined && value.userName !== profile.displayName))
    throw new ZongaScopeError()
  const [created] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('social.commented',${context.actorId},'comment',${asset.orgId}::uuid,${JSON.stringify({ assetId: asset.id, content: value.content, userName: profile.displayName, userId: context.actorId, source: 'zonga.public-comment.v1' })}::jsonb) RETURNING id`,
    ),
  )
  if (!created) throw new Error('Comment was not stored')
  const [trace] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.zonga_listener_activity(org_id,listener_id,activity_type,entity_type,entity_id,metadata_json) VALUES(${asset.orgId}::uuid,${profile.id}::uuid,'comment','asset',${asset.id}::uuid,${JSON.stringify({ commentId: created.id })}::jsonb) RETURNING id`,
    ),
  )
  if (!trace) throw new Error('Comment activity was not stored')
  return { success: true, commentId: created.id }
}
export async function comments(context: ListenerActionContext, id: string): Promise<Comment[]> {
  const asset = await visibleResource(context, 'asset', id)
  return zongaRows(
    await context.db.execute(
      sql`SELECT x.id,x.actor_id AS "userId",COALESCE(l.display_name,'Listener') AS "userName",x.metadata->>'assetId' AS "assetId",x.metadata->>'content' AS content,x.created_at AS "createdAt" FROM public.audit_log x LEFT JOIN LATERAL(SELECT display_name FROM public.zonga_listeners WHERE user_id=x.actor_id ORDER BY created_at DESC,id DESC LIMIT 1) l ON true WHERE x.action='social.commented' AND x.org_id=${asset.orgId}::uuid AND x.metadata->>'assetId'=${asset.id} AND jsonb_typeof(x.metadata->'content')='string' ORDER BY x.created_at DESC`,
    ),
  )
}
export async function tip(
  _context: ListenerActionContext,
  data: {
    creatorId: string
    creatorName?: string
    amount: number
    currency: string
    message?: string
  },
): Promise<{ success: boolean }> {
  z.object({
    creatorId: z.uuid(),
    creatorName: z.string().optional(),
    amount: z.number().finite().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    message: z.string().optional(),
  })
    .strict()
    .parse(data)
  throw new ZongaUnavailableError()
}
export async function publicSocialStats(
  context: ListenerActionContext,
  id: string,
): Promise<SocialStats> {
  const creator = await publishedCreator(context, id)
  if (!creator) throw new ZongaScopeError('Published creator is unavailable')
  const [row] = zongaRows<{ followers: number; likes: number; comments: number }>(
    await context.db.execute(
      sql`SELECT (SELECT count(*) FROM public.zonga_listener_follows WHERE creator_id=${creator.id}::uuid) AS followers,(SELECT count(*) FROM public.zonga_listener_favorites f JOIN public.zonga_content_assets a ON a.id=f.entity_id JOIN public.zonga_creators child_creator ON child_creator.id=a.creator_id WHERE child_creator.status='active' AND(child_creator.org_id IS NULL OR child_creator.org_id=a.org_id) AND a.creator_id=${creator.id}::uuid AND a.status='published' AND f.entity_type IN('asset','track','content_asset')) AS likes,(SELECT count(*) FROM public.audit_log x JOIN public.zonga_content_assets a ON x.metadata->>'assetId'=a.id::text JOIN public.zonga_creators child_creator ON child_creator.id=a.creator_id WHERE child_creator.status='active' AND(child_creator.org_id IS NULL OR child_creator.org_id=a.org_id) AND a.creator_id=${creator.id}::uuid AND a.status='published' AND x.action='social.commented' AND x.org_id=a.org_id) AS comments`,
    ),
  )
  return {
    followers: Number(row?.followers ?? 0),
    following: null,
    likes: Number(row?.likes ?? 0),
    comments: Number(row?.comments ?? 0),
  }
}
