import { describe, expect, it } from 'vitest'
import { finopsAgent, type FinopsSignal } from './finops.js'

function run(input: FinopsSignal) {
  return finopsAgent.run({ orgId: 'org-1', input })
}

describe('finopsAgent', () => {
  it('no-signal when missing', async () => {
    const r = await finopsAgent.run({ orgId: 'org-1' })
    expect(r.summary).toMatch(/No FinOps/i)
  })

  it('elevates latest breach state to critical', async () => {
    const r = await run({
      categories: [],
      breaches: [
        { recordedAt: '2026-04-20', state: 'breach', dailySpendUsd: 500, monthlySpendUsd: 12_000 },
      ],
    })
    const breach = r.insights.find((i) => /Budget breach/i.test(i.title))
    expect(breach?.severity).toBe('critical')
    expect(r.actions.some((a) => /budget breach/i.test(a.title))).toBe(true)
  })

  it('flags category growth past warn threshold', async () => {
    const r = await run({
      categories: [
        { category: 'llm', mtdUsd: 400, lastMonthSameDayUsd: 200 },
      ],
      breaches: [],
      growthWarnPct: 0.25,
    })
    expect(r.insights.some((i) => /growing > 25%/i.test(i.title))).toBe(true)
  })

  it('escalates growth past critical threshold', async () => {
    const r = await run({
      categories: [{ category: 'llm', mtdUsd: 400, lastMonthSameDayUsd: 200 }],
      breaches: [],
      growthWarnPct: 0.25,
      growthCriticalPct: 0.5,
    })
    const g = r.insights.find((i) => /growing/i.test(i.title))
    expect(g?.severity).toBe('critical')
  })

  it('warns when MTD > 80% of monthly budget', async () => {
    const r = await run({
      categories: [{ category: 'x', mtdUsd: 850 }],
      breaches: [],
      monthlyBudgetUsd: 1000,
    })
    expect(r.insights.some((i) => /monthly budget/i.test(i.title))).toBe(true)
  })

  it('surfaces top categories even when healthy', async () => {
    const r = await run({
      categories: [
        { category: 'llm', mtdUsd: 100 },
        { category: 'storage', mtdUsd: 10 },
      ],
      breaches: [],
    })
    expect(r.insights.some((i) => /Top 5 cost/i.test(i.title))).toBe(true)
    expect(r.summary).toMatch(/healthy/i)
  })
})
