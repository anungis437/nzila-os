import { describe, it, expect } from 'vitest'
import { fpaAgent, type FpaSignal } from './fpa'

function line(label: string, category: 'revenue' | 'expense', actuals: Array<[number, number]>): FpaSignal['lines'][number] {
  return {
    lineId: label,
    label,
    category,
    history: actuals.map(([b, a], i) => ({ period: `2026-${String(i + 1).padStart(2, '0')}`, budget: b, actual: a })),
  }
}

describe('fpaAgent', () => {
  it('returns no signal message when input missing', async () => {
    const r = await fpaAgent.run({ orgId: 'o' })
    expect(r.insights).toHaveLength(0)
  })

  it('reports clean when all lines within material threshold', async () => {
    const r = await fpaAgent.run({
      orgId: 'o',
      input: {
        lines: [line('AWS', 'expense', [[100, 105], [100, 102], [100, 108]])],
      },
    })
    expect(r.summary).toMatch(/within/i)
    expect(r.insights).toHaveLength(0)
  })

  it('flags severe variance as critical', async () => {
    const r = await fpaAgent.run({
      orgId: 'o',
      input: {
        lines: [line('AWS', 'expense', [[100, 100], [100, 100], [100, 200]])],
      },
    })
    const flagged = r.insights.find((i) => i.title.includes('off plan'))
    expect(flagged?.severity).toBe('critical')
  })

  it('detects persistent variance', async () => {
    const r = await fpaAgent.run({
      orgId: 'o',
      input: {
        lines: [line('Revenue', 'revenue', [[100, 80], [100, 78], [100, 75]])],
      },
    })
    expect(r.insights.find((i) => i.title.includes('persistently'))).toBeDefined()
  })

  it('marks expense-over and revenue-under reforecasts as high risk', async () => {
    const r = await fpaAgent.run({
      orgId: 'o',
      input: {
        lines: [
          line('Revenue', 'revenue', [[100, 60], [100, 55], [100, 50]]),
          line('AWS', 'expense', [[100, 200], [100, 250], [100, 300]]),
        ],
      },
    })
    const reforecasts = r.actions.filter((a) => a.title.startsWith('Reforecast'))
    expect(reforecasts.every((a) => a.riskLevel === 'high')).toBe(true)
  })

  it('treats unbudgeted spend as 100% over', async () => {
    const r = await fpaAgent.run({
      orgId: 'o',
      input: {
        lines: [line('Surprise', 'expense', [[0, 1000], [0, 1000], [0, 1000]])],
      },
    })
    expect(r.insights.length).toBeGreaterThan(0)
  })
})
