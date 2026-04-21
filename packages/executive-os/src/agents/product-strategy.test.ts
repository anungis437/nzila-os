import { describe, expect, it } from 'vitest'
import { productStrategyAgent, type ProductStrategySignal } from './product-strategy'

const req = (input: ProductStrategySignal) => ({
  orgId: 'org-1',
  triggeredBy: 'manual' as const,
  now: new Date('2026-04-21T12:00:00Z'),
  input,
})

describe('productStrategyAgent', () => {
  it('nominal when empty', async () => {
    const r = await productStrategyAgent.run(req({ products: [] }))
    expect(r.insights).toHaveLength(0)
  })

  it('critical when incidents 2× threshold', async () => {
    const r = await productStrategyAgent.run(req({
      products: [
        { product: 'p', incidentsThisMonth: 12, supportLoad: 0, deploymentsShipped: 3, openBugs: 0, snapshotDate: '2026-04', ageDays: 2 },
      ],
      incidentWarnThreshold: 5,
    }))
    expect(r.insights.some((i) => i.severity === 'critical' && i.title.includes('incident'))).toBe(true)
    expect(r.actions).toHaveLength(1)
  })

  it('warns on high open bugs', async () => {
    const r = await productStrategyAgent.run(req({
      products: [
        { product: 'p', incidentsThisMonth: 0, supportLoad: 0, deploymentsShipped: 1, openBugs: 50, snapshotDate: '2026-04', ageDays: 2 },
      ],
      openBugWarnThreshold: 30,
    }))
    expect(r.insights.some((i) => i.title.includes('open bugs'))).toBe(true)
  })

  it('warns on stale snapshots', async () => {
    const r = await productStrategyAgent.run(req({
      products: [
        { product: 'p', incidentsThisMonth: 0, supportLoad: 0, deploymentsShipped: 1, openBugs: 0, snapshotDate: '2025-12', ageDays: 120 },
      ],
      staleSnapshotDays: 45,
    }))
    expect(r.insights.some((i) => i.title.includes('stale'))).toBe(true)
  })

  it('info on zero-shipment products', async () => {
    const r = await productStrategyAgent.run(req({
      products: [
        { product: 'p', incidentsThisMonth: 0, supportLoad: 0, deploymentsShipped: 0, openBugs: 0, snapshotDate: '2026-04', ageDays: 2 },
      ],
    }))
    expect(r.insights.some((i) => i.title.includes('zero deployments'))).toBe(true)
  })
})
