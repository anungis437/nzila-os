import { describe, it, expect } from 'vitest'
import { chiefOfStaffAgent, type ChiefOfStaffSignal } from './chief-of-staff.js'

const REF_NOW = new Date('2026-04-21T12:00:00Z')

function emptySignal(overrides: Partial<ChiefOfStaffSignal> = {}): ChiefOfStaffSignal {
  return {
    initiatives: [],
    decisionsAwaiting: [],
    ...overrides,
  }
}

describe('chiefOfStaffAgent', () => {
  it('returns no insights for empty signal', async () => {
    const r = await chiefOfStaffAgent.run({ orgId: 'o', now: REF_NOW, input: emptySignal() })
    expect(r.insights).toHaveLength(0)
    expect(r.actions).toHaveLength(0)
    expect(r.summary).toMatch(/no urgent/i)
  })

  it('flags p0 decisions as critical', async () => {
    const r = await chiefOfStaffAgent.run({
      orgId: 'o',
      now: REF_NOW,
      input: emptySignal({
        decisionsAwaiting: [
          { id: 'd1', title: 'Approve seed terms', priority: 'p0', dueDate: null },
          { id: 'd2', title: 'Hire designer', priority: 'p2', dueDate: null },
        ],
      }),
    })
    const decisionInsight = r.insights.find((i) => i.title.includes('decision'))
    expect(decisionInsight?.severity).toBe('critical')
    expect(decisionInsight?.recommendedNextStep).toContain('Approve seed terms')
  })

  it('emits draft_action delegation for ownerless overdue initiatives', async () => {
    const r = await chiefOfStaffAgent.run({
      orgId: 'o',
      now: REF_NOW,
      input: emptySignal({
        initiatives: [
          {
            id: 'i1',
            title: 'Ship pricing v2',
            status: 'in-progress',
            urgent: false,
            dueDate: '2026-04-10',
            owner: null,
          },
        ],
      }),
    })
    const drafts = r.actions.filter((a) => a.actionClass === 'draft_action')
    expect(drafts).toHaveLength(1)
    expect(drafts[0]!.requiresApproval).toBe(true)
    expect(drafts[0]!.title).toContain('Ship pricing v2')
  })

  it('detects founder overload when ratio > 1.2', async () => {
    const r = await chiefOfStaffAgent.run({
      orgId: 'o',
      now: REF_NOW,
      input: emptySignal({ weeklyHoursLogged: 70, weeklyHoursTarget: 50 }),
    })
    const overload = r.insights.find((i) => i.title.includes('overload'))
    expect(overload).toBeDefined()
    expect(overload?.severity).toBe('warn')
  })

  it('does not flag overload when within target', async () => {
    const r = await chiefOfStaffAgent.run({
      orgId: 'o',
      now: REF_NOW,
      input: emptySignal({ weeklyHoursLogged: 45, weeklyHoursTarget: 50 }),
    })
    expect(r.insights.find((i) => i.title.includes('overload'))).toBeUndefined()
  })

  it('exposes cash position as info insight', async () => {
    const r = await chiefOfStaffAgent.run({
      orgId: 'o',
      now: REF_NOW,
      input: emptySignal({ cashOnHand: 125000 }),
    })
    const cash = r.insights.find((i) => i.domain === 'finance')
    expect(cash?.severity).toBe('info')
    expect(cash?.body).toContain('125,000')
  })
})
