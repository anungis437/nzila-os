import { describe, it, expect } from 'vitest'
import { taxAgent, type TaxSignal } from './tax.js'

function sig(o: Partial<TaxSignal> = {}): TaxSignal {
  return { filings: [], installments: [], ...o }
}

describe('taxAgent', () => {
  it('reports nothing due when calendar is empty', async () => {
    const r = await taxAgent.run({ orgId: 'o', input: sig() })
    expect(r.summary).toMatch(/no tax deadlines/i)
    expect(r.insights).toHaveLength(0)
  })

  it('emits critical for late filings', async () => {
    const r = await taxAgent.run({
      orgId: 'o',
      input: sig({
        filings: [
          { filingId: 'f1', filingType: 'T2', periodLabel: 'FY2025', dueDate: '2026-03-31', daysUntilDue: -21, status: 'late' },
        ],
      }),
    })
    expect(r.insights.find((i) => i.severity === 'critical')).toBeDefined()
    expect(r.actions[0]?.riskLevel).toBe('critical')
  })

  it('warns when filing is within 7 days and recommends approver assignment', async () => {
    const r = await taxAgent.run({
      orgId: 'o',
      input: sig({
        filings: [
          {
            filingId: 'f1',
            filingType: 'GST',
            periodLabel: '2026-Q1',
            dueDate: '2026-04-28',
            daysUntilDue: 5,
            status: 'draft',
          },
        ],
      }),
    })
    const upcoming = r.insights.find((i) => i.title.includes('due within'))
    expect(upcoming?.severity).toBe('warn')
    expect(r.actions.find((a) => a.title.includes('Assign approver'))).toBeDefined()
  })

  it('emits info-level upcoming when nothing within 7 days', async () => {
    const r = await taxAgent.run({
      orgId: 'o',
      input: sig({
        filings: [
          { filingId: 'f1', filingType: 'T2', periodLabel: 'FY2026', dueDate: '2026-05-15', daysUntilDue: 24, status: 'ready_for_review', approver: 'u1' },
        ],
      }),
    })
    const upcoming = r.insights.find((i) => i.title.includes('due within'))
    expect(upcoming?.severity).toBe('info')
  })

  it('flags late installments as critical with running total', async () => {
    const r = await taxAgent.run({
      orgId: 'o',
      input: sig({
        installments: [
          { installmentId: 'i1', authority: 'CRA', amount: 12_500, dueDate: '2026-03-15', daysUntilDue: -37, status: 'late' },
          { installmentId: 'i2', authority: 'Revenu Quebec', amount: 4_000, dueDate: '2026-03-15', daysUntilDue: -37, status: 'late' },
        ],
      }),
    })
    const ins = r.insights.find((i) => i.title.includes('installment(s) LATE'))
    expect(ins?.title).toContain('16,500')
    expect(ins?.severity).toBe('critical')
  })

  it('warns on installment within 7 days', async () => {
    const r = await taxAgent.run({
      orgId: 'o',
      input: sig({
        installments: [
          { installmentId: 'i1', authority: 'CRA', amount: 5_000, dueDate: '2026-04-25', daysUntilDue: 4, status: 'due' },
        ],
      }),
    })
    expect(r.insights.find((i) => i.title.includes('due in'))?.severity).toBe('warn')
  })
})
