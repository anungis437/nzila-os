/**
 * Metrics computation — DAU/MAU, retention cohorts, session metrics,
 * skip/completion rates, listener segmentation.
 *
 * All functions are pure aggregators that operate on pre-fetched data arrays.
 * The query layer fetches from DB; these functions compute the metrics.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface DailyActiveUsers {
  date: string         // YYYY-MM-DD
  uniqueUsers: number
  totalSessions: number
  avgSessionMinutes: number
}

export interface MonthlyActiveUsers {
  month: string        // YYYY-MM
  uniqueUsers: number
  dauToMauRatio: number
  growthPercent: number
}

export interface RetentionCohort {
  cohortDate: string   // YYYY-MM-DD (signup date)
  cohortSize: number
  retainedByDay: number[]  // [day1, day7, day14, day30] counts
  retentionRates: number[]  // Percentages
}

export interface SessionMetrics {
  totalSessions: number
  avgDurationMs: number
  medianDurationMs: number
  p95DurationMs: number
  avgTracksPerSession: number
  bounceRate: number      // Sessions with 0 completed plays
}

export interface ListenerSegment {
  segment: 'new' | 'returning' | 'dormant' | 'churned'
  count: number
  percentage: number
}

// ── DAU Computation ─────────────────────────────────────────────────────────

/**
 * Compute daily active users from session events.
 */
