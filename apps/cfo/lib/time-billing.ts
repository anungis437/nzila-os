/**
 * Time & Billing Engine — Professional Services
 *
 * Full WIP-to-Invoice lifecycle for accounting firms:
 * - Time entries with staff/activity tracking
 * - WIP (Work-in-Progress) valuation
 * - Billing rate tiers (staff → partner)
 * - Invoice generation from WIP
 * - Realization & utilization metrics
 * - Budget vs actual tracking
 *
 * Designed for Canadian accounting firms (CPA conventions).
 *
 * @module cfo/time-billing
 */

import { z } from 'zod'

// ── Enums & Constants ───────────────────────────────────────────────────────

export const StaffLevel = {
  ADMIN: 'admin',
  JUNIOR: 'junior',
  INTERMEDIATE: 'intermediate',
  SENIOR: 'senior',
  MANAGER: 'manager',
  DIRECTOR: 'director',
  PARTNER: 'partner',
} as const

export type StaffLevel = (typeof StaffLevel)[keyof typeof StaffLevel]

export const ActivityCode = {
  // Core categories per CPA practice management
  TAX_PREP: 'tax-prep',
  TAX_REVIEW: 'tax-review',
  TAX_PLANNING: 'tax-planning',
  AUDIT_FIELDWORK: 'audit-fieldwork',
  AUDIT_REVIEW: 'audit-review',
  BOOKKEEPING: 'bookkeeping',
  NTR_COMPILATION: 'ntr-compilation',
  ADVISORY: 'advisory',
  CONSULTATION: 'consultation',
  ADMIN: 'admin',
  RESEARCH: 'research',
  CORRESPONDENCE: 'correspondence',
  TRAINING: 'training',
  TRAVEL: 'travel',
  WRITE_OFF: 'write-off',
} as const

export type ActivityCode = (typeof ActivityCode)[keyof typeof ActivityCode]

export const TimeEntryStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  BILLED: 'billed',
  WRITTEN_OFF: 'written-off',
} as const

export type TimeEntryStatus = (typeof TimeEntryStatus)[keyof typeof TimeEntryStatus]

export const InvoiceStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  PARTIALLY_PAID: 'partially-paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  VOID: 'void',
} as const

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]

/** Standard billing rates by level (CAD/hour). Firms override these. */
export const DEFAULT_BILLING_RATES: Record<StaffLevel, number> = {
  admin: 75,
  junior: 125,
  intermediate: 175,
  senior: 225,
  manager: 300,
  director: 375,
  partner: 450,
}

// ── Schemas ─────────────────────────────────────────────────────────────────

export const TimeEntrySchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  staffId: z.string().uuid(),
  staffLevel: z.nativeEnum(StaffLevel as unknown as Record<string, string>),
  clientId: z.string().uuid(),
  engagementId: z.string().uuid(),
  activityCode: z.nativeEnum(ActivityCode as unknown as Record<string, string>),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0).max(24),
  description: z.string().min(1).max(500),
  billingRate: z.number().min(0),
  status: z.nativeEnum(TimeEntryStatus as unknown as Record<string, string>),
  nonBillable: z.boolean().default(false),
})

export type TimeEntry = z.infer<typeof TimeEntrySchema>

export const EngagementBudgetSchema = z.object({
  engagementId: z.string().uuid(),
  budgetHours: z.number().min(0),
  budgetFees: z.number().min(0),
  fixedFee: z.number().min(0).optional(),
  isFixedFee: z.boolean().default(false),
})

export type EngagementBudget = z.infer<typeof EngagementBudgetSchema>

// ── WIP (Work-in-Progress) ──────────────────────────────────────────────────

export interface WipSummary {
  engagementId: string
  clientId: string
  totalHours: number
  billableHours: number
  nonBillableHours: number
  wipValue: number
  /** WIP at standard rates (before write-downs) */
  wipAtStandardRate: number
  /** Approved but not yet billed */
  approvedWip: number
  /** Number of entries in each status */
  statusCounts: Record<TimeEntryStatus, number>
}

/**
 * Calculate WIP for an engagement from time entries.
 */
