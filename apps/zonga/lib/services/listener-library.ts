import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  listenerFacts,
  resolveListenerUUID,
  isZongaId,
  ZongaScopeError,
  ZongaUnavailableError,
  type ListenerActionContext,
} from '@/lib/resolve-org'
import { zongaRows } from '@/queries/action-context'
import { visibleResource, resourceKind } from './listener-resources'
import { createRecommendationEngine, type RecommendationPorts } from '@nzila/zonga-intelligence'
export interface ListenerProfile {
  id: string
  displayName: string
  email?: string
  avatarUrl?: string
  bio?: string
  city?: string
  country?: string
  plan?: string
  subscriptionStatus?: string
  followingCount: number
  favoritesCount: number
  createdAt?: Date
}
export interface ListenerActivity {
  id: string
  activityType: string
  entityType: string
  targetEntityId: string
  metadataJson?: Record<string, unknown>
  createdAt?: Date
}
export interface SavedPlaylist {
  id: string
  playlistId: string
  playlistTitle?: string
  playlistDescription?: string
  savedAt?: Date
}
export interface DiscoverArtist {
  id: string
  displayName: string
  genre?: string
  country?: string
  verified: boolean
  assetCount: number
  followerCount: number
}
export interface DiscoverRelease {
  id: string
  title: string
  creatorName?: string
  releaseType?: string
  coverAssetId?: string
  publishedAt?: Date
  trackCount: number
}
export interface ListenerRecommendation {
  itemId: string
  itemType: string
  score: number
  reason: string
  strategy: string
}
export async function profile(
  context: ListenerActionContext,
  target?: string,
): Promise<ListenerProfile | null> {
  const facts = await listenerFacts(context)
  if (target !== undefined && target !== context.actorId && target !== facts?.id)
    throw new ZongaScopeError()
  if (!facts) return null
  const [counts] = zongaRows<{ following: number; favorites: number }>(
    await context.db.execute(
      sql`SELECT (SELECT count(*) FROM public.zonga_listener_follows WHERE listener_id=${facts.id}) AS following,(SELECT count(*) FROM public.zonga_listener_favorites WHERE listener_id=${facts.id}) AS favorites`,
    ),
  )
  return {
    id: facts.id,
    displayName: facts.displayName,
    email: facts.email ?? undefined,
    avatarUrl: facts.avatarUrl ?? undefined,
    bio: facts.bio ?? undefined,
    city: facts.city ?? undefined,
    country: facts.country ?? undefined,
    plan: facts.plan,
    subscriptionStatus: facts.subscriptionStatus ?? undefined,
    followingCount: Number(counts?.following ?? 0),
    favoritesCount: Number(counts?.favorites ?? 0),
    createdAt: facts.createdAt,
  }
}
export async function ensureProfile(
  context: ListenerActionContext,
  data: { displayName: string; email?: string },
) {
  const value = z
    .object({ displayName: z.string().trim().min(1).max(255), email: z.email().optional() })
    .strict()
    .parse(data)
  const row = await listenerFacts(context, true, value)
  if (!row) throw new Error('Listener profile is unavailable')
  return { id: row.id }
}
export async function updateProfile(
  context: ListenerActionContext,
  data: {
    displayName?: string
    email?: string
    avatarUrl?: string
    bio?: string
    city?: string
    country?: string
  },
) {
  const value = z
    .object({
      displayName: z.string().trim().min(1).max(255).optional(),
      email: z.email().optional(),
      avatarUrl: z.url().optional(),
      bio: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
    })
    .strict()
    .parse(data)
  const row = await listenerFacts(context)
  if (!row) return { success: false as const, error: 'Profile not found' }
  const [updated] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`UPDATE public.zonga_listeners SET display_name=COALESCE(${value.displayName ?? null},display_name),email=COALESCE(${value.email ?? null},email),avatar_url=COALESCE(${value.avatarUrl ?? null},avatar_url),bio=COALESCE(${value.bio ?? null},bio),city=COALESCE(${value.city ?? null},city),country=COALESCE(${value.country ?? null},country),updated_at=clock_timestamp() WHERE id=${row.id}::uuid AND user_id=${context.actorId} RETURNING id`,
    ),
  )
  if (!updated) throw new ZongaScopeError()
  return { success: true as const }
}
export async function feed(context: ListenerActionContext, options?: { limit?: number }) {
  const limit = z
      .number()
      .int()
      .min(1)
      .max(200)
      .parse(options?.limit ?? 50),
    id = await resolveListenerUUID(context)
  return zongaRows<ListenerActivity>(
    await context.db.execute(
      sql`SELECT id,activity_type AS "activityType",entity_type AS "entityType",entity_id AS "targetEntityId",metadata_json AS "metadataJson",created_at AS "createdAt" FROM public.zonga_listener_activity WHERE listener_id=${id}::uuid ORDER BY created_at DESC LIMIT ${limit}`,
    ),
  )
}
export async function activity(
  context: ListenerActionContext,
  data: {
    activityType: string
    entityType: string
    targetEntityId: string
    metadata?: Record<string, unknown>
  },
) {
  const value = z
    .object({
      activityType: z.enum([
        'view',
        'play',
        'follow',
        'favorite',
        'save_playlist',
        'buy_ticket',
        'share',
      ]),
      entityType: z.string(),
      targetEntityId: z.uuid(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .parse(data)
  if (value.activityType === 'buy_ticket') throw new ZongaUnavailableError()
  const resource = await visibleResource(
      context,
      resourceKind(value.entityType),
      value.targetEntityId,
      true,
    ),
    listener = await resolveListenerUUID(context)
  const [created] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.zonga_listener_activity(org_id,listener_id,activity_type,entity_type,entity_id,metadata_json) VALUES(${resource.orgId},${listener}::uuid,${value.activityType},${resource.kind},${resource.id}::uuid,${JSON.stringify({ ...value.metadata, source: 'listener-reported' })}::jsonb) RETURNING id`,
    ),
  )
  if (!created) throw new Error('Activity was not stored')
  return { success: true }
}
export async function save(context: ListenerActionContext, id: string) {
  const target = await visibleResource(context, 'playlist', id, true),
    listener = await resolveListenerUUID(context)
  const [existing] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`SELECT id FROM public.zonga_listener_playlist_saves WHERE listener_id=${listener}::uuid AND playlist_id=${target.id}::uuid LIMIT 1`,
    ),
  )
  if (!existing)
    await context.db.execute(
      sql`INSERT INTO public.zonga_listener_playlist_saves(org_id,listener_id,playlist_id) VALUES(${target.orgId},${listener}::uuid,${target.id}::uuid)`,
    )
  return { success: true }
}
export async function unsave(context: ListenerActionContext, id: string) {
  if (!isZongaId(id)) throw new ZongaScopeError()
  const listener = await resolveListenerUUID(context)
  await context.db.execute(
    sql`DELETE FROM public.zonga_listener_playlist_saves WHERE listener_id=${listener}::uuid AND playlist_id=${id}::uuid`,
  )
  return { success: true }
}
export async function saved(context: ListenerActionContext): Promise<SavedPlaylist[]> {
  const listener = await resolveListenerUUID(context)
  return zongaRows(
    await context.db.execute(
      sql`SELECT s.id,s.playlist_id AS "playlistId",p.title AS "playlistTitle",p.description AS "playlistDescription",s.created_at AS "savedAt" FROM public.zonga_listener_playlist_saves s JOIN public.zonga_playlists p ON p.id=s.playlist_id WHERE s.listener_id=${listener}::uuid AND(p.visibility='public' OR(p.owner_type='listener' AND EXISTS(SELECT 1 FROM public.zonga_listeners l WHERE l.id=p.owner_id AND l.user_id=${context.actorId})) OR(p.owner_type='creator' AND EXISTS(SELECT 1 FROM public.zonga_creators c WHERE c.id=p.owner_id AND c.user_id=${context.actorId}))) ORDER BY s.created_at DESC`,
    ),
  )
}
export async function artists(
  context: ListenerActionContext,
  options?: { genre?: string; country?: string; limit?: number },
): Promise<DiscoverArtist[]> {
  const opts = z
    .object({
      genre: z.string().optional(),
      country: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    })
    .strict()
    .parse(options ?? {})
  return zongaRows(
    await context.db.execute(
      sql`SELECT c.id,c.display_name AS "displayName",c.genre,c.country,c.verified,(SELECT count(*)::int FROM public.zonga_content_assets a WHERE a.creator_id=c.id AND a.status='published' AND(c.org_id IS NULL OR c.org_id=a.org_id)) AS "assetCount",(SELECT count(*)::int FROM public.zonga_listener_follows f WHERE f.creator_id=c.id) AS "followerCount" FROM public.zonga_creators c WHERE c.status='active' ${opts.genre ? sql`AND c.genre=${opts.genre}` : sql``} ${opts.country ? sql`AND c.country=${opts.country}` : sql``} ORDER BY "followerCount" DESC,c.id LIMIT ${opts.limit ?? 20}`,
    ),
  )
}
export async function releases(
  context: ListenerActionContext,
  options?: { limit?: number },
): Promise<DiscoverRelease[]> {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(200)
    .parse(options?.limit ?? 20)
  return zongaRows(
    await context.db.execute(
      sql`SELECT r.id,r.title,c.display_name AS "creatorName",r.release_type AS "releaseType",r.cover_asset_id AS "coverAssetId",r.published_at AS "publishedAt",(SELECT count(*)::int FROM public.zonga_release_tracks t JOIN public.zonga_content_assets a ON a.id=t.asset_id JOIN public.zonga_creators child_creator ON child_creator.id=a.creator_id WHERE t.release_id=r.id AND a.status='published' AND child_creator.status='active' AND(child_creator.org_id IS NULL OR child_creator.org_id=a.org_id)) AS "trackCount" FROM public.zonga_releases r JOIN public.zonga_creators c ON c.id=r.creator_id WHERE r.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=r.org_id) ORDER BY r.published_at DESC NULLS LAST,r.id LIMIT ${limit}`,
    ),
  )
}
export async function recommendations(
  context: ListenerActionContext,
  options?: { limit?: number },
): Promise<{ items: ListenerRecommendation[]; strategy: string }> {
  const limit = z
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(options?.limit ?? 8),
    listener = await resolveListenerUUID(context)
  const ports: RecommendationPorts = {
    fetchUserSignals: async (_user, maxAgeDays) =>
      zongaRows<{ activity: string; target: string; createdAt: Date | string }>(
        await context.db.execute(
          sql`SELECT activity_type AS activity,entity_id AS target,created_at AS "createdAt" FROM public.zonga_listener_activity WHERE listener_id=${listener}::uuid AND activity_type IN('play','stream','save_playlist','favorite','share') AND entity_type IN('asset','track','content_asset') AND entity_id IS NOT NULL AND created_at>clock_timestamp()-interval '1 day'*${maxAgeDays} ORDER BY created_at DESC LIMIT 200`,
        ),
      ).map((row) => {
        const timestamp = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
        if (!Number.isFinite(timestamp.getTime())) throw new Error('Activity timestamp is invalid')
        return {
          userId: context.actorId,
          signalType:
            row.activity === 'favorite' || row.activity === 'save_playlist'
              ? ('save' as const)
              : row.activity === 'share'
                ? ('share' as const)
                : ('play' as const),
          targetId: row.target,
          targetType: 'track' as const,
          weight: 1,
          timestamp,
        }
      }),
    fetchTrendingItems: async (_region, itemType, n) =>
      zongaRows<{ id: string; count: number }>(
        await context.db.execute(
          sql`SELECT a.id,count(x.id)::int AS count FROM public.zonga_content_assets a LEFT JOIN public.zonga_listener_activity x ON x.entity_id=a.id AND x.activity_type IN('play','stream') WHERE a.status='published' GROUP BY a.id ORDER BY count DESC,a.id LIMIT ${n}`,
        ),
      ).map((row) => ({
        itemId: row.id,
        itemType,
        velocity: row.count,
        volume: row.count,
        region: 'global',
      })),
    fetchContentSimilar: async () => [],
    fetchUserRegion: async () => 'global',
  }
  const result = await createRecommendationEngine(ports).recommend({
    userId: context.actorId,
    targetType: 'track',
    limit,
  })
  const ids = result.recommendations.map((r) => r.itemId).filter(isZongaId)
  const allowed = ids.length
    ? new Set(
        zongaRows<{ id: string }>(
          await context.db.execute(
            sql`SELECT a.id FROM public.zonga_content_assets a JOIN public.zonga_creators c ON c.id=a.creator_id WHERE a.id IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`,`,
            )}) AND a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) FOR SHARE OF a,c`,
          ),
        ).map((r) => r.id),
      )
    : new Set<string>()
  return {
    items: result.recommendations
      .filter((row) => allowed.has(row.itemId))
      .map((row) => ({
        itemId: row.itemId,
        itemType: row.itemType,
        score: row.score,
        reason: row.reason,
        strategy: row.strategy,
      })),
    strategy: result.strategy,
  }
}
