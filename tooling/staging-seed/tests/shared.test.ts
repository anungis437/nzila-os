import { describe, expect, it } from 'vitest'
import { createRng } from '../src/core/rng'
import { createTime } from '../src/core/time'
import { getProfileTargets } from '../src/core/profiles'
import { fakePeople } from '../src/shared/people'
import { fakeOrganizations } from '../src/shared/organizations'
import { fakeUsers } from '../src/shared/users'
import { fakeInvoices } from '../src/shared/invoices'
import { fakeTickets } from '../src/shared/tickets'
import { fakeEvents } from '../src/shared/events'
import { fakeNotifications } from '../src/shared/notifications'
import { fakeActivityLogs } from '../src/shared/activity-logs'

const NOW = new Date('2026-04-23T00:00:00.000Z')

function setup() {
  const rng = createRng(20260423)
  const targets = getProfileTargets('demo-standard')
  const time = createTime(targets, NOW)
  return { rng, time, targets }
}

describe('shared fakers', () => {
  it('people: produces valid emails and stable counts', () => {
    const { rng, time } = setup()
    const out = fakePeople(rng, time, 25)
    expect(out).toHaveLength(25)
    for (const p of out) {
      expect(p.email).toMatch(/^[a-z0-9.]+@nzila-staging\.example\.com$/)
      expect(p.fullName).toBe(`${p.firstName} ${p.lastName}`)
      expect(new Date(p.createdAt).getTime()).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('organizations: assigns tier consistent with memberCount', () => {
    const { rng, time } = setup()
    const orgs = fakeOrganizations(rng, time, 10)
    for (const o of orgs) {
      if (o.tier === 'enterprise') expect(o.memberCount).toBeGreaterThan(5_000)
      if (o.tier === 'starter') expect(o.memberCount).toBeLessThanOrEqual(500)
    }
  })

  it('users: at least one admin per organization', () => {
    const { rng, time } = setup()
    const orgs = fakeOrganizations(rng, time, 4)
    const people = fakePeople(rng, time, 30)
    const users = fakeUsers({ rng, time, people, organizations: orgs, count: 20 })
    for (const org of orgs) {
      const orgUsers = users.filter((u) => u.orgId === org.id)
      if (orgUsers.length > 0) {
        expect(orgUsers.some((u) => u.role === 'admin')).toBe(true)
      }
    }
  })

  it('invoices: paid invoices have a paidAt timestamp', () => {
    const { rng, time } = setup()
    const orgs = fakeOrganizations(rng, time, 3)
    const invoices = fakeInvoices({ rng, time, organizations: orgs, count: 200 })
    for (const inv of invoices) {
      if (inv.status === 'paid') expect(inv.paidAt).not.toBeNull()
      else expect(inv.paidAt).toBeNull()
    }
  })

  it('tickets: closed tickets have closedAt set, open ones do not', () => {
    const { rng, time } = setup()
    const orgs = fakeOrganizations(rng, time, 2)
    const people = fakePeople(rng, time, 20)
    const users = fakeUsers({ rng, time, people, organizations: orgs, count: 10 })
    const tickets = fakeTickets({ rng, time, organizations: orgs, users, count: 50 })
    for (const t of tickets) {
      if (t.status === 'resolved' || t.status === 'closed') {
        expect(t.closedAt).not.toBeNull()
      } else {
        expect(t.closedAt).toBeNull()
      }
    }
  })

  it('events: includes both past and future entries', () => {
    const { rng, time } = setup()
    const orgs = fakeOrganizations(rng, time, 3)
    const events = fakeEvents({ rng, time, organizations: orgs, count: 80 })
    const future = events.filter((e) => new Date(e.startsAt) > NOW)
    const past = events.filter((e) => new Date(e.startsAt) <= NOW)
    expect(future.length).toBeGreaterThan(0)
    expect(past.length).toBeGreaterThan(0)
  })

  it('notifications: every notification belongs to a real user/org pair', () => {
    const { rng, time } = setup()
    const orgs = fakeOrganizations(rng, time, 2)
    const people = fakePeople(rng, time, 10)
    const users = fakeUsers({ rng, time, people, organizations: orgs, count: 8 })
    const notifs = fakeNotifications({ rng, time, users, count: 30 })
    const userIndex = new Map(users.map((u) => [u.id, u.orgId]))
    for (const n of notifs) {
      expect(userIndex.get(n.userId)).toBe(n.orgId)
    }
  })

  it('activity logs: dates fall within the history window', () => {
    const { rng, time, targets } = setup()
    const orgs = fakeOrganizations(rng, time, 2)
    const people = fakePeople(rng, time, 10)
    const users = fakeUsers({ rng, time, people, organizations: orgs, count: 8 })
    const logs = fakeActivityLogs({ rng, time, users, count: 100 })
    const earliest = NOW.getTime() - targets.historyMonths * 30 * 86_400_000
    for (const l of logs) {
      const at = new Date(l.at).getTime()
      expect(at).toBeGreaterThanOrEqual(earliest)
      expect(at).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('determinism: identical inputs produce byte-identical output', () => {
    const run = () => {
      const rng = createRng(42)
      const time = createTime(getProfileTargets('demo-light'), NOW)
      return JSON.stringify(fakePeople(rng, time, 10))
    }
    expect(run()).toBe(run())
  })
})
