/**
 * Zonga — Podcast Detail Page (Server Component).
 *
 * Creators: full show management with episode list & add-episode form.
 * Listeners: polished show page with published episodes.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@nzila/ui'
import {
  getPodcastDetail,
  getPublishedPodcastDetail,
  type ZongaPodcast,
  type ZongaEpisode,
} from '@/lib/actions/podcast-actions'
import { Podcast, ArrowLeft, Mic2, Clock, Play, Calendar, Headphones } from 'lucide-react'

export default async function PodcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const isCreator = !!orgId

  if (isCreator) {
    const { podcast, episodes } = await getPodcastDetail(id)
    if (!podcast) notFound()
    return <CreatorPodcastDetail podcast={podcast} episodes={episodes} podcastId={id} />
  }

  const { podcast, creatorName, episodes } = await getPublishedPodcastDetail(id)
  if (!podcast) notFound()
  return <ListenerPodcastDetail podcast={podcast} creatorName={creatorName} episodes={episodes} />
}

/* ─── Helpers ─── */

function formatDuration(secs: number | undefined | null): string {
  if (!secs) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Listener View                                                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ListenerPodcastDetail({
  podcast,
  creatorName,
  episodes,
}: {
  podcast: ZongaPodcast
  creatorName: string | null
  episodes: ZongaEpisode[]
}) {
  return (
    <div className="space-y-8">
      {/* Back */}
      <Link
        href="../podcasts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft size={14} />
        All Podcasts
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-navy via-navy/95 to-purple-600/70 p-8 sm:p-10 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.12),transparent_50%)]" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row gap-6">
          {/* Cover */}
          <div className="h-40 w-40 shrink-0 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden relative">
            {podcast.coverUrl ? (
              <Image src={podcast.coverUrl} alt={podcast.title} fill className="object-cover" unoptimized />
            ) : (
              <Podcast size={56} className="text-white/30" />
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-purple-300 uppercase tracking-wider mb-1">Podcast</p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{podcast.title}</h1>
            </div>

            {creatorName && (
              <div className="flex items-center gap-2">
                <Mic2 size={14} className="text-purple-300" />
                <span className="text-sm font-medium text-purple-200">{creatorName}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <Headphones size={14} className="text-white/40" />
                {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
              </span>
              {podcast.category && (
                <span className="inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-xs">
                  {podcast.category}
                </span>
              )}
              {podcast.explicit && (
                <span className="inline-flex rounded-full bg-red-500/20 border border-red-400/30 px-2 py-0.5 text-xs text-red-200">
                  Explicit
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description + Episodes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          {podcast.description && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">About this podcast</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {podcast.description}
              </p>
            </div>
          )}

          {/* Episodes */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Episodes ({episodes.length})
            </h2>
            {episodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No episodes published yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {episodes.map((ep) => (
                  <div key={ep.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    {/* Play button placeholder */}
                    <div className="shrink-0 mt-0.5">
                      <div className="h-10 w-10 rounded-full bg-purple-600 flex items-center justify-center text-white hover:bg-purple-700 transition cursor-pointer">
                        <Play size={16} className="ml-0.5" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {ep.episodeNumber && (
                          <span className="text-xs text-muted-foreground/50 font-mono">
                            {ep.seasonNumber && ep.seasonNumber > 1 ? `S${ep.seasonNumber} · ` : ''}
                            Ep {ep.episodeNumber}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-foreground leading-snug">{ep.title}</h3>
                      {ep.description && (
                        <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{ep.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/50">
                        {ep.publishedAt && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(ep.publishedAt).toLocaleDateString('en-CA')}
                          </span>
                        )}
                        {ep.durationSecs && (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={10} />
                            {formatDuration(ep.durationSecs)}
                          </span>
                        )}
                        {ep.explicit && (
                          <span className="text-red-400 font-medium">E</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Show Details</h2>
            <dl className="space-y-3 text-sm">
              {podcast.category && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="text-foreground">{podcast.category}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Language</dt>
                <dd className="text-foreground">{podcast.language?.toUpperCase()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Episodes</dt>
                <dd className="text-foreground">{episodes.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Creator View                                                               */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function CreatorPodcastDetail({
  podcast,
  episodes,
  podcastId,
}: {
  podcast: ZongaPodcast
  episodes: ZongaEpisode[]
  podcastId: string
}) {
  const statusColors: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="../podcasts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
      >
        ← All Podcasts
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 shrink-0 rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden relative">
          {podcast.coverUrl ? (
            <Image src={podcast.coverUrl} alt="" fill className="object-cover" unoptimized />
          ) : (
            <Podcast size={32} className="text-muted-foreground/40" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{podcast.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusColors[podcast.status] ?? statusColors.draft
            }`}>
              {podcast.status}
            </span>
            <span className="text-sm text-muted-foreground">
              {podcast.episodeCount} episode{podcast.episodeCount !== 1 ? 's' : ''}
              {podcast.category ? ` · ${podcast.category}` : ''}
              {podcast.language ? ` · ${podcast.language.toUpperCase()}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Total Episodes</p>
            <p className="text-2xl font-bold text-foreground">{episodes.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Published</p>
            <p className="text-2xl font-bold text-emerald-600">
              {episodes.filter((e) => e.status === 'published').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold text-amber-600">
              {episodes.filter((e) => e.status === 'draft').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-lg font-bold text-foreground capitalize">{podcast.status}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main — Episode List */}
        <div className="space-y-6 lg:col-span-2">
          {podcast.description && (
            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">📋 Description</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{podcast.description}</p>
              </div>
            </Card>
          )}

          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  🎙️ Episodes ({episodes.length})
                </h2>
                <Link
                  href={`${podcastId}/new-episode`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 transition"
                >
                  + Add Episode
                </Link>
              </div>

              {episodes.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No episodes yet. Add your first episode above.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="pb-2">#</th>
                        <th className="pb-2">Title</th>
                        <th className="pb-2">Duration</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Published</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {episodes.map((ep) => (
                        <tr key={ep.id}>
                          <td className="py-2 text-muted-foreground font-mono text-xs">
                            {ep.seasonNumber && ep.seasonNumber > 1 ? `S${ep.seasonNumber}·` : ''}
                            {ep.episodeNumber ?? '—'}
                          </td>
                          <td className="py-2">
                            <p className="font-medium text-foreground">{ep.title}</p>
                            {ep.description && (
                              <p className="text-xs text-muted-foreground/70 line-clamp-1">{ep.description}</p>
                            )}
                          </td>
                          <td className="py-2 text-muted-foreground text-xs">
                            {formatDuration(ep.durationSecs) || '—'}
                          </td>
                          <td className="py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              ep.status === 'published' ? 'bg-emerald-500/10 text-emerald-600'
                              : ep.status === 'archived' ? 'bg-muted text-muted-foreground'
                              : 'bg-amber-500/10 text-amber-600'
                            }`}>
                              {ep.status}
                            </span>
                          </td>
                          <td className="py-2 text-muted-foreground/70 text-xs">
                            {ep.publishedAt
                              ? new Date(ep.publishedAt).toLocaleDateString('en-CA')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">📋 Show Info</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Language</dt>
                  <dd className="text-foreground font-medium">{podcast.language?.toUpperCase()}</dd>
                </div>
                {podcast.category && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd className="text-foreground">{podcast.category}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Explicit</dt>
                  <dd className="text-foreground">{podcast.explicit ? 'Yes' : 'No'}</dd>
                </div>
                {podcast.rssFeedUrl && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">RSS Feed</dt>
                    <dd className="text-foreground truncate max-w-35">
                      <a
                        href={podcast.rssFeedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-500 hover:underline"
                      >
                        View feed
                      </a>
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Show ID</dt>
                  <dd className="font-mono text-xs text-foreground">{podcastId.slice(0, 12)}…</dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
