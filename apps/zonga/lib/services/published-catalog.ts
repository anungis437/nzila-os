/** Fixed authenticated published projections. Private catalog/provider,
 * legal/financial/assessment metadata never crosses this boundary. */
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  assertZongaContext,
  isZongaId,
  ZongaScopeError,
  type ListenerActionContext,
} from '@/lib/resolve-org'
import { zongaRows } from '@/queries/action-context'
import type { PlaylistListResult } from '@/lib/actions/playlist-actions'
import type { EventListResult } from '@/lib/actions/event-actions'
export interface PublishedAsset {
  id: string
  creatorId: string
  title: string
  type: 'track' | 'album' | 'video' | 'podcast'
  status: 'published'
  genre: string | null
  durationSeconds: number | null
  createdAt: Date
  metadata: { creatorName: string | null }
  language: null
}
export interface PublishedAssetList {
  assets: PublishedAsset[]
  total: number
  hasMore: boolean
}
export interface PublishedCreator {
  id: string
  displayName: string
  bio: string | null
  genre: string | null
  country: string | null
  status: 'active'
  createdAt: Date
}
export interface SearchResult {
  id: string
  type: 'asset' | 'creator' | 'event' | 'playlist'
  title: string
  subtitle?: string
  status?: string
  genre?: string
  createdAt?: Date
}
export interface SearchResults {
  assets: SearchResult[]
  creators: SearchResult[]
  events: SearchResult[]
  playlists: SearchResult[]
  total: number
}
const assetProjection = sql`a.id,a.creator_id AS "creatorId",a.title,a.type,a.status,a.genre,a.duration_seconds AS "durationSeconds",a.created_at AS "createdAt",jsonb_build_object('creatorName',c.display_name) AS metadata,NULL AS language`
export async function publishedAssets(
  context: ListenerActionContext,
  options?: {
    page?: number
    pageSize?: number
    search?: string
    type?: string
    creatorId?: string
  },
): Promise<PublishedAssetList> {
  assertZongaContext(context)
  const value = z
      .object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
        search: z.string().optional(),
        type: z.enum(['track', 'album', 'video', 'podcast']).optional(),
        creatorId: z.uuid().optional(),
      })
      .strict()
      .parse(options ?? {}),
    offset = ((value.page ?? 1) - 1) * (value.pageSize ?? 25)
  const filter = sql`a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) ${value.search ? sql`AND lower(a.title) LIKE ${`%${value.search.toLowerCase()}%`}` : sql``} ${value.type ? sql`AND a.type=${value.type}` : sql``} ${value.creatorId ? sql`AND a.creator_id=${value.creatorId}::uuid` : sql``}`
  const assets = zongaRows<PublishedAsset>(
      await context.db.execute(
        sql`SELECT ${assetProjection} FROM public.zonga_content_assets a JOIN public.zonga_creators c ON c.id=a.creator_id WHERE ${filter} ORDER BY a.created_at DESC,a.id LIMIT ${value.pageSize ?? 25} OFFSET ${offset}`,
      ),
    ),
    [count] = zongaRows<{ total: number }>(
      await context.db.execute(
        sql`SELECT count(*) AS total FROM public.zonga_content_assets a JOIN public.zonga_creators c ON c.id=a.creator_id WHERE ${filter}`,
      ),
    ),
    total = Number(count?.total ?? 0)
  return { assets, total, hasMore: offset + assets.length < total }
}
export async function publishedAsset(
  context: ListenerActionContext,
  id: string,
): Promise<PublishedAsset | null> {
  assertZongaContext(context)
  if (!isZongaId(id)) throw new ZongaScopeError()
  const [row] = zongaRows<PublishedAsset>(
    await context.db.execute(
      sql`SELECT ${assetProjection} FROM public.zonga_content_assets a JOIN public.zonga_creators c ON c.id=a.creator_id WHERE a.id=${id}::uuid AND a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) FOR SHARE OF a,c`,
    ),
  )
  return row ?? null
}
export async function publishedCreator(
  context: ListenerActionContext,
  id: string,
): Promise<PublishedCreator | null> {
  assertZongaContext(context)
  if (!isZongaId(id)) throw new ZongaScopeError()
  const [row] = zongaRows<PublishedCreator>(
    await context.db.execute(
      sql`SELECT id,display_name AS "displayName",bio,genre,country,status,created_at AS "createdAt" FROM public.zonga_creators WHERE id=${id}::uuid AND status='active' FOR SHARE`,
    ),
  )
  return row ?? null
}
export async function publicPlaylists(
  context: ListenerActionContext,
  options?: { page?: number; search?: string },
): Promise<PlaylistListResult> {
  assertZongaContext(context)
  const value = z
      .object({ page: z.number().int().min(1).optional(), search: z.string().optional() })
      .strict()
      .parse(options ?? {}),
    filter = sql`p.visibility='public' ${value.search ? sql`AND lower(p.title) LIKE ${`%${value.search.toLowerCase()}%`}` : sql``}`
  const playlists = zongaRows<PlaylistListResult['playlists'][number]>(
      await context.db.execute(
        sql`SELECT p.id,p.title,p.description,p.owner_type AS "ownerType",p.visibility,(SELECT count(*)::int FROM public.zonga_playlist_items i JOIN public.zonga_content_assets a ON a.id=i.entity_id WHERE i.playlist_id=p.id AND i.entity_type IN('asset','track','content_asset') AND a.status='published' AND EXISTS(SELECT 1 FROM public.zonga_creators c WHERE c.id=a.creator_id AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id))) AS "trackCount",p.created_at AS "createdAt" FROM public.zonga_playlists p WHERE ${filter} ORDER BY p.created_at DESC,p.id LIMIT 25 OFFSET ${((value.page ?? 1) - 1) * 25}`,
      ),
    ),
    [count] = zongaRows<{ total: number }>(
      await context.db.execute(
        sql`SELECT count(*) AS total FROM public.zonga_playlists p WHERE ${filter}`,
      ),
    )
  return { playlists, total: Number(count?.total ?? 0) }
}
export async function publishedEvents(
  context: ListenerActionContext,
  options?: { page?: number },
): Promise<EventListResult> {
  assertZongaContext(context)
  const page = z
      .number()
      .int()
      .min(1)
      .parse(options?.page ?? 1),
    events = zongaRows<EventListResult['events'][number]>(
      await context.db.execute(
        sql`SELECT e.id,e.title,e.description,e.venue,e.city,e.country,e.starts_at AS "startsAt",e.ends_at AS "endsAt",e.status,e.image_url AS "imageUrl",e.creator_id AS "creatorId",c.display_name AS "creatorName",e.created_at AS "createdAt" FROM public.zonga_events e JOIN public.zonga_creators c ON c.id=e.creator_id WHERE e.status IN('published','sold_out') AND c.status='active' AND(c.org_id IS NULL OR c.org_id=e.org_id) ORDER BY e.starts_at,e.id LIMIT 25 OFFSET ${(page - 1) * 25}`,
      ),
    ),
    [count] = zongaRows<{ total: number }>(
      await context.db.execute(
        sql`SELECT count(*) AS total FROM public.zonga_events e JOIN public.zonga_creators c ON c.id=e.creator_id WHERE e.status IN('published','sold_out') AND c.status='active' AND(c.org_id IS NULL OR c.org_id=e.org_id)`,
      ),
    )
  return { events, total: Number(count?.total ?? 0) }
}
export async function trending(context: ListenerActionContext): Promise<SearchResult[]> {
  assertZongaContext(context)
  const rows = zongaRows<Omit<SearchResult, 'type'>>(
    await context.db.execute(
      sql`SELECT a.id,a.title,c.display_name AS subtitle,a.genre FROM public.zonga_content_assets a JOIN public.zonga_creators c ON c.id=a.creator_id LEFT JOIN public.zonga_listener_favorites f ON f.entity_id=a.id AND f.entity_type IN('asset','track','content_asset') AND f.created_at>=clock_timestamp()-interval '30 days' WHERE a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) GROUP BY a.id,a.title,c.display_name,a.genre ORDER BY count(f.id) DESC,a.id LIMIT 10`,
    ),
  )
  return rows.map((row) => ({ ...row, type: 'asset' }))
}
export async function search(
  context: ListenerActionContext,
  query: string,
): Promise<SearchResults> {
  assertZongaContext(context)
  const text = z.string().parse(query).trim()
  if (text.length < 2) return { assets: [], creators: [], events: [], playlists: [], total: 0 }
  const pattern = `%${text.toLowerCase()}%`
  const assets = zongaRows<Omit<SearchResult, 'type'>>(
    await context.db.execute(
      sql`SELECT a.id,a.title,c.display_name AS subtitle,a.status,a.genre,a.created_at AS "createdAt" FROM public.zonga_content_assets a JOIN public.zonga_creators c ON c.id=a.creator_id WHERE a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) AND(lower(a.title) LIKE ${pattern} OR lower(c.display_name) LIKE ${pattern} OR lower(a.genre) LIKE ${pattern}) ORDER BY a.created_at DESC LIMIT 20`,
    ),
  ).map((row) => ({ ...row, type: 'asset' as const }))
  const creators = zongaRows<Omit<SearchResult, 'type'>>(
    await context.db.execute(
      sql`SELECT id,display_name AS title,genre AS subtitle,status,genre,created_at AS "createdAt" FROM public.zonga_creators WHERE status='active' AND(lower(display_name) LIKE ${pattern} OR lower(genre) LIKE ${pattern} OR lower(country) LIKE ${pattern}) ORDER BY created_at DESC LIMIT 20`,
    ),
  ).map((row) => ({ ...row, type: 'creator' as const }))
  const events = zongaRows<Omit<SearchResult, 'type'>>(
    await context.db.execute(
      sql`SELECT e.id,e.title,e.venue AS subtitle,e.status,e.created_at AS "createdAt" FROM public.zonga_events e JOIN public.zonga_creators c ON c.id=e.creator_id WHERE e.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=e.org_id) AND(lower(e.title) LIKE ${pattern} OR lower(e.venue) LIKE ${pattern} OR lower(e.city) LIKE ${pattern}) ORDER BY e.created_at DESC LIMIT 20`,
    ),
  ).map((row) => ({ ...row, type: 'event' as const }))
  const playlists = zongaRows<Omit<SearchResult, 'type'>>(
    await context.db.execute(
      sql`SELECT id,title,description AS subtitle,visibility AS status,created_at AS "createdAt" FROM public.zonga_playlists WHERE visibility='public' AND(lower(title) LIKE ${pattern} OR lower(description) LIKE ${pattern}) ORDER BY created_at DESC LIMIT 20`,
    ),
  ).map((row) => ({ ...row, type: 'playlist' as const }))
  return {
    assets,
    creators,
    events,
    playlists,
    total: assets.length + creators.length + events.length + playlists.length,
  }
}
export async function recentlyPlayed(context: ListenerActionContext): Promise<SearchResult[]> {
  assertZongaContext(context)
  const rows = zongaRows<Omit<SearchResult, 'type'>>(
    await context.db.execute(
      sql`SELECT a.id,a.title,c.display_name AS subtitle,a.genre,x.created_at AS "createdAt" FROM public.zonga_listener_activity x JOIN public.zonga_listeners l ON l.id=x.listener_id JOIN public.zonga_content_assets a ON a.id=x.entity_id JOIN public.zonga_creators c ON c.id=a.creator_id WHERE l.user_id=${context.actorId} AND x.activity_type IN('stream','play') AND x.entity_type IN('asset','track','content_asset') AND a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) ORDER BY x.created_at DESC LIMIT 20`,
    ),
  )
  return rows.map((row) => ({ ...row, type: 'asset' }))
}
