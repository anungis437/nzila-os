import { describe, expect, it } from 'vitest'
import { revopsAgent, type RevOpsSignal } from './revops.js'

function run(input: RevOpsSignal) {
  return revopsAgent.run({ orgId: 'org-1', input })
}

describe('revopsAgent', () => {
  it('returns no-signal summary when input missing', async () => {
    const r = await revopsAgent.run({ orgId: 'org-1' })
    expect(r.summary).toMatch(/No RevOps/i)
    expect(r.insights).toHaveLength(0)
  })

  it('flags critical coverage below 2x', async () => {
    const r = await run({
      quarterlyTarget: 1_000_000,
      closedWonThisQuarter: 100_000,
      openOpportunities: [
        { opportunityId: 'o1', title: 'Deal A', estimatedValue: 500_000, stage: 'proposal', daysInStage: 5 },
      ],
    })
    const cov = r.insights.find((i) => /coverage/i.test(i.title))
    expect(cov?.severity).toBe('critical')
    expect(r.actions.some((a) => /sourcing sprint/i.test(a.title))).toBe(true)
  })

  it('warns at coverage between 2x and 3x', async () => {
    const r = await run({
      quarterlyTarget: 1_000_000,
      closedWonThisQuarter: 100_000,
      openOpportunities: [
        { opportunityId: 'o1', title: 'A', estimatedValue: 1_500_000, stage: 'negotiation', daysInStage: 3 },
        { opportunityId: 'o2', title: 'B', estimatedValue: 500_000, stage: 'proposal', daysInStage: 3 },
      ],
    })
    expect(r.insights.find((i) => /coverage/i.test(i.title))?.severity).toBe('warn')
  })

  it('flags stalled opportunities', async () => {
    const r = await run({
      quarterlyTarget: 100_000,
      closedWonThisQuarter: 200_000,
      openOpportunities: [
        { opportunityId: 'o1', title: 'Stuck A', estimatedValue: 50_000, stage: 'proposal', daysInStage: 45, owner: 'alice' },
        { opportunityId: 'o2', title: 'Fresh', estimatedValue: 50_000, stage: 'qualified', daysInStage: 2 },
      ],
      staleDays: 21,
    })
    const stalledInsight = r.insights.find((i) => /stalled/i.test(i.title))
    expect(stalledInsight).toBeDefined()
    expect(stalledInsight?.severity).toBe('critical') // > 2x staleDays
    expect(r.actions.some((a) => /Stuck A/i.test(a.title))).toBe(true)
  })

  it('flags early-stage pipeline skew', async () => {
    const r = await run({
      quarterlyTarget: 100_000,
      closedWonThisQuarter: 0,
      openOpportunities: [
        { opportunityId: 'o1', title: 'Lead', estimatedValue: 900_000, stage: 'lead', daysInStage: 3 },
        { opportunityId: 'o2', title: 'Prop', estimatedValue: 100_000, stage: 'proposal', daysInStage: 3 },
      ],
    })
    expect(r.insights.some((i) => /early stage/i.test(i.title))).toBe(true)
  })

  it('healthy when coverage >3x and nothing stalled', async () => {
    const r = await run({
      quarterlyTarget: 100_000,
      closedWonThisQuarter: 50_000,
      openOpportunities: [
        { opportunityId: 'o1', title: 'A', estimatedValue: 200_000, stage: 'proposal', daysInStage: 3 },
      ],
    })
    expect(r.summary).toMatch(/healthy/i)
  })
})
