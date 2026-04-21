import { describe, expect, it } from 'vitest'
import { pmoAgent, type PmoSignal } from './pmo'

const req = (input: PmoSignal) => ({
  orgId: 'org-1',
  triggeredBy: 'manual' as const,
  now: new Date('2026-04-21T12:00:00Z'),
  input,
})

describe('pmoAgent', () => {
  it('nominal when empty', async () => {
    const r = await pmoAgent.run(req({ initiatives: [] }))
    expect(r.insights).toHaveLength(0)
  })

  it('warns on in-progress without due date', async () => {
    const r = await pmoAgent.run(req({
      initiatives: [
        { id: 'i1', title: 'X', status: 'in-progress', dueDate: null, owner: 'A', urgent: false, ageDays: 5 },
      ],
    }))
    expect(r.insights.some((i) => i.title.includes('without a due date'))).toBe(true)
  })

  it('critical on urgent not-started with action', async () => {
    const r = await pmoAgent.run(req({
      initiatives: [
        { id: 'i1', title: 'Urgent', status: 'not-started', dueDate: null, owner: 'A', urgent: true, ageDays: 2 },
      ],
    }))
    expect(r.insights.some((i) => i.severity === 'critical')).toBe(true)
    expect(r.actions).toHaveLength(1)
  })

  it('warns on long-running in-progress (scope drift)', async () => {
    const r = await pmoAgent.run(req({
      initiatives: [
        { id: 'i1', title: 'Forever', status: 'in-progress', dueDate: '2026-12-31', owner: 'A', urgent: false, ageDays: 120 },
      ],
      longRunningDays: 90,
    }))
    expect(r.insights.some((i) => i.title.includes('scope drift'))).toBe(true)
  })
})
