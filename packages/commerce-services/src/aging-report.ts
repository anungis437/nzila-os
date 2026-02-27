/**
 * @nzila/commerce-services — Accounts receivable & payable aging report
 *
 * Generates AR/AP aging reports with configurable buckets.
 * Standard accounting format: Current, 1-30, 31-60, 61-90, 90+ days.
 *
 * @module @nzila/commerce-services/aging-report
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface AgingInvoice {
  id: string
  customerId: string
  customerName: string
  invoiceNumber: string
  issueDate: string       // ISO date
  dueDate: string         // ISO date
  amount: number
  amountPaid: number
  balance: number
  currency: string
  status: 'issued' | 'sent' | 'overdue' | 'partially_paid' | 'disputed'
}

export interface AgingBucket {
  label: string
  minDays: number
  maxDays: number | null   // null = unbounded (e.g., 90+)
  invoiceCount: number
  totalBalance: number
  invoices: AgingInvoice[]
}

export interface AgingReport {
  type: 'ar' | 'ap'
  asOfDate: string
  entityId: string
  buckets: AgingBucket[]
  summary: {
    totalOutstanding: number
    totalOverdue: number
    averageDaysOutstanding: number
    invoiceCount: number
    customerCount: number
    oldestInvoiceDays: number
  }
}

// ── Default bucket configuration ────────────────────────────────────────────

export interface AgingBucketConfig {
  label: string
  minDays: number
  maxDays: number | null
}

/**
 * Standard aging report buckets used in Canadian accounting.
 */
export const STANDARD_AGING_BUCKETS: AgingBucketConfig[] = [
  { label: 'Current',  minDays: 0,   maxDays: 0 },
  { label: '1–30',     minDays: 1,   maxDays: 30 },
  { label: '31–60',    minDays: 31,  maxDays: 60 },
  { label: '61–90',    minDays: 61,  maxDays: 90 },
  { label: '91–120',   minDays: 91,  maxDays: 120 },
  { label: '120+',     minDays: 121, maxDays: null },
]

// ── Generator ───────────────────────────────────────────────────────────────

/**
 * Calculate days between two ISO date strings.
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Generate an aging report from a list of invoices.
 */
export function generateAgingReport(
  invoices: AgingInvoice[],
  options: {
    type: 'ar' | 'ap'
    entityId: string
    asOfDate?: string
    buckets?: AgingBucketConfig[]
  },
): AgingReport {
  const asOfDate = options.asOfDate ?? new Date().toISOString().slice(0, 10)
  const bucketConfigs = options.buckets ?? STANDARD_AGING_BUCKETS

  // Initialize buckets
  const buckets: AgingBucket[] = bucketConfigs.map((config) => ({
    ...config,
    invoiceCount: 0,
    totalBalance: 0,
    invoices: [],
  }))

  const unpaid = invoices.filter((inv) => inv.balance > 0)
  let totalOutstanding = 0
  let totalOverdue = 0
  let totalDaysWeighted = 0
  let oldestDays = 0
  const customerSet = new Set<string>()

  for (const invoice of unpaid) {
    const daysOverdue = daysBetween(invoice.dueDate, asOfDate)
    const daysAged = Math.max(0, daysOverdue)

    totalOutstanding += invoice.balance
    totalDaysWeighted += daysAged * invoice.balance
    if (daysOverdue > 0) totalOverdue += invoice.balance
    if (daysAged > oldestDays) oldestDays = daysAged
    customerSet.add(invoice.customerId)

    // Place in the right bucket
    for (const bucket of buckets) {
      const inMin = daysAged >= bucket.minDays
      const inMax = bucket.maxDays === null || daysAged <= bucket.maxDays
      if (inMin && inMax) {
        bucket.invoiceCount++
        bucket.totalBalance = Math.round((bucket.totalBalance + invoice.balance) * 100) / 100
        bucket.invoices.push(invoice)
        break
      }
    }
  }

  const avgDays = totalOutstanding > 0
    ? Math.round(totalDaysWeighted / totalOutstanding)
    : 0

  return {
    type: options.type,
    asOfDate,
    entityId: options.entityId,
    buckets,
    summary: {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      averageDaysOutstanding: avgDays,
      invoiceCount: unpaid.length,
      customerCount: customerSet.size,
      oldestInvoiceDays: oldestDays,
    },
  }
}

// ── Revenue recognition (ASC 606 / IFRS 15 simplified) ─────────────────────

export interface RevenueContract {
  id: string
  customerId: string
  startDate: string
  endDate: string
  totalValue: number
  performanceObligations: PerformanceObligation[]
}

export interface PerformanceObligation {
  id: string
  description: string
  standaloneSellingPrice: number
  /** 'point-in-time' = recognized on delivery; 'over-time' = recognized ratably */
  recognitionPattern: 'point-in-time' | 'over-time'
  /** For over-time: date performance started */
  startDate?: string
  /** For point-in-time: date satisfied */
  satisfiedDate?: string
}

export interface RevenueAllocation {
  obligationId: string
  description: string
  allocatedAmount: number
  recognizedToDate: number
  deferred: number
  percentComplete: number
}

export interface RevenueRecognitionReport {
  contractId: string
  asOfDate: string
  totalContractValue: number
  totalRecognized: number
  totalDeferred: number
  allocations: RevenueAllocation[]
}

/**
 * Allocate transaction price to performance obligations
 * using the relative standalone selling price method (ASC 606 Step 4).
 */
