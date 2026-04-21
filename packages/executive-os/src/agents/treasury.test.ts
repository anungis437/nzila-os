import { describe, it, expect } from 'vitest'
import { treasuryAgent, type TreasurySignal } from './treasury'

function sig(o: Partial<TreasurySignal> = {}): TreasurySignal {
  return {
    cashToday: 500_000,
    minimumReserve: 100_000,
    weeks: Array.from({ length: 13 }, (_, i) => ({
      weekStart: `2026-W${String(i + 1).padStart(2, '0')}`,
      inflows: 20_000,
      outflows: 25_000,
    })),
    ...o,
  }
}

describe('treasuryAgent', () => {
  it('emits critical insight when cash < minimum reserve', async () => {
    const r = await treasuryAgent.run({
      orgId: 'o',
      input: sig({ cashToday: 50_000 }),
    })
    const breach = r.insights.find((i) => i.title.includes('below minimum'))
    expect(breach?.severity).toBe('critical')
  })

  it('emits critical when 13-week trough goes negative', async () => {
    const r = await treasuryAgent.run({
      orgId: 'o',
      input: sig({
        cashToday: 100_000,
        weeks: Array.from({ length: 13 }, (_, i) => ({
          weekStart: `W${i}`,
          inflows: 0,
          outflows: 20_000,
        })),
      }),
    })
    const trough = r.insights.find((i) => i.title.includes('trough'))
    expect(trough?.severity).toBe('critical')
    expect(r.actions.some((a) => a.riskLevel === 'critical')).toBe(true)
  })

  it('emits warn when trough breaches reserve but stays positive', async () => {
    const r = await treasuryAgent.run({
      orgId: 'o',
      input: sig({
        cashToday: 200_000,
        minimumReserve: 100_000,
        weeks: Array.from({ length: 13 }, (_, i) => ({
          weekStart: `W${i}`,
          inflows: 5_000,
          outflows: 15_000,
        })),
      }),
    })
    const trough = r.insights.find((i) => i.title.includes('trough'))
    expect(trough?.severity).toBe('warn')
  })

  it('flags concentrated outflow weeks', async () => {
    const r = await treasuryAgent.run({
      orgId: 'o',
      input: sig({
        cashToday: 100_000,
        weeks: [
          { weekStart: 'W1', inflows: 0, outflows: 50_000 },
          ...Array.from({ length: 12 }, (_, i) => ({
            weekStart: `W${i + 2}`,
            inflows: 10_000,
            outflows: 5_000,
          })),
        ],
      }),
    })
    expect(r.insights.find((i) => i.title.includes('concentrated outflows'))).toBeDefined()
  })

  it('returns no signal message when input missing', async () => {
    const r = await treasuryAgent.run({ orgId: 'o' })
    expect(r.insights).toHaveLength(0)
  })
})
