import { describe, expect, it } from 'vitest'
import { hiringAgent, type HiringSignal } from './hiring'

const base = (overrides: Partial<HiringSignal> = {}): HiringSignal => ({
  openRoles: [],
  applications: [],
  ...overrides,
})

const req = (input: HiringSignal) => ({
  orgId: 'org-1',
  triggeredBy: 'manual' as const,
  now: new Date('2026-04-21T12:00:00Z'),
  input,
})

describe('hiringAgent', () => {
  it('nominal when empty', async () => {
    const r = await hiringAgent.run(req(base()))
    expect(r.insights).toHaveLength(0)
  })

  it('warns on stale roles', async () => {
    const r = await hiringAgent.run(req(base({
      openRoles: [
        { id: 'r1', title: 'Eng', postedDaysAgo: 60, applicationsCount: 3 },
      ],
      targetDaysToFill: 45,
    })))
    expect(r.insights.some((i) => i.title.includes('open >'))).toBe(true)
  })

  it('warns on empty pipeline after 7d', async () => {
    const r = await hiringAgent.run(req(base({
      openRoles: [
        { id: 'r1', title: 'Eng', postedDaysAgo: 14, applicationsCount: 0 },
      ],
    })))
    expect(r.insights.some((i) => i.title.includes('zero applications'))).toBe(true)
  })

  it('critical on expired postings with action', async () => {
    const r = await hiringAgent.run(req(base({
      openRoles: [
        { id: 'r1', title: 'Eng', postedDaysAgo: 10, applicationsCount: 3, closingInDays: -5 },
      ],
    })))
    expect(r.insights.some((i) => i.severity === 'critical' && i.title.includes('past closing'))).toBe(true)
    expect(r.actions).toHaveLength(1)
  })

  it('warns on unreviewed new applications', async () => {
    const r = await hiringAgent.run(req(base({
      applications: [
        { applicationId: 'a1', roleTitle: 'Eng', status: 'new', daysInStatus: 10 },
      ],
      newApplicationSlaDays: 5,
    })))
    expect(r.insights.some((i) => i.title.includes('unreviewed'))).toBe(true)
  })
})
