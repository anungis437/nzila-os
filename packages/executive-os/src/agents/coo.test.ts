import { describe, expect, it } from 'vitest'
import { cooAgent, type CooSignal } from './coo.js'

const base = (overrides: Partial<CooSignal> = {}): CooSignal => ({
  initiatives: [],
  openTickets: [],
  milestones: [],
  ...overrides,
})

const req = (input: CooSignal, now = new Date('2026-04-21T12:00:00Z')) => ({
  orgId: 'org-1',
  triggeredBy: 'manual' as const,
  now,
  input,
})

describe('cooAgent', () => {
  it('nominal when empty', async () => {
    const r = await cooAgent.run(req(base()))
    expect(r.insights).toHaveLength(0)
  })

  it('flags stalled initiatives', async () => {
    const r = await cooAgent.run(
      req(base({
        initiatives: [
          { id: 'i1', title: 'Stuck', status: 'in-progress', dueDate: null, owner: 'A', ageDays: 40 },
        ],
      })),
    )
    expect(r.insights.some((i) => i.title.toLowerCase().includes('stalled'))).toBe(true)
  })

  it('critical on overdue initiatives with action', async () => {
    const r = await cooAgent.run(
      req(base({
        initiatives: [
          { id: 'i1', title: 'Late', status: 'in-progress', dueDate: '2026-01-01', owner: 'A', ageDays: 10 },
        ],
      })),
    )
    expect(r.insights.some((i) => i.severity === 'critical')).toBe(true)
    expect(r.actions).toHaveLength(1)
  })

  it('critical on SLA breaches', async () => {
    const r = await cooAgent.run(
      req(base({
        openTickets: [
          { id: 't1', title: 'Outage', priority: 'p0', status: 'open', ageDays: 3, breachedSla: true },
        ],
      })),
    )
    expect(r.insights.some((i) => i.title.includes('breached SLA'))).toBe(true)
  })

  it('warn on P0 open without movement', async () => {
    const r = await cooAgent.run(
      req(base({
        openTickets: [
          { id: 't1', title: 'X', priority: 'p0', status: 'open', ageDays: 3, breachedSla: false },
        ],
      })),
    )
    expect(r.insights.some((i) => i.title.includes('P0/P1'))).toBe(true)
  })

  it('critical on very-late milestone', async () => {
    const r = await cooAgent.run(
      req(base({
        milestones: [
          { id: 'm1', label: 'Go-live', dueDate: '2026-01-01', completedAt: null, daysLate: 30 },
        ],
      })),
    )
    expect(r.insights.some((i) => i.severity === 'critical' && i.title.includes('milestone'))).toBe(true)
  })
})
