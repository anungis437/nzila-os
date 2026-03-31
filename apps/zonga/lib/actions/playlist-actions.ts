/**
 * Zonga Server Actions — Playlists.
 *
 * Create, list, update, and manage playlists.
 * Reads/writes zonga_playlists + zonga_playlist_items domain tables.
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
} from '@/lib/zonga-services'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export interface Playlist {
  id: string
  title: string
  description?: string
  ownerType?: string
  ownerId?: string
  creatorName?: string
  trackCount: number
  coverUrl?: string
  visibility: string
  genre?: string
  createdAt?: Date
}

export interface PlaylistTrack {
  id: string
  assetId: string
  title: string
  creatorName?: string
  genre?: string
  position: number
}

export interface PlaylistListResult {
  playlists: Playlist[]
  total: number
}

/* ─── List ─── */

export async function listPlaylists(opts?: {
  page?: number
  search?: string
  creatorId?: string
}): Promise<PlaylistListResult> {
  const ctx = await resolveOrgContext()

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    const searchFilter = opts?.search
      ? sql` AND LOWER(p.title) LIKE ${'%' + opts.search.toLowerCase() + '%'}`
      : sql``
    const creatorFilter = opts?.creatorId
      ? sql` AND p.owner_id = ${opts.creatorId}`
      : sql``

    const rows = (await platformDb.execute(
      sql`SELECT
        p.id,
        p.title,
        p.description,
        p.owner_type as "ownerType",
        p.owner_id as "ownerId",
        p.visibility,
        COALESCE((SELECT COUNT(*) FROM zonga_playlist_items WHERE playlist_id = p.id), 0)::int as "trackCount",
        p.created_at as "createdAt"
      FROM zonga_playlists p
      WHERE p.org_id = ${ctx.orgId}
      ${searchFilter} ${creatorFilter}
      ORDER BY p.created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as Playlist[]

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_playlists WHERE org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    return {
      playlists: rows,
      total: Number(cnt?.total ?? 0),
    }
  } catch (error) {
    logger.error('listPlaylists failed', { error })
    return { playlists: [], total: 0 }
  }
}

/* ─── Detail ─── */

export async function getPlaylistDetail(playlistId: string): Promise<{
  playlist: Playlist | null
  tracks: PlaylistTrack[]
}> {
  const ctx = await resolveOrgContext()

  try {
    const [playlist] = (await platformDb.execute(
      sql`SELECT
        p.id,
        p.title,
        p.description,
        p.owner_type as "ownerType",
        p.owner_id as "ownerId",
        p.visibility,
        COALESCE((SELECT COUNT(*) FROM zonga_playlist_items WHERE playlist_id = p.id), 0)::int as "trackCount",
        p.created_at as "createdAt"
      FROM zonga_playlists p
      WHERE p.id = ${playlistId} AND p.org_id = ${ctx.orgId}`,
    )) as unknown as [Playlist | undefined]

    const trackRows = (await platformDb.execute(
      sql`SELECT
        i.id,
        i.entity_id as "assetId",
        a.title,
        c.display_name as "creatorName",
        a.genre,
        i.position
      FROM zonga_playlist_items i
      LEFT JOIN zonga_content_assets a ON a.id = i.entity_id
      LEFT JOIN zonga_creators c ON c.id = a.creator_id
      WHERE i.playlist_id = ${playlistId}
      ORDER BY i.position ASC`,
    )) as unknown as PlaylistTrack[]

    return {
      playlist: playlist ?? null,
      tracks: trackRows,
    }
  } catch (error) {
    logger.error('getPlaylistDetail failed', { error })
    return { playlist: null, tracks: [] }
  }
}

/* ─── Create ─── */

export async function createPlaylist(data: {
  title: string
  description?: string
  genre?: string
  visibility?: string
}): Promise<{ success: boolean; playlistId?: string }> {
  const ctx = await resolveOrgContext()

  try {
    const [row] = (await platformDb.execute(
      sql`INSERT INTO zonga_playlists (org_id, owner_type, owner_id, title, description, visibility)
      VALUES (${ctx.orgId}, 'user', ${ctx.actorId}, ${data.title},
        ${data.description ?? null}, ${data.visibility ?? 'public'})
      RETURNING id`,
    )) as unknown as [{ id: string }]

    const playlistId = row.id

    // Supplementary audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('playlist.created', ${ctx.actorId}, 'playlist', ${playlistId}, ${ctx.orgId},
        ${JSON.stringify({ title: data.title })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: 'playlist.created' as ZongaAuditAction,
      entityType: 'playlist' as ZongaEntityType,
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      targetId: playlistId,
      metadata: { title: data.title },
    })
    logger.info('Playlist created', { ...auditEvent })

    const pack = buildEvidencePackFromAction({
      actionType: 'PLAYLIST_CREATED',
      orgId: ctx.orgId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/playlists')
    return { success: true, playlistId }
  } catch (error) {
    logger.error('createPlaylist failed', { error })
    return { success: false }
  }
}

/* ─── Add Track ─── */

export async function addTrackToPlaylist(data: {
  playlistId: string
  assetId: string
  position?: number
}): Promise<{ success: boolean }> {
  const _ctx = await resolveOrgContext()

  try {
    // Determine position (append by default)
    let position = data.position
    if (position === undefined) {
      const [cnt] = (await platformDb.execute(
        sql`SELECT COALESCE(MAX(position), 0) + 1 as next FROM zonga_playlist_items
        WHERE playlist_id = ${data.playlistId}`,
      )) as unknown as [{ next: number }]
      position = Number(cnt?.next ?? 1)
    }

    await platformDb.execute(
      sql`INSERT INTO zonga_playlist_items (playlist_id, entity_type, entity_id, position)
      VALUES (${data.playlistId}, 'asset', ${data.assetId}, ${position})`,
    )

    logger.info('Track added to playlist', {
      playlistId: data.playlistId,
      assetId: data.assetId,
      position,
    })

    revalidatePath('/dashboard/playlists')
    return { success: true }
  } catch (error) {
    logger.error('addTrackToPlaylist failed', { error })
    return { success: false }
  }
}

/* ─── Remove Track ─── */

export async function removeTrackFromPlaylist(data: {
  playlistId: string
  assetId: string
}): Promise<{ success: boolean }> {
  const _ctx = await resolveOrgContext()

  try {
    await platformDb.execute(
      sql`DELETE FROM zonga_playlist_items
      WHERE playlist_id = ${data.playlistId} AND entity_id = ${data.assetId}`,
    )

    logger.info('Track removed from playlist', {
      playlistId: data.playlistId,
      assetId: data.assetId,
    })

    revalidatePath('/dashboard/playlists')
    return { success: true }
  } catch (error) {
    logger.error('removeTrackFromPlaylist failed', { error })
    return { success: false }
  }
}
