/**
 * Zonga Server Actions — Podcasts.
 *
 * Creator: create/edit/delete podcast shows and episodes,
 * publish/archive, manage metadata.
 * Listener: browse published podcasts and episodes.
 */
'use server'

import { resolveOrgContext, resolveListenerContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

/* ─── Types ─── */

export interface ZongaPodcast {
  id: string
  title: string
  description?: string
  coverUrl?: string
  language: string
  category?: string
  explicit: boolean
  status: 'draft' | 'published' | 'archived'
  episodeCount: number
  rssFeedUrl?: string
  websiteUrl?: string
  creatorName?: string
  createdAt?: string
  updatedAt?: string
}

export interface ZongaEpisode {
  id: string
  podcastId: string
  title: string
  description?: string
  audioUrl?: string
  durationSecs?: number
  episodeNumber?: number
  seasonNumber?: number
  explicit: boolean
  status: 'draft' | 'published' | 'archived'
  publishedAt?: string
  coverUrl?: string
  createdAt?: string
}

export interface PodcastListResult {
  podcasts: ZongaPodcast[]
  total: number
}

export interface EpisodeListResult {
  episodes: ZongaEpisode[]
  total: number
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Creator Actions                                                            */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ─── List Creator's Podcasts ─── */

export async function listPodcasts(opts?: {
  page?: number
  status?: string
}): Promise<PodcastListResult> {
  const ctx = await resolveOrgContext()
  const page = opts?.page ?? 1
  const limit = 20
  const offset = (page - 1) * limit

  try {
    const statusFilter = opts?.status
      ? sql`AND p.status = ${opts.status}`
      : sql``

    const rows = await platformDb.execute(sql`
      SELECT
        p.id, p.title, p.description, p.cover_url AS "coverUrl",
        p.language, p.category, p.explicit, p.status,
        p.episode_count AS "episodeCount", p.rss_feed_url AS "rssFeedUrl",
        p.website_url AS "websiteUrl",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt"
      FROM zonga_podcasts p
      WHERE p.org_id = ${ctx.orgId}
        ${statusFilter}
      ORDER BY p.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `)

    const countResult = await platformDb.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM zonga_podcasts
      WHERE org_id = ${ctx.orgId}
        ${statusFilter}
    `)

    const total = (countResult as unknown[])[0] as { total: number } | undefined

    return {
      podcasts: (rows as unknown as ZongaPodcast[]) ?? [],
      total: total?.total ?? 0,
    }
  } catch (err) {
    logger.error('listPodcasts failed', { error: err })
    return { podcasts: [], total: 0 }
  }
}

/* ─── Get Podcast Detail (Creator) ─── */

export async function getPodcastDetail(podcastId: string) {
  const ctx = await resolveOrgContext()

  try {
    const rows = await platformDb.execute(sql`
      SELECT
        p.id, p.title, p.description, p.cover_url AS "coverUrl",
        p.language, p.category, p.explicit, p.status,
        p.episode_count AS "episodeCount", p.rss_feed_url AS "rssFeedUrl",
        p.website_url AS "websiteUrl",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt"
      FROM zonga_podcasts p
      WHERE p.id = ${podcastId} AND p.org_id = ${ctx.orgId}
    `)

    const podcast = (rows as unknown[])[0] as ZongaPodcast | undefined

    // Fetch episodes
    const epRows = await platformDb.execute(sql`
      SELECT
        e.id, e.podcast_id AS "podcastId", e.title, e.description,
        e.audio_url AS "audioUrl", e.duration_secs AS "durationSecs",
        e.episode_number AS "episodeNumber", e.season_number AS "seasonNumber",
        e.explicit, e.status, e.published_at AS "publishedAt",
        e.cover_url AS "coverUrl", e.created_at AS "createdAt"
      FROM zonga_podcast_episodes e
      WHERE e.podcast_id = ${podcastId} AND e.org_id = ${ctx.orgId}
      ORDER BY e.season_number ASC, e.episode_number ASC
    `)

    return {
      podcast: podcast ?? null,
      episodes: (epRows as unknown as ZongaEpisode[]) ?? [],
    }
  } catch (err) {
    logger.error('getPodcastDetail failed', { podcastId, error: err })
    return { podcast: null, episodes: [] }
  }
}

/* ─── Create Podcast ─── */

export async function createPodcast(data: {
  title: string
  description?: string
  coverUrl?: string
  language?: string
  category?: string
  explicit?: boolean
}) {
  const ctx = await resolveOrgContext()

  try {
    const rows = await platformDb.execute(sql`
      INSERT INTO zonga_podcasts (org_id, creator_id, title, description, cover_url, language, category, explicit)
      VALUES (
        ${ctx.orgId},
        ${ctx.actorId},
        ${data.title},
        ${data.description ?? null},
        ${data.coverUrl ?? null},
        ${data.language ?? 'en'},
        ${data.category ?? null},
        ${data.explicit ?? false}
      )
      RETURNING id
    `)

    const newId = ((rows as unknown[])[0] as { id: string })?.id
    revalidatePath('/dashboard/podcasts')
    return { success: true, podcastId: newId }
  } catch (err) {
    logger.error('createPodcast failed', { error: err })
    return { success: false, error: 'Failed to create podcast' }
  }
}

/* ─── Update Podcast ─── */

export async function updatePodcast(
  podcastId: string,
  data: {
    title?: string
    description?: string
    coverUrl?: string
    language?: string
    category?: string
    explicit?: boolean
    status?: 'draft' | 'published' | 'archived'
  },
) {
  const ctx = await resolveOrgContext()

  try {
    await platformDb.execute(sql`
      UPDATE zonga_podcasts
      SET
        title = COALESCE(${data.title ?? null}, title),
        description = COALESCE(${data.description ?? null}, description),
        cover_url = COALESCE(${data.coverUrl ?? null}, cover_url),
        language = COALESCE(${data.language ?? null}, language),
        category = COALESCE(${data.category ?? null}, category),
        explicit = COALESCE(${data.explicit ?? null}, explicit),
        status = COALESCE(${data.status ?? null}, status),
        updated_at = now()
      WHERE id = ${podcastId} AND org_id = ${ctx.orgId}
    `)

    revalidatePath('/dashboard/podcasts')
    return { success: true }
  } catch (err) {
    logger.error('updatePodcast failed', { podcastId, error: err })
    return { success: false, error: 'Failed to update podcast' }
  }
}

/* ─── Create Episode ─── */

export async function createEpisode(
  podcastId: string,
  data: {
    title: string
    description?: string
    audioUrl?: string
    durationSecs?: number
    episodeNumber?: number
    seasonNumber?: number
    explicit?: boolean
  },
) {
  const ctx = await resolveOrgContext()

  try {
    const rows = await platformDb.execute(sql`
      INSERT INTO zonga_podcast_episodes
        (podcast_id, org_id, title, description, audio_url, duration_secs,
         episode_number, season_number, explicit)
      VALUES (
        ${podcastId}, ${ctx.orgId}, ${data.title},
        ${data.description ?? null}, ${data.audioUrl ?? null},
        ${data.durationSecs ?? null}, ${data.episodeNumber ?? null},
        ${data.seasonNumber ?? 1}, ${data.explicit ?? false}
      )
      RETURNING id
    `)

    // Bump episode count
    await platformDb.execute(sql`
      UPDATE zonga_podcasts
      SET episode_count = episode_count + 1, updated_at = now()
      WHERE id = ${podcastId} AND org_id = ${ctx.orgId}
    `)

    const newId = ((rows as unknown[])[0] as { id: string })?.id
    revalidatePath('/dashboard/podcasts')
    return { success: true, episodeId: newId }
  } catch (err) {
    logger.error('createEpisode failed', { podcastId, error: err })
    return { success: false, error: 'Failed to create episode' }
  }
}

/* ─── Update Episode ─── */

export async function updateEpisode(
  episodeId: string,
  data: {
    title?: string
    description?: string
    audioUrl?: string
    durationSecs?: number
    episodeNumber?: number
    seasonNumber?: number
    explicit?: boolean
    status?: 'draft' | 'published' | 'archived'
  },
) {
  const ctx = await resolveOrgContext()

  try {
    const publishedAt =
      data.status === 'published'
        ? sql`COALESCE(published_at, now())`
        : sql`published_at`

    await platformDb.execute(sql`
      UPDATE zonga_podcast_episodes
      SET
        title = COALESCE(${data.title ?? null}, title),
        description = COALESCE(${data.description ?? null}, description),
        audio_url = COALESCE(${data.audioUrl ?? null}, audio_url),
        duration_secs = COALESCE(${data.durationSecs ?? null}, duration_secs),
        episode_number = COALESCE(${data.episodeNumber ?? null}, episode_number),
        season_number = COALESCE(${data.seasonNumber ?? null}, season_number),
        explicit = COALESCE(${data.explicit ?? null}, explicit),
        status = COALESCE(${data.status ?? null}, status),
        published_at = ${publishedAt},
        updated_at = now()
      WHERE id = ${episodeId} AND org_id = ${ctx.orgId}
    `)

    revalidatePath('/dashboard/podcasts')
    return { success: true }
  } catch (err) {
    logger.error('updateEpisode failed', { episodeId, error: err })
    return { success: false, error: 'Failed to update episode' }
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Listener / Browse Actions                                                  */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ─── Browse Published Podcasts ─── */

export async function browsePublishedPodcasts(opts?: {
  page?: number
  search?: string
  category?: string
}): Promise<PodcastListResult> {
  await resolveListenerContext()
  const page = opts?.page ?? 1
  const limit = 20
  const offset = (page - 1) * limit

  try {
    const searchFilter = opts?.search
      ? sql`AND LOWER(p.title) LIKE ${'%' + opts.search.toLowerCase() + '%'}`
      : sql``
    const categoryFilter = opts?.category
      ? sql`AND p.category = ${opts.category}`
      : sql``

    const rows = await platformDb.execute(sql`
      SELECT
        p.id, p.title, p.description, p.cover_url AS "coverUrl",
        p.language, p.category, p.explicit, p.status,
        p.episode_count AS "episodeCount",
        c.display_name AS "creatorName",
        p.created_at AS "createdAt"
      FROM zonga_podcasts p
      LEFT JOIN zonga_creators c ON c.id = p.creator_id
      WHERE p.status = 'published'
        ${searchFilter}
        ${categoryFilter}
      ORDER BY p.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `)

    const countResult = await platformDb.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM zonga_podcasts p
      WHERE p.status = 'published'
        ${searchFilter}
        ${categoryFilter}
    `)

    const total = (countResult as unknown[])[0] as { total: number } | undefined

    return {
      podcasts: (rows as unknown as ZongaPodcast[]) ?? [],
      total: total?.total ?? 0,
    }
  } catch (err) {
    logger.error('browsePublishedPodcasts failed', { error: err })
    return { podcasts: [], total: 0 }
  }
}

/* ─── Get Published Podcast Detail (Listener) ─── */

export async function getPublishedPodcastDetail(podcastId: string) {
  await resolveListenerContext()

  try {
    const rows = await platformDb.execute(sql`
      SELECT
        p.id, p.title, p.description, p.cover_url AS "coverUrl",
        p.language, p.category, p.explicit, p.status,
        p.episode_count AS "episodeCount",
        c.display_name AS "creatorName",
        p.created_at AS "createdAt"
      FROM zonga_podcasts p
      LEFT JOIN zonga_creators c ON c.id = p.creator_id
      WHERE p.id = ${podcastId} AND p.status = 'published'
    `)

    const podcast = (rows as unknown[])[0] as ZongaPodcast | undefined

    // Published episodes only
    const epRows = await platformDb.execute(sql`
      SELECT
        e.id, e.podcast_id AS "podcastId", e.title, e.description,
        e.audio_url AS "audioUrl", e.duration_secs AS "durationSecs",
        e.episode_number AS "episodeNumber", e.season_number AS "seasonNumber",
        e.explicit, e.status, e.published_at AS "publishedAt",
        e.cover_url AS "coverUrl", e.created_at AS "createdAt"
      FROM zonga_podcast_episodes e
      WHERE e.podcast_id = ${podcastId} AND e.status = 'published'
      ORDER BY e.season_number ASC, e.episode_number ASC
    `)

    return {
      podcast: podcast ?? null,
      creatorName: podcast?.creatorName ?? null,
      episodes: (epRows as unknown as ZongaEpisode[]) ?? [],
    }
  } catch (err) {
    logger.error('getPublishedPodcastDetail failed', { podcastId, error: err })
    return { podcast: null, creatorName: null, episodes: [] }
  }
}
