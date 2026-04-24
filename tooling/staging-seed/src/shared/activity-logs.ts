import type { SeedRng, SeedTime } from '../core/types'
import type { SyntheticUser } from './users'

const ACTIONS = [
  'login', 'logout', 'create', 'update', 'delete', 'export', 'invite',
  'approve', 'reject', 'comment', 'assign', 'view',
] as const

const RESOURCES = [
  'case', 'invoice', 'member', 'campaign', 'event', 'order', 'quote',
  'policy', 'document', 'dashboard',
] as const

export interface SyntheticActivityLog {
  readonly id: string
  readonly userId: string
  readonly orgId: string
  readonly action: string
  readonly resource: string
  readonly resourceId: string
  readonly at: string
}

export interface FakeActivityLogsArgs {
  readonly rng: SeedRng
  readonly time: SeedTime
  readonly users: readonly SyntheticUser[]
  readonly count: number
}

export function fakeActivityLogs(args: FakeActivityLogsArgs): SyntheticActivityLog[] {
  const { rng, time, users, count } = args
  if (users.length === 0) {
    throw new Error('fakeActivityLogs: at least one user is required')
  }
  const out: SyntheticActivityLog[] = []
  const window = time.historyWindow()
  const horizonDays = Math.max(
    1,
    Math.floor((window.end.getTime() - window.start.getTime()) / 86_400_000),
  )

  for (let i = 0; i < count; i++) {
    const user = users[i % users.length]!
    const ageDays = rng.intBetween(0, horizonDays)
    out.push({
      id: rng.id('activity'),
      userId: user.id,
      orgId: user.orgId,
      action: rng.pick(ACTIONS),
      resource: rng.pick(RESOURCES),
      resourceId: rng.id('res'),
      at: time.daysAgo(ageDays).toISOString(),
    })
  }
  return out
}
