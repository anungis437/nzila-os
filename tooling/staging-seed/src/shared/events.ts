import type { SeedRng, SeedTime } from '../core/types'
import type { SyntheticOrganization } from './organizations'

const KINDS = [
  'meeting', 'webinar', 'concert', 'training', 'town-hall', 'campaign-launch',
] as const

export type EventKind = (typeof KINDS)[number]

export interface SyntheticEvent {
  readonly id: string
  readonly orgId: string
  readonly kind: EventKind
  readonly title: string
  readonly startsAt: string
  readonly endsAt: string
  readonly capacity: number
  readonly registered: number
  readonly status: 'scheduled' | 'completed' | 'cancelled'
}

export interface FakeEventsArgs {
  readonly rng: SeedRng
  readonly time: SeedTime
  readonly organizations: readonly SyntheticOrganization[]
  readonly count: number
}

/**
 * Mix of past + future events so timeline widgets always have content.
 */
export function fakeEvents(args: FakeEventsArgs): SyntheticEvent[] {
  const { rng, time, organizations, count } = args
  if (organizations.length === 0) {
    throw new Error('fakeEvents: at least one organization is required')
  }
  const out: SyntheticEvent[] = []
  const futureWindow = time.futureWindow()
  const futureWindowDays = Math.max(
    1,
    Math.floor((futureWindow.end.getTime() - futureWindow.start.getTime()) / 86_400_000),
  )

  for (let i = 0; i < count; i++) {
    const org = organizations[i % organizations.length]!
    const isFuture = rng.boolean(0.55)
    const startsAt = isFuture
      ? time.daysAhead(rng.intBetween(1, futureWindowDays))
      : time.daysAgo(rng.intBetween(1, 180))
    const endsAt = new Date(startsAt.getTime() + rng.intBetween(1, 6) * 3_600_000)
    const capacity = rng.intBetween(50, 5_000)
    const fillRate = isFuture ? rng.next() * 0.7 : rng.next() * 0.95
    const registered = Math.floor(capacity * fillRate)
    const status: SyntheticEvent['status'] = isFuture
      ? 'scheduled'
      : rng.boolean(0.05)
        ? 'cancelled'
        : 'completed'
    out.push({
      id: rng.id('event'),
      orgId: org.id,
      kind: rng.pick(KINDS),
      title: `${rng.pick(KINDS)} — ${org.name}`,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      capacity,
      registered,
      status,
    })
  }
  return out
}
