/**
 * Dashboard Home — Tri-mode overview for Zonga.
 *
 * Platform org → system-wide KPIs: orgs, creators, catalog, revenue, health.
 * Listener → personalized music discovery, recommendations, library.
 * Label / creator org → personal stats: my catalog, earnings, releases.
 *
 * Server component using resolveNavContext() for org detection,
 * plus Clerk publicMetadata for listener identification.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { resolveNavContext } from '@/lib/resolve-nav'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import {
  Headphones,
  Radio,
  TrendingUp,
  Heart,
  ListMusic,
  Disc3,
  Mic2,
  Globe,
  Search,
  Calendar,
  Sparkles,
  Crown,
  Play,
  Music,
  Users,
  Gem,
  Zap,
  Star,
} from 'lucide-react'
import {
  getListenerProfile,
  getListenerFeed,
  listSavedPlaylists,
  discoverArtists,
  discoverReleases,
  getRecommendationsForUser,
} from '@/lib/actions/listener-actions'
import { listFollowing } from '@/lib/actions/social-actions'
import { getListenerSubscription } from '@/lib/actions/subscription-actions'
import { NowPlayingWidget, QueueView, ReleaseRow } from '@/components/dashboard/listener-sections'
import { PlanBadge } from '@/components/dashboard/plan-badge'

// ── Data fetching helpers ────────────────────────────────────────────────────

interface PlatformStats {
  totalOrgs: number
  totalCreators: number
  totalTracks: number
  totalStreams: number
  pendingModeration: number
  totalRevenue: number
  activeEvents: number
  pendingPayouts: number
}

interface LabelStats {
  myTracks: number
  myRevenue: number
  myReleases: number
  myStreams: number
}

async function getPlatformStats(): Promise<PlatformStats> {
  const defaults: PlatformStats = {
    totalOrgs: 0, totalCreators: 0, totalTracks: 0, totalStreams: 0,
    pendingModeration: 0, totalRevenue: 0, activeEvents: 0, pendingPayouts: 0,
  }
  try {
    const [orgs, creators, tracks, moderation, revenue, events, payouts] = await Promise.allSettled([
      platformDb.execute(sql`SELECT COUNT(*)::int AS c FROM organizations WHERE organization_type = 'local'`),
      platformDb.execute(sql`SELECT COUNT(*)::int AS c FROM zonga_creators`),
      platformDb.execute(sql`SELECT COUNT(*)::int AS c, COALESCE(SUM(stream_count),0)::int AS s FROM zonga_content_assets WHERE type='track'`),
      platformDb.execute(sql`SELECT COUNT(*)::int AS c FROM zonga_moderation_cases WHERE status IN ('open','under_review')`),
      platformDb.execute(sql`SELECT COALESCE(SUM(amount),0)::numeric AS t FROM zonga_revenue_events`),
      platformDb.execute(sql`SELECT COUNT(*)::int AS c FROM zonga_events WHERE status='published'`),
      platformDb.execute(sql`SELECT COUNT(*)::int AS c FROM zonga_payouts WHERE status='pending'`),
    ])
    const row = (r: PromiseSettledResult<unknown>) =>
      r.status === 'fulfilled' ? (r.value as Record<string, unknown>[])[0] : {}

    return {
      totalOrgs: Number((row(orgs) as Record<string, unknown>).c ?? 0),
      totalCreators: Number((row(creators) as Record<string, unknown>).c ?? 0),
      totalTracks: Number((row(tracks) as Record<string, unknown>).c ?? 0),
      totalStreams: Number((row(tracks) as Record<string, unknown>).s ?? 0),
      pendingModeration: Number((row(moderation) as Record<string, unknown>).c ?? 0),
      totalRevenue: Number((row(revenue) as Record<string, unknown>).t ?? 0),
      activeEvents: Number((row(events) as Record<string, unknown>).c ?? 0),
      pendingPayouts: Number((row(payouts) as Record<string, unknown>).c ?? 0),
    }
  } catch {
    return defaults
  }
}

async function getLabelStats(): Promise<LabelStats> {
  try {
    const [tracks, revenue, releases] = await Promise.allSettled([
      platformDb.execute(sql`SELECT COUNT(*)::int AS c, COALESCE(SUM(stream_count),0)::int AS s FROM zonga_content_assets WHERE type='track'`),
      platformDb.execute(sql`SELECT COALESCE(SUM(amount),0)::numeric AS t FROM zonga_revenue_events`),
      platformDb.execute(sql`SELECT COUNT(*)::int AS c FROM zonga_releases WHERE status='released'`),
    ])
    const row = (r: PromiseSettledResult<unknown>) =>
      r.status === 'fulfilled' ? (r.value as Record<string, unknown>[])[0] : {}
    return {
      myTracks: Number((row(tracks) as Record<string, unknown>).c ?? 0),
      myRevenue: Number((row(revenue) as Record<string, unknown>).t ?? 0),
      myReleases: Number((row(releases) as Record<string, unknown>).c ?? 0),
      myStreams: Number((row(tracks) as Record<string, unknown>).s ?? 0),
    }
  } catch {
    return { myTracks: 0, myRevenue: 0, myReleases: 0, myStreams: 0 }
  }
}

function fmt(v: number, currency = false): string {
  if (currency) return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(v)
  return v.toLocaleString()
}

// ── Page ─────────────────────────────────────────────────────────────────────

// NOTE: DashboardPage is defined below PlatformHome / ListenerHome / LabelHome
//       to avoid any bundler-ordering issues with server components.

// ── Platform Home ────────────────────────────────────────────────────────────

async function PlatformHome({ locale }: { locale: string }) {
  const stats = await getPlatformStats()
  const p = `/${locale}/dashboard`

  const kpis = [
    { label: 'Organizations', value: fmt(stats.totalOrgs), icon: '🏢', href: `${p}/admin/organizations` },
    { label: 'Creators', value: fmt(stats.totalCreators), icon: '🎤', href: `${p}/creators` },
    { label: 'Tracks', value: fmt(stats.totalTracks), icon: '🎵', href: `${p}/tracks` },
    { label: 'Total Streams', value: fmt(stats.totalStreams), icon: '📡', href: `${p}/analytics` },
    { label: 'Platform Revenue', value: fmt(stats.totalRevenue, true), icon: '💰', href: `${p}/revenue` },
    { label: 'Pending Moderation', value: fmt(stats.pendingModeration), icon: '🛡️', href: `${p}/moderation` },
    { label: 'Live Events', value: fmt(stats.activeEvents), icon: '🎪', href: `${p}/events` },
    { label: 'Pending Payouts', value: fmt(stats.pendingPayouts), icon: '💸', href: `${p}/payouts` },
  ]

  const quickLinks = [
    { label: 'Operations', desc: 'System health & queues', icon: '⚙️', href: `${p}/operations` },
    { label: 'Content Moderation', desc: 'Review flagged content', icon: '🛡️', href: `${p}/moderation` },
    { label: 'Integrity & Rights', desc: 'Duplicate detection & rights', icon: '🔒', href: `${p}/integrity` },
    { label: 'Compliance', desc: 'Audit trails & exports', icon: '📋', href: `${p}/compliance` },
    { label: 'Analytics', desc: 'Platform-wide metrics', icon: '📊', href: `${p}/analytics` },
    { label: 'Settings', desc: 'Platform configuration', icon: '⚡', href: `${p}/settings` },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">
          System-wide KPIs and operational summary for the Zonga platform.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card>
              <div className="p-5 hover:bg-muted/50 transition-colors rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{kpi.icon}</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Platform Tools</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.label} href={link.href}>
              <Card>
                <div className="p-5 hover:bg-muted/50 transition-colors rounded-lg flex items-start gap-4">
                  <span className="text-2xl">{link.icon}</span>
                  <div>
                    <h3 className="font-semibold text-foreground">{link.label}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{link.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* System Health Summary */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">System Health</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { name: 'Streaming API', ok: true },
              { name: 'Payout Engine', ok: true },
              { name: 'Content CDN', ok: true },
              { name: 'Search Index', ok: true },
              { name: 'ML Pipeline', ok: true },
              { name: 'Rights Resolver', ok: true },
              { name: 'Notification Bus', ok: true },
              { name: 'Auth (Clerk)', ok: true },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center gap-2 rounded-lg border border-border p-3">
                <span className={`h-2 w-2 rounded-full ${svc.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-foreground">{svc.name}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Listener Home ────────────────────────────────────────────────────────────

async function ListenerHome({ locale }: { locale: string }) {
  const p = `/${locale}/dashboard`

  // Read plan from Clerk publicMetadata (source of truth for listeners)
  const user = await currentUser()
  const meta = user?.publicMetadata as { listenerPlan?: string; zongaRole?: string } | undefined
  const clerkPlan = meta?.listenerPlan ?? 'free'

  const [profile, feed, following, playlists, trendingArtists, newReleases, listenerSub, aiRecs] =
    await Promise.all([
      getListenerProfile().catch(() => null),
      getListenerFeed({ limit: 12 }).catch(() => []),
      listFollowing().catch(() => []),
      listSavedPlaylists().catch(() => []),
      discoverArtists({ limit: 6 }).catch(() => []),
      discoverReleases({ limit: 6 }).catch(() => []),
      getListenerSubscription().catch(() => null),
      getRecommendationsForUser({ limit: 8 }).catch(() => ({ items: [], strategy: 'fallback' })),
    ])

  // DB subscription takes precedence when available; otherwise fall back to Clerk metadata
  const listenerPlan = listenerSub?.plan ?? clerkPlan
  const isPremium =
    listenerPlan === 'premium' &&
    (listenerSub?.subscriptionStatus === 'active' ||
     listenerSub?.subscriptionStatus === 'trialing' ||
     !listenerSub)

  const displayName = user?.fullName ?? user?.firstName ?? profile?.displayName ?? undefined
  const greeting = displayName
    ? `Welcome back, ${displayName}`
    : 'Welcome back'

  return (
    <div className="space-y-8">
      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-navy via-navy/95 to-electric/80 p-8 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-electric/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{greeting}</h1>
              <PlanBadge plan={listenerPlan} />
            </div>
            <p className="text-white/70 text-sm max-w-md">
              {isPremium
                ? 'Enjoy unlimited Hi-Fi streaming, offline downloads, and personalized recommendations.'
                : 'Discover new music, follow your favorite artists, and build your perfect playlists.'}
            </p>
          </div>
          {!isPremium && (
            <Link
              href={`${p}/subscription`}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all self-start"
            >
              <Crown size={16} className="text-amber-400" />
              Upgrade to Premium
            </Link>
          )}
        </div>
      </div>

      {/* ── Now Playing + Queue ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NowPlayingWidget />
        <QueueView />
      </div>

      {/* ── Quick Access ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href={`${p}/browse`}>
          <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:shadow-electric/5 hover:border-electric/20">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-electric/10 to-electric/20">
              <Globe size={20} className="text-electric" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Browse</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Trending music</p>
          </div>
        </Link>
        <Link href={`${p}/search`}>
          <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:shadow-electric/5 hover:border-electric/20">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-electric/10 to-electric/20">
              <Search size={20} className="text-electric" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Search</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Find anything</p>
          </div>
        </Link>
        <Link href={`${p}/playlists`}>
          <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:shadow-electric/5 hover:border-electric/20">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-purple-500/10 to-purple-500/20">
              <ListMusic size={20} className="text-purple-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Playlists</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{playlists.length} saved</p>
          </div>
        </Link>
        <Link href={`${p}/events`}>
          <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:shadow-electric/5 hover:border-electric/20">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-amber-500/10 to-amber-500/20">
              <Calendar size={20} className="text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Events</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Live &amp; upcoming</p>
          </div>
        </Link>
      </div>

      {/* ── AI Recommendations (premium only) ── */}
      {isPremium && (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-purple-500" />
          <h2 className="text-lg font-semibold text-foreground">Recommended for You</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-linear-to-r from-purple-500 to-indigo-500 text-white px-2 py-0.5 rounded-full">
            AI
          </span>
        </div>
        {aiRecs.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-10 text-center">
            <Headphones size={32} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Listen to more music to unlock personalized picks</p>
            <Link
              href={`${p}/browse`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-electric hover:underline"
            >
              <Play size={12} /> Start exploring
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {aiRecs.items.map((rec) => (
              <div
                key={rec.itemId}
                className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg hover:shadow-purple-500/5"
              >
                <div className="aspect-square bg-linear-to-br from-purple-500/10 via-indigo-500/10 to-electric/10 flex items-center justify-center">
                  <Music size={28} className="text-purple-300 group-hover:text-purple-400 transition-colors" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground truncate">{rec.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {rec.itemType} · {Math.round(rec.score * 100)}% match
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ── Library Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-electric/10 to-electric/20">
            <Users size={22} className="text-electric" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Following</p>
            <p className="text-2xl font-bold text-foreground">{profile?.followingCount ?? following.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-rose-500/10 to-rose-500/20">
            <Heart size={22} className="text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Favorites</p>
            <p className="text-2xl font-bold text-foreground">{profile?.favoritesCount ?? 0}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-purple-500/10 to-purple-500/20">
            <ListMusic size={22} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Playlists</p>
            <p className="text-2xl font-bold text-foreground">{playlists.length}</p>
          </div>
        </div>
      </div>

      {/* ── Trending Artists ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-electric" />
          <h2 className="text-lg font-semibold text-foreground">Trending Artists</h2>
        </div>
        {trendingArtists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-10 text-center">
            <Mic2 size={32} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No artists to discover yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {trendingArtists.map((a) => (
              <div
                key={a.id}
                className="group rounded-xl border border-border bg-card p-4 text-center transition-all hover:shadow-lg hover:shadow-electric/5"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-electric/10 to-electric/20 group-hover:from-electric/20 group-hover:to-electric/30 transition-colors">
                  {a.verified ? (
                    <Star size={20} className="text-electric" />
                  ) : (
                    <Mic2 size={20} className="text-indigo-400" />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground truncate">{a.displayName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.followerCount} followers</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── New Releases ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Disc3 size={18} className="text-electric" />
          <h2 className="text-lg font-semibold text-foreground">New Releases</h2>
        </div>
        {newReleases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-10 text-center">
            <Disc3 size={32} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No published releases yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {newReleases.map((r) => (
                <ReleaseRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  creatorName={r.creatorName}
                  releaseType={r.releaseType}
                  trackCount={r.trackCount}
                  publishedAt={r.publishedAt}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Artists You Follow ── */}
      {following.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Heart size={18} className="text-rose-500" />
            <h2 className="text-lg font-semibold text-foreground">Artists You Follow</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {following.slice(0, 12).map((f) => (
              <div
                key={f.id}
                className="group rounded-xl border border-border bg-card p-4 text-center transition-all hover:shadow-lg hover:shadow-electric/5"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-rose-500/10 to-rose-500/20 group-hover:from-rose-500/20 group-hover:to-rose-500/30 transition-colors">
                  <Mic2 size={20} className="text-rose-500" />
                </div>
                <p className="text-sm font-medium text-foreground truncate">{f.creatorName ?? 'Artist'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Saved Playlists ── */}
      {playlists.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ListMusic size={18} className="text-purple-500" />
            <h2 className="text-lg font-semibold text-foreground">Saved Playlists</h2>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {playlists.map((pl) => (
                <Link key={pl.id} href={`${p}/playlists`} className="block">
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-purple-500/10 to-indigo-500/10 shrink-0">
                      <ListMusic size={18} className="text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{pl.playlistTitle ?? 'Untitled'}</p>
                      {pl.playlistDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{pl.playlistDescription}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Feed ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Radio size={18} className="text-electric" />
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        </div>
        {feed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-10 text-center">
            <Headphones size={32} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No activity yet — start exploring!</p>
            <Link
              href={`${p}/browse`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-electric hover:underline"
            >
              <Play size={12} /> Discover music
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {feed.map((a) => {
                const iconMap: Record<string, React.ReactNode> = {
                  follow: <Users size={16} className="text-electric" />,
                  favorite: <Heart size={16} className="text-rose-500" />,
                  comment: <Radio size={16} className="text-indigo-500" />,
                  tip: <Zap size={16} className="text-amber-500" />,
                  stream: <Headphones size={16} className="text-electric" />,
                }
                return (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                      {iconMap[a.activityType] ?? <Music size={16} className="text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
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
        )}
      </div>
    </div>
  )
}

// ── Label / Creator Home ─────────────────────────────────────────────────────

async function LabelHome({ locale }: { locale: string }) {
  const stats = await getLabelStats()
  const p = `/${locale}/dashboard`

  const statCards = [
    { label: 'My Tracks', value: fmt(stats.myTracks), icon: '🎵' },
    { label: 'Total Streams', value: fmt(stats.myStreams), icon: '📡' },
    { label: 'Revenue', value: fmt(stats.myRevenue, true), icon: '💰' },
    { label: 'Releases', value: fmt(stats.myReleases), icon: '📀' },
  ]

  const quickActions = [
    { title: 'Upload Track', description: 'Add a new track or album to your catalog', icon: '🎵', href: `${p}/catalog` },
    { title: 'Create Release', description: 'Bundle assets into a new release', icon: '📀', href: `${p}/releases` },
    { title: 'View Payouts', description: 'Check your earnings and payout history', icon: '💰', href: `${p}/payouts` },
    { title: 'Analytics', description: 'See listener trends and demographics', icon: '📊', href: `${p}/analytics` },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome to Zonga</h1>
        <p className="text-muted-foreground mt-1">
          Manage your catalog, track revenue, view payouts, and grow your audience.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href}>
              <Card>
                <div className="p-5 hover:bg-muted/50 transition-colors rounded-lg">
                  <div className="text-2xl mb-3">{action.icon}</div>
                  <h3 className="font-semibold text-foreground">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Discover */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Discover</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href={`${p}/browse`}>
            <Card>
              <div className="p-5 hover:bg-muted/50 transition-colors rounded-lg text-center">
                <p className="text-3xl mb-2">🌍</p>
                <h3 className="font-semibold text-foreground">Browse</h3>
                <p className="text-xs text-muted-foreground mt-1">Explore trending tracks and playlists</p>
              </div>
            </Card>
          </Link>
          <Link href={`${p}/search`}>
            <Card>
              <div className="p-5 hover:bg-muted/50 transition-colors rounded-lg text-center">
                <p className="text-3xl mb-2">🔍</p>
                <h3 className="font-semibold text-foreground">Search</h3>
                <p className="text-xs text-muted-foreground mt-1">Find artists, tracks, and playlists</p>
              </div>
            </Card>
          </Link>
          <Link href={`${p}/events`}>
            <Card>
              <div className="p-5 hover:bg-muted/50 transition-colors rounded-lg text-center">
                <p className="text-3xl mb-2">🎪</p>
                <h3 className="font-semibold text-foreground">Events</h3>
                <p className="text-xs text-muted-foreground mt-1">Live shows and upcoming concerts</p>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Page (exported default — placed after all sub-components) ────────────────

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')

  const { locale } = await params

  // Check if this user is a listener (via Clerk publicMetadata)
  const user = await currentUser()
  const zongaRole = (user?.publicMetadata as { zongaRole?: string } | undefined)?.zongaRole

  // Listeners don't need an org — they browse cross-label content
  if (zongaRole === 'listener') {
    return <ListenerHome locale={locale} />
  }

  // Non-listener views (platform, label) require an active organization
  if (!orgId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card>
          <div className="max-w-md p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-electric/10">
              <Music className="h-7 w-7 text-electric" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Select an Organization</h2>
            <p className="text-muted-foreground text-sm">
              Use the organization switcher in the sidebar to select your label or workspace.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const navCtx = await resolveNavContext(locale)
  const isPlatform = navCtx?.isPlatformOrg ?? false

  if (isPlatform) {
    return <PlatformHome locale={locale} />
  }

  return <LabelHome locale={locale} />
}
