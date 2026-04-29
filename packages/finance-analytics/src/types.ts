export interface CashflowSummary {
  orgId: string
  periodStart: string
  periodEnd: string
  totalInflowCents: number
  totalOutflowCents: number
  netCents: number
  currency: string
}

export type AgingBucketLabel = '0-30' | '31-60' | '61-90' | '90+'

export interface AgingBucket {
  label: AgingBucketLabel
  totalCents: number
  count: number
}

export interface AgingReport {
  orgId: string
  currency: string
  asOf: string
  buckets: AgingBucket[]
  totalOutstandingCents: number
}

export interface CohortMetric {
  cohortId: string
  orgId: string
  periodLabel: string
  memberCount: number
  totalDuesCents: number
  paidCents: number
  collectionRate: number
}

export interface FeeRevenueSummary {
  orgId: string
  periodStart: string
  periodEnd: string
  totalFeeCents: number
  currency: string
  byFeeType: Record<string, number>
}

export interface UtilizationMetric {
  orgId: string
  fundId: string
  allocatedCents: number
  usedCents: number
  utilizationRate: number
}
