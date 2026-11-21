import { sql } from 'drizzle-orm'
import {
  assertZongaContext,
  isZongaId,
  ZongaScopeError,
  type ListenerActionContext,
} from '@/lib/resolve-org'
import { zongaRows } from '@/queries/action-context'
export type VisibleKind = 'asset' | 'creator' | 'release' | 'playlist' | 'event'
export interface VisibleResource {
  id: string
  orgId: string
  kind: VisibleKind
  creatorId?: string
  storageUrl?: string | null
  title?: string
}
export async function visibleResource(
  context: ListenerActionContext,
  kind: VisibleKind,
  id: string,
  ownPlaylist = false,
): Promise<VisibleResource> {
  assertZongaContext(context)
  if (!isZongaId(id)) throw new ZongaScopeError()
  let rows: {
    id: string
    orgId: string | null
    creatorId?: string
    storageUrl?: string | null
    title?: string
  }[] = []
  switch (kind) {
    case 'asset':
      rows = zongaRows(
        await context.db.execute(
          sql`SELECT a.id,a.org_id AS "orgId",a.creator_id AS "creatorId",a.storage_url AS "storageUrl",a.title FROM public.zonga_content_assets a JOIN public.zonga_creators c ON c.id=a.creator_id WHERE a.id=${id}::uuid AND a.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=a.org_id) FOR SHARE OF a,c`,
        ),
      )
      break
    case 'creator':
      rows = zongaRows(
        await context.db.execute(
          sql`SELECT id,org_id AS "orgId" FROM public.zonga_creators WHERE id=${id}::uuid AND status='active' FOR SHARE`,
        ),
      )
      break
    case 'release':
      rows = zongaRows(
        await context.db.execute(
          sql`SELECT r.id,r.org_id AS "orgId",r.creator_id AS "creatorId",r.title FROM public.zonga_releases r JOIN public.zonga_creators c ON c.id=r.creator_id WHERE r.id=${id}::uuid AND r.status='published' AND c.status='active' AND(c.org_id IS NULL OR c.org_id=r.org_id) FOR SHARE OF r,c`,
        ),
      )
      break
    case 'event':
      rows = zongaRows(
        await context.db.execute(
          sql`SELECT e.id,e.org_id AS "orgId",e.creator_id AS "creatorId",e.title FROM public.zonga_events e JOIN public.zonga_creators c ON c.id=e.creator_id WHERE e.id=${id}::uuid AND e.status IN('published','sold_out') AND c.status='active' AND(c.org_id IS NULL OR c.org_id=e.org_id) FOR SHARE OF e,c`,
        ),
      )
      break
    case 'playlist':
      rows = zongaRows(
        await context.db.execute(
          sql`SELECT p.id,p.org_id AS "orgId",p.title FROM public.zonga_playlists p WHERE p.id=${id}::uuid AND(p.visibility='public' OR(${ownPlaylist} AND((p.owner_type='listener' AND EXISTS(SELECT 1 FROM public.zonga_listeners l WHERE l.id=p.owner_id AND l.user_id=${context.actorId})) OR(p.owner_type='creator' AND EXISTS(SELECT 1 FROM public.zonga_creators c WHERE c.id=p.owner_id AND c.user_id=${context.actorId}))))) FOR SHARE OF p`,
        ),
      )
      break
  }
  const row = rows[0]
  if (!row || !row.orgId || !isZongaId(row.orgId))
    throw new ZongaScopeError('Resource is unavailable')
  return { ...row, orgId: row.orgId, kind }
}
export function resourceKind(value: string): VisibleKind {
  if (['asset', 'track', 'content_asset'].includes(value)) return 'asset'
  if (['creator', 'artist'].includes(value)) return 'creator'
  if (value === 'release' || value === 'playlist' || value === 'event') return value
  throw new ZongaScopeError('Unsupported resource type')
}
/** The upload producer uses exactly creatorId/assetId/filename. A published
 * row cannot turn a pointer to another private blob into signing authority. */
export function audioBlobPath(resource: VisibleResource): string {
  if (
    resource.kind !== 'asset' ||
    !resource.creatorId ||
    !resource.storageUrl?.startsWith('blob://')
  )
    throw new ZongaScopeError('Audio is unavailable')
  const value = resource.storageUrl.slice(7),
    prefix = `${resource.creatorId}/${resource.id}/`
  if (
    !value.startsWith(prefix) ||
    value.length === prefix.length ||
    /[\\?#\u0000-\u001f\u007f]/.test(value) ||
    value.split('/').some((part) => part === '..' || part === '.') ||
    /%(?:2e|2f|5c)/i.test(value)
  )
    throw new ZongaScopeError('Audio source does not match the published resource')
  return value
}