export function calculateWip(entries: TimeEntry[], engagementId: string): WipSummary {
  const engEntries = entries.filter((e) => e.engagementId === engagementId)

  const statusCounts = {
    draft: 0,
    submitted: 0,
    approved: 0,
    billed: 0,
    'written-off': 0,
  } as Record<TimeEntryStatus, number>

  let totalHours = 0
  let billableHours = 0
  let nonBillableHours = 0
  let wipValue = 0
  let wipAtStandardRate = 0
  let approvedWip = 0

  for (const entry of engEntries) {
    statusCounts[entry.status as TimeEntryStatus]++
    totalHours += entry.hours
    if (entry.nonBillable) {
      nonBillableHours += entry.hours
    } else {
      billableHours += entry.hours
      const value = entry.hours * entry.billingRate
      wipAtStandardRate += value

      if (entry.status !== 'billed' && entry.status !== 'written-off') {
        wipValue += value
      }
      if (entry.status === 'approved') {
        approvedWip += value
      }
    }
  }

  return {
    engagementId,
    clientId: engEntries[0]?.clientId ?? '',
    totalHours,
    billableHours,
    nonBillableHours,
    wipValue,
    wipAtStandardRate,
    approvedWip,
    statusCounts,
  }
}

// ── Invoice Generation ──────────────────────────────────────────────────────

export interface InvoiceLine {
  description: string
  hours: number
  rate: number
  amount: number
  timeEntryIds: string[]
}

export interface Invoice {
  id: string
  orgId: string
  clientId: string
  engagementId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  lines: InvoiceLine[]
  subtotal: number
  hstGstRate: number
  hstGstAmount: number
  total: number
  status: InvoiceStatus
  /** Write-down amount (difference from standard billing) */
  writeDown: number
}

/**
 * Generate an invoice from approved time entries.
 *
 * Groups entries by staff level for clean line items.
 * Applies optional fixed-fee cap.
 */
export function generateInvoice(params: {
  entries: TimeEntry[]
  engagementId: string
  orgId: string
  clientId: string
  invoiceNumber: string
  invoiceDate: string
  paymentTermDays: number
  hstGstRate: number
  fixedFee?: number
}): Invoice {
  const billable = params.entries.filter(
    (e) =>
      e.engagementId === params.engagementId &&
      e.status === 'approved' &&
      !e.nonBillable,
  )

  // Group by staff level for clean invoice lines
  const byLevel = new Map<string, { hours: number; rate: number; entryIds: string[] }>()
  for (const entry of billable) {
    const key = entry.staffLevel
    const group = byLevel.get(key) ?? { hours: 0, rate: entry.billingRate, entryIds: [] }
    group.hours += entry.hours
    // Weighted average rate if rates differ within same level
    group.rate = (group.rate * (group.hours - entry.hours) + entry.billingRate * entry.hours) / group.hours
    group.entryIds.push(entry.id)
    byLevel.set(key, group)
  }

  const lines: InvoiceLine[] = []
  let subtotal = 0
  for (const [level, group] of byLevel) {
    const amount = Math.round(group.hours * group.rate * 100) / 100
    subtotal += amount
    lines.push({
      description: `Professional services — ${level}`,
      hours: group.hours,
      rate: Math.round(group.rate * 100) / 100,
      amount,
      timeEntryIds: group.entryIds,
    })
  }

  // Fixed-fee cap
  let writeDown = 0
  if (params.fixedFee !== undefined && subtotal > params.fixedFee) {
    writeDown = subtotal - params.fixedFee
    subtotal = params.fixedFee
  }

  const hstGstAmount = Math.round(subtotal * params.hstGstRate * 100) / 100
  const total = subtotal + hstGstAmount

  const dueDate = new Date(params.invoiceDate)
  dueDate.setDate(dueDate.getDate() + params.paymentTermDays)

  return {
    id: crypto.randomUUID(),
    orgId: params.orgId,
    clientId: params.clientId,
    engagementId: params.engagementId,
    invoiceNumber: params.invoiceNumber,
    invoiceDate: params.invoiceDate,
    dueDate: dueDate.toISOString().slice(0, 10),
    lines,
    subtotal,
    hstGstRate: params.hstGstRate,
    hstGstAmount,
    total,
    status: 'draft',
    writeDown,
  }
}

// ── Realization & Utilization Metrics ───────────────────────────────────────

export interface RealizationMetrics {
  /** Standard billing value (hours × rate) */
  standardBilling: number
  /** Actual billed amount (after write-downs) */
  actualBilled: number
  /** Realization rate (actual / standard) */
  realizationRate: number
  /** Collection rate (collected / billed) — needs payment data */
  collectionRate: number | null
  /** Average effective rate per hour */
  effectiveRate: number
}

export interface UtilizationMetrics {
  /** Total hours worked */
  totalHours: number
  /** Billable hours */
  billableHours: number
  /** Non-billable hours */
  nonBillableHours: number
  /** Utilization rate (billable / total) */
  utilizationRate: number
  /** Available hours (working days × 8) */
  availableHours: number
  /** Capacity utilization (total / available) */
  capacityUtilization: number
}

/**
 * Calculate realization metrics for an engagement or period.
 */
