/**
 * Dashboard aggregation — creator dashboards, admin dashboards,
 * top tracks / countries / revenue timelines / listener growth.
 *
 * Pure functions that assemble dashboard data from pre-fetched rows.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreatorDashboardData {
  creatorId: string
  period: { from: string; to: string }
  totalStreams: number
  uniqueListeners: number
  totalRevenue: number           // cents
  revenueByCurrency: Record<string, number>
  topTracks: TopTrackEntry[]
  listenerCountries: GeoDistribution[]
  dailyStreams: TimelinePoint[]
  revenueTimeline: TimelinePoint[]
}

export interface AdminDashboardData {
  period: { from: string; to: string }
  dau: number
  mau: number
  dauMauRatio: number
  totalStreams: number
  totalRevenue: number
  activeCreators: number
  newSignups: number
  topTracks: TopTrackEntry[]
  topCountries: GeoDistribution[]
  revenueTimeline: TimelinePoint[]
  listenerGrowth: TimelinePoint[]
}

export interface TopTrackEntry {
  trackId: string
  title: string
  artistName: string
  streams: number
  uniqueListeners: number
  completionRate: number
  revenue: number
}

export interface GeoDistribution {
  countryCode: string
  countryName: string
  listeners: number
  percentage: number
  streams: number
}

export interface TimelinePoint {
  date: string
  value: number
}

// ── Inputs ──────────────────────────────────────────────────────────────────

interface StreamRow {
  trackId: string
  trackTitle: string
  artistName: string
  listenerId: string
  countryCode: string
  countryName: string
  playedAt: number          // epoch ms
  durationMs: number
  trackDurationMs: number
  revenueCents: number
  currency: string
  creatorId: string
}

// ── Creator Dashboard ───────────────────────────────────────────────────────

/**
 * Aggregate a creator's dashboard from stream rows.
 */
export function aggregateCreatorDashboard(
  creatorId: string,
  streams: StreamRow[],
  period: { from: string; to: string }
): CreatorDashboardData {
  const mine = streams.filter((s) => s.creatorId === creatorId)
  const listeners = new Set(mine.map((s) => s.listenerId))

  const revenueByCurrency: Record<string, number> = {}
  let totalRevenue = 0
  for (const s of mine) {
    totalRevenue += s.revenueCents
    revenueByCurrency[s.currency] = (revenueByCurrency[s.currency] ?? 0) + s.revenueCents
  }

  return {
    creatorId,
    period,
    totalStreams: mine.length,
    uniqueListeners: listeners.size,
    totalRevenue,
    revenueByCurrency,
    topTracks: computeTopTracks(mine, 20),
    listenerCountries: computeTopCountries(mine),
    dailyStreams: computeTimeline(mine, (s) => s.playedAt, () => 1),
    revenueTimeline: computeTimeline(mine, (s) => s.playedAt, (s) => s.revenueCents),
  }
}

// ── Admin Dashboard ─────────────────────────────────────────────────────────

/**
 * Aggregate the platform admin dashboard from all stream rows + user data.
 */
export function aggregateAdminDashboard(
  streams: StreamRow[],
  period: { from: string; to: string },
  context: {
    dauCount: number
    mauCount: number
    activeCreatorCount: number
    newSignupCount: number
  }
): AdminDashboardData {
  const totalRevenue = streams.reduce((sum, s) => sum + s.revenueCents, 0)

  return {
    period,
    dau: context.dauCount,
    mau: context.mauCount,
    dauMauRatio: context.mauCount > 0
      ? Math.round((context.dauCount / context.mauCount) * 10000) / 10000
      : 0,
    totalStreams: streams.length,
    totalRevenue,
    activeCreators: context.activeCreatorCount,
    newSignups: context.newSignupCount,
    topTracks: computeTopTracks(streams, 50),
    topCountries: computeTopCountries(streams),
    revenueTimeline: computeTimeline(streams, (s) => s.playedAt, (s) => s.revenueCents),
    listenerGrowth: computeListenerGrowth(streams),
  }
}

