import { describe, it, expect } from 'vitest'
import { buildAgingReport } from './aging.js'

describe('buildAgingReport', () => {
  const asOf = new Date('2024-02-15T00:00:00.000Z')

  it('categorizes items into correct aging buckets', () => {
    const items = [
      { dueDate: '2024-02-10T00:00:00.000Z', amountCents: 1000 },
      { dueDate: '2024-01-10T00:00:00.000Z', amountCents: 2000 },
      { dueDate: '2023-12-10T00:00:00.000Z', amountCents: 3000 },
      { dueDate: '2023-10-01T00:00:00.000Z', amountCents: 4000 },
    ]
    const report = buildAgingReport('org-1', items, asOf, 'ZAR')
    expect(report.totalOutstandingCents).toBe(10000)
    const bucket030 = report.buckets.find((b) => b.label === '0-30')
    const bucket3160 = report.buckets.find((b) => b.label === '31-60')
    const bucket6190 = report.buckets.find((b) => b.label === '61-90')
    const bucket90plus = report.buckets.find((b) => b.label === '90+')
    expect(bucket030?.totalCents).toBe(1000)
    expect(bucket3160?.totalCents).toBe(2000)
    expect(bucket6190?.totalCents).toBe(3000)
    expect(bucket90plus?.totalCents).toBe(4000)
  })

  it('handles empty items', () => {
    const report = buildAgingReport('org-1', [], asOf, 'ZAR')
    expect(report.totalOutstandingCents).toBe(0)
  })
})