export function allocateTransactionPrice(
  totalPrice: number,
  obligations: PerformanceObligation[],
): RevenueAllocation[] {
  const totalSSP = obligations.reduce((sum, o) => sum + o.standaloneSellingPrice, 0)

  return obligations.map((ob) => {
    const ratio = totalSSP > 0 ? ob.standaloneSellingPrice / totalSSP : 1 / obligations.length
    const allocated = Math.round(totalPrice * ratio * 100) / 100

    return {
      obligationId: ob.id,
      description: ob.description,
      allocatedAmount: allocated,
      recognizedToDate: 0,
      deferred: allocated,
      percentComplete: 0,
    }
  })
}

/**
 * Calculate recognized revenue as of a given date.
 * Point-in-time: full amount when satisfied.
 * Over-time: pro-rata based on time elapsed.
 */
export function calculateRecognizedRevenue(
  contract: RevenueContract,
  asOfDate?: string,
): RevenueRecognitionReport {
  const reportDate = asOfDate ?? new Date().toISOString().slice(0, 10)
  const allocations = allocateTransactionPrice(contract.totalValue, contract.performanceObligations)

  let totalRecognized = 0

  for (const alloc of allocations) {
    const ob = contract.performanceObligations.find((o) => o.id === alloc.obligationId)
    if (!ob) continue

    if (ob.recognitionPattern === 'point-in-time') {
      if (ob.satisfiedDate && ob.satisfiedDate <= reportDate) {
        alloc.recognizedToDate = alloc.allocatedAmount
        alloc.percentComplete = 1
      }
    } else {
      // Over-time: straight-line from start to contract end
      const start = ob.startDate ?? contract.startDate
      const totalDays = Math.max(1, daysBetween(start, contract.endDate))
      const elapsedDays = Math.max(0, Math.min(daysBetween(start, reportDate), totalDays))
      const pct = elapsedDays / totalDays
      alloc.recognizedToDate = Math.round(alloc.allocatedAmount * pct * 100) / 100
      alloc.percentComplete = Math.round(pct * 10000) / 10000
    }

    alloc.deferred = Math.round((alloc.allocatedAmount - alloc.recognizedToDate) * 100) / 100
    totalRecognized += alloc.recognizedToDate
  }

  return {
    contractId: contract.id,
    asOfDate: reportDate,
    totalContractValue: contract.totalValue,
    totalRecognized: Math.round(totalRecognized * 100) / 100,
    totalDeferred: Math.round((contract.totalValue - totalRecognized) * 100) / 100,
    allocations,
  }
}

// ── Dunning schedule ────────────────────────────────────────────────────────

export interface DunningStep {
  daysOverdue: number
  action: 'reminder' | 'warning' | 'final-notice' | 'escalation' | 'suspension'
  channel: 'email' | 'sms' | 'phone' | 'letter'
  template: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/** Standard dunning schedule for Canadian accounting firms */
export const STANDARD_DUNNING_SCHEDULE: DunningStep[] = [
  { daysOverdue: 7,  action: 'reminder',     channel: 'email', template: 'dunning-reminder-7',   severity: 'low' },
  { daysOverdue: 14, action: 'reminder',     channel: 'email', template: 'dunning-reminder-14',  severity: 'low' },
  { daysOverdue: 30, action: 'warning',      channel: 'email', template: 'dunning-warning-30',   severity: 'medium' },
  { daysOverdue: 45, action: 'warning',      channel: 'phone', template: 'dunning-phone-45',     severity: 'medium' },
  { daysOverdue: 60, action: 'final-notice', channel: 'email', template: 'dunning-final-60',     severity: 'high' },
  { daysOverdue: 75, action: 'final-notice', channel: 'letter', template: 'dunning-letter-75',   severity: 'high' },
  { daysOverdue: 90, action: 'escalation',   channel: 'email', template: 'dunning-escalation-90', severity: 'critical' },
  { daysOverdue: 120, action: 'suspension',  channel: 'email', template: 'dunning-suspend-120',  severity: 'critical' },
]

/**
 * Determine which dunning actions are due for a given overdue invoice.
 */
export function getDueDunningActions(
  daysOverdue: number,
  completedActions: number[] = [],
  schedule: DunningStep[] = STANDARD_DUNNING_SCHEDULE,
): DunningStep[] {
  return schedule.filter(
    (step) => daysOverdue >= step.daysOverdue && !completedActions.includes(step.daysOverdue),
  )
}

// ── Credit management ───────────────────────────────────────────────────────

export interface CustomerCredit {
  customerId: string
  creditLimit: number
  currentBalance: number
  availableCredit: number
  overCreditLimit: boolean
  creditUtilization: number
}

/**
 * Evaluate a customer's credit position against their limit.
 */
export function evaluateCustomerCredit(
  customerId: string,
  creditLimit: number,
  outstandingInvoices: number,
  unappliedCredits: number = 0,
): CustomerCredit {
  const currentBalance = Math.round((outstandingInvoices - unappliedCredits) * 100) / 100
  const available = Math.round((creditLimit - currentBalance) * 100) / 100

  return {
    customerId,
    creditLimit,
    currentBalance,
    availableCredit: Math.max(0, available),
    overCreditLimit: currentBalance > creditLimit,
    creditUtilization: creditLimit > 0 ? Math.round((currentBalance / creditLimit) * 10000) / 10000 : 0,
  }
}
