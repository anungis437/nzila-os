import type { SeedRng, SeedTime } from '../core/types'
import type { SyntheticUser } from './users'

const KINDS = [
  'mention', 'assignment', 'sla-warning', 'invoice-paid', 'invoice-overdue',
  'event-reminder', 'campaign-update', 'system-alert',
] as const

export type NotificationKind = (typeof KINDS)[number]

export interface SyntheticNotification {
  readonly id: string
  readonly userId: string
  readonly orgId: string
  readonly kind: NotificationKind
  readonly title: string
  readonly read: boolean
  readonly createdAt: string
}

export interface FakeNotificationsArgs {
  readonly rng: SeedRng
  readonly time: SeedTime
  readonly users: readonly SyntheticUser[]
  readonly count: number
}

export function fakeNotifications(args: FakeNotificationsArgs): SyntheticNotification[] {
  const { rng, time, users, count } = args
  if (users.length === 0) {
    throw new Error('fakeNotifications: at least one user is required')
  }
  const out: SyntheticNotification[] = []
  for (let i = 0; i < count; i++) {
    const user = users[i % users.length]!
    const kind = rng.pick(KINDS)
    const ageDays = rng.intBetween(0, 60)
    out.push({
      id: rng.id('notif'),
      userId: user.id,
      orgId: user.orgId,
      kind,
      title: `${kind.replace(/-/g, ' ')} — #${10_000 + i}`,
      read: rng.boolean(0.55),
      createdAt: time.daysAgo(ageDays).toISOString(),
    })
  }
  return out
}
