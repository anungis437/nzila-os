import type { SeedRng, SeedTime } from '../core/types'
import type { SyntheticOrganization } from './organizations'
import type { SyntheticUser } from './users'

const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'] as const
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const CATEGORIES = [
  'grievance', 'discipline', 'support', 'billing', 'incident', 'request',
] as const

export type TicketStatus = (typeof STATUSES)[number]
export type TicketPriority = (typeof PRIORITIES)[number]

export interface SyntheticTicket {
  readonly id: string
  readonly orgId: string
  readonly assigneeUserId: string | null
  readonly category: string
  readonly status: TicketStatus
  readonly priority: TicketPriority
  readonly title: string
  readonly openedAt: string
  readonly closedAt: string | null
  readonly slaDueAt: string
}

export interface FakeTicketsArgs {
  readonly rng: SeedRng
  readonly time: SeedTime
  readonly organizations: readonly SyntheticOrganization[]
  readonly users: readonly SyntheticUser[]
  readonly count: number
}

export function fakeTickets(args: FakeTicketsArgs): SyntheticTicket[] {
  const { rng, time, organizations, users, count } = args
  if (organizations.length === 0) {
    throw new Error('fakeTickets: at least one organization is required')
  }
  const out: SyntheticTicket[] = []
  for (let i = 0; i < count; i++) {
    const org = organizations[i % organizations.length]!
    const orgUsers = users.filter((u) => u.orgId === org.id)
    const assignee = orgUsers.length > 0 && rng.boolean(0.85) ? rng.pick(orgUsers) : null
    const status = rng.pick(STATUSES)
    const priority = rng.pick(PRIORITIES)
    const ageDays = rng.intBetween(0, 180)
    const openedAt = time.daysAgo(ageDays)
    const slaDueAt = new Date(openedAt.getTime() + (priority === 'urgent' ? 1 : priority === 'high' ? 3 : 7) * 86_400_000)
    const closedAt =
      status === 'resolved' || status === 'closed'
        ? new Date(openedAt.getTime() + rng.intBetween(1, ageDays + 1) * 86_400_000).toISOString()
        : null
    out.push({
      id: rng.id('ticket'),
      orgId: org.id,
      assigneeUserId: assignee?.id ?? null,
      category: rng.pick(CATEGORIES),
      status,
      priority,
      title: `${rng.pick(CATEGORIES)} matter #${10_000 + i}`,
      openedAt: openedAt.toISOString(),
      closedAt,
      slaDueAt: slaDueAt.toISOString(),
    })
  }
  return out
}