// ── Top Tracks ──────────────────────────────────────────────────────────────

/**
 * Compute top tracks by stream count.
 */
export function computeTopTracks(
  streams: StreamRow[],
  limit: number = 20
): TopTrackEntry[] {
  const byTrack = new Map<string, {
    title: string
    artistName: string
    streams: number
    listeners: Set<string>
    revenueSum: number
    completedCount: number
  }>()

  for (const s of streams) {
    let entry = byTrack.get(s.trackId)
    if (!entry) {
      entry = {
        title: s.trackTitle,
        artistName: s.artistName,
        streams: 0,
        listeners: new Set(),
        revenueSum: 0,
        completedCount: 0,
      }
      byTrack.set(s.trackId, entry)
    }

    entry.streams++
    entry.listeners.add(s.listenerId)
    entry.revenueSum += s.revenueCents

    // Count as completed if listened to >= 80% of track
    if (s.trackDurationMs > 0 && s.durationMs / s.trackDurationMs >= 0.8) {
      entry.completedCount++
    }
  }

  return Array.from(byTrack.entries())
    .map(([trackId, e]) => ({
      trackId,
      title: e.title,
      artistName: e.artistName,
      streams: e.streams,
      uniqueListeners: e.listeners.size,
      completionRate: e.streams > 0
        ? Math.round((e.completedCount / e.streams) * 10000) / 100
        : 0,
      revenue: e.revenueSum,
    }))
    .sort((a, b) => b.streams - a.streams)
    .slice(0, limit)
}

// ── Top Countries ───────────────────────────────────────────────────────────

/**
 * Compute geographic distribution of listeners.
 */
export function computeTopCountries(streams: StreamRow[]): GeoDistribution[] {
  const byCountry = new Map<string, {
    name: string
    listeners: Set<string>
    streams: number
  }>()

  for (const s of streams) {
    let entry = byCountry.get(s.countryCode)
    if (!entry) {
      entry = { name: s.countryName, listeners: new Set(), streams: 0 }
      byCountry.set(s.countryCode, entry)
    }
    entry.listeners.add(s.listenerId)
    entry.streams++
  }

  const totalListeners = new Set(streams.map((s) => s.listenerId)).size || 1

  return Array.from(byCountry.entries())
    .map(([countryCode, e]) => ({
      countryCode,
      countryName: e.name,
      listeners: e.listeners.size,
      percentage: Math.round((e.listeners.size / totalListeners) * 10000) / 100,
      streams: e.streams,
    }))
    .sort((a, b) => b.listeners - a.listeners)
}

// ── Revenue Timeline ────────────────────────────────────────────────────────

/**
 * Compute revenue over time (daily granularity).
 */
export function computeRevenueTimeline(streams: StreamRow[]): TimelinePoint[] {
  return computeTimeline(streams, (s) => s.playedAt, (s) => s.revenueCents)
}

// ── Listener Growth ─────────────────────────────────────────────────────────

/**
 * Compute unique listener growth over time.
 */
export function computeListenerGrowth(streams: StreamRow[]): TimelinePoint[] {
  const byDate = new Map<string, Set<string>>()

  for (const s of streams) {
    const date = new Date(s.playedAt).toISOString().slice(0, 10)
    let set = byDate.get(date)
    if (!set) {
      set = new Set()
      byDate.set(date, set)
    }
    set.add(s.listenerId)
  }

  return Array.from(byDate.entries())
    .map(([date, listeners]) => ({ date, value: listeners.size }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ── Internal Helpers ────────────────────────────────────────────────────────

function computeTimeline<T extends { playedAt: number }>(
  rows: T[],
  dateAccessor: (row: T) => number,
  valueAccessor: (row: T) => number
): TimelinePoint[] {
  const byDate = new Map<string, number>()

  for (const row of rows) {
    const date = new Date(dateAccessor(row)).toISOString().slice(0, 10)
    byDate.set(date, (byDate.get(date) ?? 0) + valueAccessor(row))
  }

  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
