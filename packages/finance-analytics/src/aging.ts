import type { AgingReport, AgingBucket, AgingBucketLabel } from './types.js'

const MS_PER_DAY = 86400000

export interface OutstandingItem {
  dueDate: string
  amountCents: number
}

export function buildAgingReport(orgId: string, outstandingItems: OutstandingItem[], asOf: Date, currency: string): AgingReport {
  const buckets: Record<AgingBucketLabel, AgingBucket> = {
    '0-30': { label: '0-30', totalCents: 0, count: 0 },
    '31-60': { label: '31-60', totalCents: 0, count: 0 },
    '61-90': { label: '61-90', totalCents: 0, count: 0 },
    '90+': { label: '90+', totalCents: 0, count: 0 },
  }

  for (const item of outstandingItems) {
    const dueDate = new Date(item.dueDate)
    const daysOverdue = Math.floor((asOf.getTime() - dueDate.getTime()) / MS_PER_DAY)
    let label: AgingBucketLabel
    if (daysOverdue <= 30) {
      label = '0-30'
    } else if (daysOverdue <= 60) {
      label = '31-60'
    } else if (daysOverdue <= 90) {
      label = '61-90'
    } else {
      label = '90+'
    }
    const bucket = buckets[label]
    bucket.totalCents += item.amountCents
    bucket.count += 1
  }

  const totalOutstandingCents = Object.values(buckets).reduce((sum, b) => sum + b.totalCents, 0)

  return {
    orgId,
    currency,
    asOf: asOf.toISOString(),
    buckets: Object.values(buckets),
    totalOutstandingCents,
  }
}
