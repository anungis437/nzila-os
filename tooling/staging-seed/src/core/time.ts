import type { ProfileTargets, SeedTime } from './types'

const MS_PER_DAY = 86_400_000

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Build a {@link SeedTime} pinned to `now`. Pinning enables deterministic
 * back-dated/future date generation across runs (tests can pass a fixed
 * `now`; the CLI passes `new Date()`).
 */
export function createTime(targets: ProfileTargets, now: Date = new Date()): SeedTime {
  const todayUtc = startOfUtcDay(now)

  const today = (): Date => new Date(todayUtc.getTime())

  const daysAgo = (days: number): Date => {
    if (!Number.isFinite(days) || days < 0) {
      throw new Error(`daysAgo: days must be a non-negative finite number, got ${days}`)
    }
    return new Date(todayUtc.getTime() - days * MS_PER_DAY)
  }

  const daysAhead = (days: number): Date => {
    if (!Number.isFinite(days) || days < 0) {
      throw new Error(`daysAhead: days must be a non-negative finite number, got ${days}`)
    }
    return new Date(todayUtc.getTime() + days * MS_PER_DAY)
  }

  const historyWindow = (): { start: Date; end: Date } => {
    const days = Math.round(targets.historyMonths * 30)
    return { start: daysAgo(days), end: today() }
  }

  const futureWindow = (): { start: Date; end: Date } => {
    return { start: today(), end: daysAhead(targets.futureWindowDays) }
  }

  return { today, daysAgo, daysAhead, historyWindow, futureWindow }
}
