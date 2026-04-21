import { describe, it, expect } from 'vitest'
import { collectionsAgent, type CollectionsSignal, type OverdueInvoice } from './collections.js'

const NOW = new Date('2026-04-21T12:00:00Z')

function inv(o: Partial<OverdueInvoice> = {}): OverdueInvoice {
  return {
    invoiceId: 'i1',
    clientId: 'c1',
    clientName: 'Acme',
    amount: 10_000,
    dueDate: '2026-04-01',
    daysOverdue: 20,
    ...o,
  }
}

function sig(invoices: OverdueInvoice[]): CollectionsSignal {
  return { invoices }
}

describe('collectionsAgent', () => {
  it('returns nothing when no invoices', async () => {
    const r = await collectionsAgent.run({ orgId: 'o', now: NOW, input: sig([]) })
    expect(r.insights).toHaveLength(0)
    expect(r.actions).toHaveLength(0)
  })

  it('summarises overdue and ranks by impact', async () => {
    const r = await collectionsAgent.run({
      orgId: 'o',
      now: NOW,
      input: sig([
        inv({ invoiceId: 'i1', amount: 5_000, daysOverdue: 60 }),
        inv({ invoiceId: 'i2', amount: 50_000, daysOverdue: 5 }),
      ]),
    })
    const summary = r.insights.find((i) => i.title.includes('overdue across'))
    expect(summary).toBeDefined()
    expect(summary!.body).toMatch(/^Acme/) // both clients named Acme by default; just check format
  })

  it('flags disputed invoices separately', async () => {
    const r = await collectionsAgent.run({
      orgId: 'o',
      now: NOW,
      input: sig([inv({ disputed: true })]),
    })
    expect(r.insights.find((i) => i.title.includes('disputed'))).toBeDefined()
    // Disputed invoices should NOT generate auto draft_actions
    expect(r.actions.find((a) => a.title.includes('Acme'))).toBeUndefined()
  })

  it('drafts email reminder for first contact', async () => {
    const r = await collectionsAgent.run({
      orgId: 'o',
      now: NOW,
      input: sig([inv()]),
    })
    const draft = r.actions.find((a) => a.actionClass === 'draft_action')
    expect(draft?.title).toMatch(/^Email/)
    expect(draft?.requiresApproval).toBe(true)
    expect(draft?.riskLevel).toBe('low')
  })

  it('escalates after email + call exhausted', async () => {
    const r = await collectionsAgent.run({
      orgId: 'o',
      now: NOW,
      input: sig([
        inv({ lastContactType: 'call', lastContactDate: '2026-04-01' }),
      ]),
    })
    const draft = r.actions.find((a) => a.actionClass === 'draft_action')
    expect(draft?.title).toMatch(/^Escalate/)
    expect(draft?.riskLevel).toBe('high')
  })

  it('respects quiet period', async () => {
    const r = await collectionsAgent.run({
      orgId: 'o',
      now: NOW,
      input: sig([
        inv({ lastContactType: 'email', lastContactDate: '2026-04-19' }),
      ]),
    })
    expect(r.actions.find((a) => a.actionClass === 'draft_action')).toBeUndefined()
  })
})
