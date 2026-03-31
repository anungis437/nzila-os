/**
 * Zonga — My Music / Listener Library (Server Component).
 *
 * Personal library view: now-playing, queue, saved playlists,
 * followed artists, listening history, and account status.
 * Discovery content (trending, new releases, AI recs) lives on the home page.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Headphones,
  Heart,
  ListMusic,
  Users,
  Clock,
  Music,
  Zap,
  Radio,
  Crown,
  Download,
  Library,
  Mic2,
  ArrowRight,
} from 'lucide-react'
import {
  getListenerProfile,
  getListenerFeed,
  listSavedPlaylists,
} from '@/lib/actions/listener-actions'
import { listFollowing } from '@/lib/actions/social-actions'
import { getListenerSubscription } from '@/lib/actions/subscription-actions'
import { browsePublicPlaylists } from '@/lib/actions/browse-actions'
import { NowPlayingWidget, QueueView } from '@/components/dashboard/listener-sections'
import { PlanBadge } from '@/components/dashboard/plan-badge'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

export default async function ListenerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { locale } = await params

  const user = await currentUser()
  const meta = user?.publicMetadata as { listenerPlan?: string; zongaRole?: string } | undefined
  const clerkPlan = meta?.listenerPlan ?? 'free'

  const [profile, feed, following, savedPlaylists] = await Promise.all([
    getListenerProfile(),
    getListenerFeed({ limit: 30 }),
    listFollowing(),
    listSavedPlaylists(),
  ])

  const [listenerSub, publicPlaylists, creatorRows] = await Promise.all([
    getListenerSubscription(),
    browsePublicPlaylists(),
    platformDb.execute(
      sql`SELECT id, status FROM zonga_creators WHERE user_id = ${userId} LIMIT 1`,
    ).then((r) => r as unknown as { id: string; status: string }[]).catch(() => []),
  ])

  const playlists = publicPlaylists.playlists

  // DB subscription takes precedence when available; otherwise fall back to Clerk metadata
  const listenerPlan = listenerSub?.plan ?? clerkPlan
  const isPremium =
    listenerPlan === 'premium' &&
    (listenerSub?.subscriptionStatus === 'active' ||
     listenerSub?.subscriptionStatus === 'trialing' ||
     !listenerSub)

  const creatorProfile = creatorRows[0] ?? null
  const hasApplied = !!creatorProfile
  const creatorStatus = creatorProfile?.status ?? null

  const p = `/${locale}/dashboard`
  const displayName = profile?.displayName ?? user?.firstName ?? undefined

  // Split activity by type for focused sections
  const streamHistory = feed.filter((a) => a.activityType === 'stream')
  const socialActivity = feed.filter((a) => a.activityType !== 'stream')

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Library size={24} className="text-electric" />
            <h1 className="text-2xl font-bold text-foreground">My Library</h1>
            <PlanBadge plan={listenerPlan} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {displayName ? `${displayName}'s` : 'Your'} collection, playlists, and listening history
          </p>
        </div>
        {!isPremium && (
          <Link
            href={`${p}/subscription`}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-amber-500/10 transition-all self-start"
          >
            <Crown size={16} className="text-amber-500" />
            <span>Upgrade</span>
          </Link>
        )}
      </div>

      {/* ── Library Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric/10">
            <Users size={18} className="text-electric" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Following</p>
            <p className="text-xl font-bold text-foreground">{profile?.followingCount ?? following.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10">
            <Heart size={18} className="text-rose-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Favorites</p>
            <p className="text-xl font-bold text-foreground">{profile?.favoritesCount ?? 0}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <ListMusic size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Playlists</p>
            <p className="text-xl font-bold text-foreground">{playlists.length + savedPlaylists.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <Headphones size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Streams</p>
            <p className="text-xl font-bold text-foreground">{streamHistory.length}</p>
          </div>
        </div>
      </div>

      {/* ── Now Playing + Queue ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NowPlayingWidget />
        <QueueView />
      </div>

      {/* ── Playlists ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListMusic size={18} className="text-purple-500" />
            <h2 className="text-lg font-semibold text-foreground">Playlists</h2>
          </div>
          <Link href={`${p}/playlists`} className="text-xs text-electric hover:underline">
            View all →
          </Link>
        </div>
        {playlists.length === 0 && savedPlaylists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-10 text-center">
            <ListMusic size={32} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No playlists yet</p>
            <Link
              href={`${p}/playlists`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-electric hover:underline"
            >
              Browse playlists →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {playlists.map((pl) => (
              <Link key={pl.id} href={`${p}/playlists/${pl.id}`}>
                <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-linear-to-br from-purple-500/10 to-indigo-500/10 shrink-0">
                      <ListMusic size={18} className="text-purple-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{pl.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pl.creatorName ?? 'You'} · {pl.trackCount} track{pl.trackCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {pl.visibility === 'public' && (
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                        Public
                      </span>
                    )}
                  </div>
                  {pl.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{pl.description}</p>
                  )}
                </div>
              </Link>
            ))}
            {savedPlaylists.map((pl) => (
              <Link key={pl.id} href={`${p}/playlists`}>
                <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-linear-to-br from-electric/10 to-electric/20 shrink-0">
                      <Heart size={18} className="text-electric" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{pl.playlistTitle ?? 'Untitled'}</p>
                      {pl.playlistDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{pl.playlistDescription}</p>
                      )}
                    </div>
                    <span className="inline-flex rounded-full bg-electric/10 px-2 py-0.5 text-[10px] font-medium text-electric">
                      Saved
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Artists You Follow ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-rose-500" />
            <h2 className="text-lg font-semibold text-foreground">Artists You Follow</h2>
          </div>
          <Link href={`${p}/browse`} className="text-xs text-electric hover:underline">
            Discover more →
          </Link>
        </div>
        {following.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-10 text-center">
            <Users size={32} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">You haven&apos;t followed any artists yet</p>
            <Link
              href={`${p}/browse`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-electric hover:underline"
            >
              Find artists →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {following.slice(0, 12).map((f) => (
              <div
                key={f.id}
                className="group rounded-xl border border-border bg-card p-4 text-center transition-all hover:shadow-lg hover:shadow-electric/5"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-rose-500/10 to-rose-500/20 group-hover:from-rose-500/20 group-hover:to-rose-500/30 transition-colors">
                  <Music size={20} className="text-rose-500" />
                </div>
                <p className="text-sm font-medium text-foreground truncate">{f.creatorName ?? 'Artist'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Listening History ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-electric" />
          <h2 className="text-lg font-semibold text-foreground">Listening History</h2>
        </div>
        {streamHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-10 text-center">
            <Headphones size={32} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No listening history yet</p>
            <Link
              href={`${p}/browse`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-electric hover:underline"
            >
              Start listening →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {streamHistory.slice(0, 15).map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-electric/10 shrink-0">
                    <Headphones size={14} className="text-electric" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground capitalize">{a.entityType}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.createdAt ? new Date(a.createdAt).toLocaleString() : 'just now'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Social Activity ── */}
      {socialActivity.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Radio size={18} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-foreground">Social Activity</h2>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {socialActivity.slice(0, 10).map((a) => {
                const iconMap: Record<string, React.ReactNode> = {
                  follow: <Users size={14} className="text-electric" />,
                  favorite: <Heart size={14} className="text-rose-500" />,
                  comment: <Radio size={14} className="text-indigo-500" />,
                  tip: <Zap size={14} className="text-amber-500" />,
                }
                return (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                      {iconMap[a.activityType] ?? <Music size={14} className="text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground capitalize">{a.activityType}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.entityType} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : 'just now'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Premium Features ── */}
      {isPremium && (
        <div className="rounded-xl border border-electric/20 bg-linear-to-r from-electric/5 to-transparent p-5">
          <div className="flex items-center gap-3 mb-3">
            <Crown size={18} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Premium Features</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Download size={14} className="text-electric shrink-0" />
              <span>Offline downloads</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Headphones size={14} className="text-electric shrink-0" />
              <span>Hi-Fi lossless audio</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Zap size={14} className="text-electric shrink-0" />
              <span>Exclusive releases</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Become a Creator CTA ── */}
      {!hasApplied && (
        <div className="rounded-2xl border border-electric/20 bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-electric/10 shrink-0">
              <Mic2 size={28} className="text-electric" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-foreground mb-1">Ready to share your music?</h3>
              <p className="text-sm text-muted-foreground">
                Apply as a creator to distribute your tracks, earn royalties via mobile money,
                and reach listeners across the continent.
              </p>
            </div>
            <Link
              href={`${p}/creators/apply`}
              className="inline-flex items-center gap-2 rounded-xl bg-electric px-5 py-3 text-sm font-semibold text-white hover:bg-electric/90 transition-colors shrink-0 self-start"
            >
              Become a Creator
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {/* ── Application status ── */}
      {hasApplied && creatorStatus === 'applied' && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 shrink-0">
              <Mic2 size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Creator application under review</p>
              <p className="text-xs text-muted-foreground">
                We&apos;re reviewing your application. You&apos;ll be notified once approved.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
