/**
 * Zonga — Podcasts List Page (Server Component).
 *
 * All users browse published podcasts.
 * Creators also see a "New Podcast" action.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { browsePublishedPodcasts, type ZongaPodcast } from '@/lib/actions/podcast-actions'
import { Podcast, Plus, Mic2 } from 'lucide-react'

export default async function PodcastsPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')

  const isCreator = !!orgId
  const { podcasts, total } = await browsePublishedPodcasts()
  return <PodcastsView podcasts={podcasts} total={total} isCreator={isCreator} />
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Unified Podcasts View                                                      */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function PodcastsView({ podcasts, total, isCreator }: { podcasts: ZongaPodcast[]; total: number; isCreator: boolean }) {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-navy via-navy/95 to-purple-600/70 p-8 sm:p-10 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.12),transparent_50%)]" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Podcast size={28} className="text-purple-300" />
              <h1 className="text-2xl sm:text-3xl font-bold">Podcasts</h1>
            </div>
            <p className="text-sm text-white/60 max-w-lg">
              Discover conversations, stories, and deep dives from creators across the continent.
            </p>
            <p className="mt-3 text-xs text-white/40">{total} show{total !== 1 ? 's' : ''} available</p>
          </div>
          {isCreator && (
            <Link
              href="podcasts/new"
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition shrink-0"
            >
              <Plus size={16} />
              New Podcast
            </Link>
          )}
        </div>
      </div>

      {/* Grid */}
      {podcasts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Podcast size={40} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No podcasts available yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {podcasts.map((podcast) => (
            <Link
              key={podcast.id}
              href={`podcasts/${podcast.id}`}
              className="group rounded-xl border border-border bg-card p-5 transition hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5"
            >
              {/* Cover */}
              <div className="aspect-square w-full rounded-lg bg-muted/50 mb-4 flex items-center justify-center overflow-hidden relative">
                {podcast.coverUrl ? (
                  <Image src={podcast.coverUrl} alt={podcast.title} fill className="object-cover" unoptimized />
                ) : (
                  <Podcast size={48} className="text-muted-foreground/30" />
                )}
              </div>

              <h3 className="font-semibold text-foreground group-hover:text-purple-500 transition line-clamp-1">
                {podcast.title}
              </h3>

              {podcast.creatorName && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Mic2 size={12} className="text-purple-400" />
                  <span className="text-xs text-muted-foreground">{podcast.creatorName}</span>
                </div>
              )}

              {podcast.description && (
                <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2">{podcast.description}</p>
              )}

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {podcast.episodeCount} episode{podcast.episodeCount !== 1 ? 's' : ''}
                </span>
                {podcast.category && (
                  <span className="inline-flex rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                    {podcast.category}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