export function calculateRealization(
  entries: TimeEntry[],
  billedAmount: number,
  collectedAmount?: number,
): RealizationMetrics {
  const billableEntries = entries.filter((e) => !e.nonBillable)
  const standardBilling = billableEntries.reduce(
    (sum, e) => sum + e.hours * e.billingRate,
    0,
  )
  const billableHours = billableEntries.reduce((sum, e) => sum + e.hours, 0)

  return {
    standardBilling,
    actualBilled: billedAmount,
    realizationRate: standardBilling > 0 ? billedAmount / standardBilling : 0,
    collectionRate:
      collectedAmount !== undefined && billedAmount > 0
        ? collectedAmount / billedAmount
        : null,
    effectiveRate: billableHours > 0 ? billedAmount / billableHours : 0,
  }
}

/**
 * Calculate utilization metrics for a staff member over a period.
 */
export function calculateUtilization(
  entries: TimeEntry[],
  workingDays: number,
): UtilizationMetrics {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const billableHours = entries
    .filter((e) => !e.nonBillable)
    .reduce((sum, e) => sum + e.hours, 0)
  const nonBillableHours = totalHours - billableHours
  const availableHours = workingDays * 8

  return {
    totalHours,
    billableHours,
    nonBillableHours,
    utilizationRate: totalHours > 0 ? billableHours / totalHours : 0,
    availableHours,
    capacityUtilization: availableHours > 0 ? totalHours / availableHours : 0,
  }
}

// ── Budget vs Actual ────────────────────────────────────────────────────────

export interface BudgetVariance {
  engagementId: string
  budgetHours: number
  actualHours: number
  hoursVariance: number
  hoursVariancePct: number
  budgetFees: number
  actualFees: number
  feesVariance: number
  feesVariancePct: number
  isOverBudget: boolean
  completionPct: number
}

/**
 * Calculate budget vs actual variance for an engagement.
 */
export function calculateBudgetVariance(
  budget: EngagementBudget,
  entries: TimeEntry[],
  estimatedCompletionPct: number,
): BudgetVariance {
  const engEntries = entries.filter((e) => e.engagementId === budget.engagementId)
  const actualHours = engEntries.reduce((sum, e) => sum + e.hours, 0)
  const actualFees = engEntries
    .filter((e) => !e.nonBillable)
    .reduce((sum, e) => sum + e.hours * e.billingRate, 0)

  const targetFees = budget.isFixedFee && budget.fixedFee ? budget.fixedFee : budget.budgetFees
  const hoursVariance = actualHours - budget.budgetHours
  const feesVariance = actualFees - targetFees

  return {
    engagementId: budget.engagementId,
    budgetHours: budget.budgetHours,
    actualHours,
    hoursVariance,
    hoursVariancePct: budget.budgetHours > 0 ? hoursVariance / budget.budgetHours : 0,
    budgetFees: targetFees,
    actualFees,
    feesVariance,
    feesVariancePct: targetFees > 0 ? feesVariance / targetFees : 0,
    isOverBudget: hoursVariance > 0 || feesVariance > 0,
    completionPct: estimatedCompletionPct,
  }
}

// ── Aging Report ────────────────────────────────────────────────────────────

export interface AgingBucket {
  label: string
  minDays: number
  maxDays: number
  amount: number
  count: number
  invoiceIds: string[]
}

/**
 * Generate an accounts receivable aging report.
 */
export function generateAgingReport(
  invoices: Invoice[],
  asOfDate: string,
): { buckets: AgingBucket[]; totalOutstanding: number } {
  const asOf = new Date(asOfDate).getTime()

  const bucketDefs = [
    { label: 'Current', minDays: 0, maxDays: 30 },
    { label: '31–60 days', minDays: 31, maxDays: 60 },
    { label: '61–90 days', minDays: 61, maxDays: 90 },
    { label: '91–120 days', minDays: 91, maxDays: 120 },
    { label: '120+ days', minDays: 121, maxDays: Infinity },
  ]

  const buckets: AgingBucket[] = bucketDefs.map((d) => ({
    ...d,
    amount: 0,
    count: 0,
    invoiceIds: [],
  }))

  let totalOutstanding = 0
  const outstanding = invoices.filter(
    (inv) => inv.status === 'sent' || inv.status === 'partially-paid' || inv.status === 'overdue',
  )

  for (const inv of outstanding) {
    const daysPast = Math.floor(
      (asOf - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24),
    )
    const daysForBucket = Math.max(0, daysPast)
    const bucket = buckets.find(
      (b) => daysForBucket >= b.minDays && daysForBucket <= b.maxDays,
    )!
    bucket.amount += inv.total
    bucket.count++
    bucket.invoiceIds.push(inv.id)
    totalOutstanding += inv.total
  }

  return { buckets, totalOutstanding }
}
