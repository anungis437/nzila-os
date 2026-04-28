import { describe, expect, it } from 'vitest'
import {
  agingBuckets,
  burnEstimate,
  concentrationByClient,
  runScenario,
  runwayMonths,
  type CashEvent,
  type Invoice,
} from './finance-engine'

const NOW = '2026-04-28T12:00:00.000Z'
const day = (offsetDays: number): string =>
  new Date(Date.parse(NOW) + offsetDays * 86_400_000).toISOString()

const inv = (
  id: string,
  daysPastDue: number,
  cents: number,
  clientOrgId = 'org-A',
  status: Invoice['status'] = 'sent',
): Invoice => ({
  id,
  ventureSlug: 'alpha',
  clientOrgId,
  clientName: clientOrgId,
  issuedAt: day(-daysPastDue - 30),
  dueAt: day(-daysPastDue),
  paidAt: null,
  amountCents: cents,
  status,
})

describe('agingBuckets', () => {
  it('bins invoices into the right age buckets', () => {
    const report = agingBuckets(
      [
        inv('1', -5, 100_00), // not yet due → current
        inv('2', 10, 200_00),
        inv('3', 45, 300_00),
        inv('4', 75, 400_00),
        inv('5', 120, 500_00),
        inv('6', 0, 999_00, 'org-A', 'paid'), // ignored
      ],
      NOW,
    )
    expect(report.buckets.current.totalCents).toBe(100_00)
    expect(report.buckets['1-30'].totalCents).toBe(200_00)
    expect(report.buckets['31-60'].totalCents).toBe(300_00)
    expect(report.buckets['61-90'].totalCents).toBe(400_00)
    expect(report.buckets['90+'].totalCents).toBe(500_00)
    expect(report.overdueCents).toBe(1400_00)
  })
})

const evt = (
  id: string,
  kind: CashEvent['kind'],
  category: CashEvent['category'],
  cents: number,
  daysAgo: number,
): CashEvent => ({
  id,
  kind,
  category,
  amountCents: cents,
  occurredAt: day(-daysAgo),
  ventureSlug: null,
  description: '',
})

describe('burnEstimate + runwayMonths', () => {
  it('computes monthly burn and runway from a 90d window', () => {
    const events: CashEvent[] = [
      evt('p1', 'outflow', 'payroll', 60_000_00, 30),
      evt('p2', 'outflow', 'payroll', 60_000_00, 60),
      evt('p3', 'outflow', 'payroll', 60_000_00, 89),
      evt('i1', 'inflow', 'customer-payment', 30_000_00, 30),
    ]
    const burn = burnEstimate(events, NOW, 90)
    expect(burn.monthlyBurnCents).toBe(60_000_00) // 180k / 3 months
    expect(burn.monthlyInflowCents).toBe(10_000_00)
    expect(burn.netMonthlyCents).toBe(-50_000_00)
    const runway = runwayMonths(500_000_00, burn) // $500k cash
    expect(runway).toBe(10) // 500k / 50k = 10 months
  })

  it('returns null runway when net positive', () => {
    const burn = burnEstimate(
      [evt('i', 'inflow', 'customer-payment', 100_00, 10)],
      NOW,
      90,
    )
    expect(runwayMonths(1000_00, burn)).toBeNull()
  })
})

describe('concentrationByClient', () => {
  it('computes herfindahl and top share', () => {
    const report = concentrationByClient([
      inv('1', 0, 700_00, 'org-A'),
      inv('2', 0, 200_00, 'org-B'),
      inv('3', 0, 100_00, 'org-C'),
    ])
    expect(report.byClient[0].clientOrgId).toBe('org-A')
    expect(report.topShare).toBeCloseTo(0.7, 2)
    // 0.7^2 + 0.2^2 + 0.1^2 = 0.49 + 0.04 + 0.01 = 0.54
    expect(report.herfindahl).toBeCloseTo(0.54, 2)
  })
})

describe('runScenario', () => {
  it('cutting burn extends runway', () => {
    const events: CashEvent[] = [
      evt('p', 'outflow', 'payroll', 60_000_00, 30),
      evt('p2', 'outflow', 'payroll', 60_000_00, 60),
      evt('p3', 'outflow', 'payroll', 60_000_00, 89),
    ]
    const result = runScenario(
      { cashOnHandCents: 500_000_00, invoices: [], events, nowIso: NOW },
      { cutBurnPct: 0.5 },
    )
    expect(result.baseline.runwayMonths).toBeLessThan(result.scenario.runwayMonths!)
  })

  it('losing top client increases concentration risk reduction', () => {
    const invoices = [
      inv('1', 0, 700_00, 'org-A'),
      inv('2', 0, 200_00, 'org-B'),
      inv('3', 0, 100_00, 'org-C'),
    ]
    const result = runScenario(
      { cashOnHandCents: 100_00, invoices, events: [], nowIso: NOW },
      { loseClientOrgId: 'org-A' },
    )
    expect(result.scenario.concentration.byClient.find((c) => c.clientOrgId === 'org-A')).toBeUndefined()
    expect(result.scenario.concentration.topShare).toBeLessThan(result.baseline.concentration.topShare)
  })
})