export function computeDAU(
  sessions: { userId: string; startedAt: number; durationMs: number }[]
): DailyActiveUsers[] {
  const byDate = new Map<string, { users: Set<string>; count: number; totalMinutes: number }>()

  for (const session of sessions) {
    const date = new Date(session.startedAt).toISOString().slice(0, 10)
    let bucket = byDate.get(date)
    if (!bucket) {
      bucket = { users: new Set(), count: 0, totalMinutes: 0 }
      byDate.set(date, bucket)
    }
    bucket.users.add(session.userId)
    bucket.count++
    bucket.totalMinutes += session.durationMs / 60_000
  }

  return Array.from(byDate.entries())
    .map(([date, bucket]) => ({
      date,
      uniqueUsers: bucket.users.size,
      totalSessions: bucket.count,
      avgSessionMinutes: bucket.count > 0
        ? Math.round((bucket.totalMinutes / bucket.count) * 100) / 100
        : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ── MAU Computation ─────────────────────────────────────────────────────────

/**
 * Compute monthly active users from DAU data.
 */
export function computeMAU(
  dailyData: DailyActiveUsers[],
  sessions: { userId: string; startedAt: number }[]
): MonthlyActiveUsers[] {
  const byMonth = new Map<string, Set<string>>()
  const dauByMonth = new Map<string, number[]>()

  for (const session of sessions) {
    const month = new Date(session.startedAt).toISOString().slice(0, 7)
    let users = byMonth.get(month)
    if (!users) {
      users = new Set()
      byMonth.set(month, users)
    }
    users.add(session.userId)
  }

  for (const day of dailyData) {
    const month = day.date.slice(0, 7)
    let daus = dauByMonth.get(month)
    if (!daus) {
      daus = []
      dauByMonth.set(month, daus)
    }
    daus.push(day.uniqueUsers)
  }

  const months = Array.from(byMonth.keys()).sort()
  const results: MonthlyActiveUsers[] = []

  for (let i = 0; i < months.length; i++) {
    const month = months[i]!
    const uniqueUsers = byMonth.get(month)!.size
    const daus = dauByMonth.get(month) ?? []
    const avgDau = daus.length > 0 ? daus.reduce((a, b) => a + b, 0) / daus.length : 0
    const dauToMauRatio = uniqueUsers > 0
      ? Math.round((avgDau / uniqueUsers) * 10000) / 10000
      : 0

    const prevMonth = i > 0 ? months[i - 1]! : null
    const prevUsers = prevMonth ? (byMonth.get(prevMonth)?.size ?? 0) : 0
    const growthPercent = prevUsers > 0
      ? Math.round(((uniqueUsers - prevUsers) / prevUsers) * 10000) / 100
      : 0

    results.push({ month, uniqueUsers, dauToMauRatio, growthPercent })
  }

  return results
}

// ── Retention Cohorts ───────────────────────────────────────────────────────

/**
 * Compute retention cohorts.
 * Groups users by signup date and checks how many return on day 1, 7, 14, 30.
 */
export function computeRetention(
  signups: { userId: string; signedUpAt: number }[],
  sessions: { userId: string; startedAt: number }[]
): RetentionCohort[] {
  const RETENTION_DAYS = [1, 7, 14, 30]
  const MS_PER_DAY = 86_400_000

  // Group signups by date
  const cohorts = new Map<string, Set<string>>()
  for (const signup of signups) {
    const date = new Date(signup.signedUpAt).toISOString().slice(0, 10)
    let set = cohorts.get(date)
    if (!set) {
      set = new Set()
      cohorts.set(date, set)
    }
    set.add(signup.userId)
  }

  // Index sessions by user
  const sessionsByUser = new Map<string, number[]>()
  for (const session of sessions) {
    let arr = sessionsByUser.get(session.userId)
    if (!arr) {
      arr = []
      sessionsByUser.set(session.userId, arr)
    }
    arr.push(session.startedAt)
  }

  const results: RetentionCohort[] = []

  for (const [cohortDate, userIds] of cohorts) {
    const cohortStart = new Date(cohortDate).getTime()
    const retainedByDay: number[] = []
    const retentionRates: number[] = []

    for (const dayN of RETENTION_DAYS) {
      const windowStart = cohortStart + dayN * MS_PER_DAY
      const windowEnd = windowStart + MS_PER_DAY

      let retained = 0
      for (const userId of userIds) {
        const userSessions = sessionsByUser.get(userId) ?? []
        if (userSessions.some((ts) => ts >= windowStart && ts < windowEnd)) {
          retained++
        }
      }

      retainedByDay.push(retained)
      retentionRates.push(
        userIds.size > 0
          ? Math.round((retained / userIds.size) * 10000) / 100
          : 0
      )
    }

    results.push({
      cohortDate,
      cohortSize: userIds.size,
      retainedByDay,
      retentionRates,
    })
  }

  return results.sort((a, b) => a.cohortDate.localeCompare(b.cohortDate))
}

// ── Session Metrics ─────────────────────────────────────────────────────────

/**
 * Compute aggregate session-level metrics.
 */
export function computeSessionMetrics(
  sessions: { durationMs: number; tracksPlayed: number; completedPlays: number }[]
): SessionMetrics {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      avgDurationMs: 0,
      medianDurationMs: 0,
      p95DurationMs: 0,
      avgTracksPerSession: 0,
      bounceRate: 0,
    }
  }

  const durations = sessions.map((s) => s.durationMs).sort((a, b) => a - b)
  const totalDuration = durations.reduce((a, b) => a + b, 0)
  const totalTracks = sessions.reduce((a, s) => a + s.tracksPlayed, 0)
  const bounces = sessions.filter((s) => s.completedPlays === 0).length

  const medianIdx = Math.floor(durations.length / 2)
  const p95Idx = Math.floor(durations.length * 0.95)

  return {
    totalSessions: sessions.length,
    avgDurationMs: Math.round(totalDuration / sessions.length),
    medianDurationMs: durations[medianIdx]!,
    p95DurationMs: durations[Math.min(p95Idx, durations.length - 1)]!,
    avgTracksPerSession: Math.round((totalTracks / sessions.length) * 100) / 100,
    bounceRate: Math.round((bounces / sessions.length) * 10000) / 100,
  }
}

// ── Skip & Completion Rates ─────────────────────────────────────────────────

/**
 * Compute the skip rate: percentage of plays that were skipped before completion.
 */
export function computeSkipRate(
  plays: { isComplete: boolean }[]
): number {
  if (plays.length === 0) return 0
  const skipped = plays.filter((p) => !p.isComplete).length
  return Math.round((skipped / plays.length) * 10000) / 100
}

/**
 * Compute the completion rate: percentage of plays listened to >= threshold.
 */
export function computeCompletionRate(
  plays: { completionPercent: number }[],
  threshold: number = 80
): number {
  if (plays.length === 0) return 0
  const completed = plays.filter((p) => p.completionPercent >= threshold).length
  return Math.round((completed / plays.length) * 10000) / 100
}

// ── Listener Segmentation ───────────────────────────────────────────────────

/**
 * Segment listeners into new / returning / dormant / churned.
 *
 * - new: signed up in last 7 days
 * - returning: active in last 7 days AND signed up > 7 days ago
 * - dormant: last active 7-30 days ago
 * - churned: last active > 30 days ago
 */
export function computeListenerSegments(
  listeners: { userId: string; signedUpAt: number; lastActiveAt: number }[],
  now: number = Date.now()
): ListenerSegment[] {
  const MS_7D = 7 * 86_400_000
  const MS_30D = 30 * 86_400_000

  const counts = { new: 0, returning: 0, dormant: 0, churned: 0 }

  for (const listener of listeners) {
    const daysSinceSignup = now - listener.signedUpAt
    const daysSinceActive = now - listener.lastActiveAt

    if (daysSinceSignup < MS_7D) {
      counts.new++
    } else if (daysSinceActive < MS_7D) {
      counts.returning++
    } else if (daysSinceActive < MS_30D) {
      counts.dormant++
    } else {
      counts.churned++
    }
  }

  const total = listeners.length || 1
  return [
    { segment: 'new', count: counts.new, percentage: Math.round((counts.new / total) * 10000) / 100 },
    { segment: 'returning', count: counts.returning, percentage: Math.round((counts.returning / total) * 10000) / 100 },
    { segment: 'dormant', count: counts.dormant, percentage: Math.round((counts.dormant / total) * 10000) / 100 },
    { segment: 'churned', count: counts.churned, percentage: Math.round((counts.churned / total) * 10000) / 100 },
  ]
}
