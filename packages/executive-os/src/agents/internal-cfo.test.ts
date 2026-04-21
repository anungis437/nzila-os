import { describe, it, expect } from 'vitest'
import { internalCfoAgent, type CfoSignal } from './internal-cfo'

function sig(o: Partial<CfoSignal> = {}): CfoSignal {
  return {
    cashOnHand: 500_000,
    monthlyNetBurn: [50_000, 50_000, 50_000],
    monthlyRevenue: [10_000, 10_000, 10_000],
    ...o,
  }
}

describe('internalCfoAgent', () => {
  it('returns no signal message when input missing', async () => {
    const r = await internalCfoAgent.run({ orgId: 'o' })
    expect(r.insights).toHaveLength(0)
    expect(r.summary).toMatch(/no finance signal/i)
  })

  it('emits info-level runway when cash is healthy', async () => {
    const r = await internalCfoAgent.run({ orgId: 'o', input: sig({ cashOnHand: 1_000_000 }) })
    const runway = r.insights.find((i) => i.title.startsWith('Runway'))
    expect(runway?.severity).toBe('info')
  })

  it('emits critical runway and recommendation when cash < 3 months burn', async () => {
    const r = await internalCfoAgent.run({
      orgId: 'o',
      input: sig({ cashOnHand: 100_000, discretionarySpendMonthly: 5_000 }),
    })
    const runway = r.insights.find((i) => i.title.startsWith('Runway'))
    expect(runway?.severity).toBe('critical')
    const cut = r.actions.find((a) => a.title.includes('discretionary spend'))
    expect(cut?.actionClass).toBe('recommendation')
    expect(cut?.requiresApproval).toBe(true)
    expect(cut?.riskLevel).toBe('critical')
  })

  it('flags hiring as not affordable when it drops runway below threshold', async () => {
    const r = await internalCfoAgent.run({
      orgId: 'o',
      input: sig({
        cashOnHand: 300_000,
        plannedHires: [
          { role: 'Senior Eng', monthlyCost: 12_000 },
          { role: 'Designer', monthlyCost: 9_000 },
        ],
      }),
    })
    const hire = r.insights.find((i) => i.title.includes('Hiring plan'))
    expect(hire?.title).toContain('NOT affordable')
    const delays = r.actions.filter((a) => a.title.startsWith('Delay hire'))
    expect(delays).toHaveLength(2)
  })

  it('does not emit raise action when runway is well above threshold', async () => {
    const r = await internalCfoAgent.run({
      orgId: 'o',
      input: sig({ cashOnHand: 1_500_000 }),
    })
    expect(r.actions.find((a) => a.title.startsWith('Open raise'))).toBeUndefined()
  })

  it('emits raise action when runway < threshold', async () => {
    const r = await internalCfoAgent.run({
      orgId: 'o',
      input: sig({ cashOnHand: 200_000 }),
    })
    const raise = r.actions.find((a) => a.title.startsWith('Open raise'))
    expect(raise).toBeDefined()
    expect(raise?.requiresApproval).toBe(true)
  })

  it('flags AR > 1 month of burn', async () => {
    const r = await internalCfoAgent.run({
      orgId: 'o',
      input: sig({ accountsReceivable: 75_000 }),
    })
    const ar = r.insights.find((i) => i.title.startsWith('AR represents'))
    expect(ar?.severity).toBe('warn')
  })

  it('flags AP pressure when payables > 40% of cash', async () => {
    const r = await internalCfoAgent.run({
      orgId: 'o',
      input: sig({ cashOnHand: 100_000, payablesDue30d: 60_000 }),
    })
    const ap = r.insights.find((i) => i.title.startsWith('Payables due'))
    expect(ap?.severity).toBe('warn')
  })
})
