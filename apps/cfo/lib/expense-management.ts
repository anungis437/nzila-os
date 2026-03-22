/**
 * Expense Management — Expensify / SAP Concur
 *
 * Unified adapter for syncing expense reports, claims, and policies
 * from external expense management platforms. Normalizes line items
 * for GL posting and policy compliance checks.
 *
 * @module cfo/expense-management
 */
import { logger } from '@/lib/logger'

// ── Types ───────────────────────────────────────────────────────────────────

export type ExpenseProvider = 'expensify' | 'concur' | 'manual'

export interface ExpenseProviderConfig {
  provider: ExpenseProvider
  baseUrl: string
  apiKey: string
  apiSecret: string
}

export interface ExpenseReport {
  externalId: string
  provider: ExpenseProvider
  employeeId: string
  employeeName: string
  title: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed'
  submittedAt: string | null
  approvedAt: string | null
  totalAmount: number
  currency: string
  expenses: ExpenseLineItem[]
  policyViolations: string[]
}

export interface ExpenseLineItem {
  externalId: string
  date: string
  merchant: string
  category: string
  description: string
  amount: number
  currency: string
  receiptUrl: string | null
  isBillable: boolean
  projectCode: string | null
  accountCode: string | null
  taxAmount: number
  tags: string[]
}

export interface ExpensePolicy {
  id: string
  name: string
  maxSingleExpense: number
  requireReceipt: boolean
  receiptThreshold: number
  allowedCategories: string[]
  approvalThresholds: { amount: number; approverLevel: string }[]
}

export interface ExpenseSyncResult {
  provider: ExpenseProvider
  reports: { synced: number; errors: string[] }
  expenses: { synced: number; errors: string[] }
  lastSyncAt: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const PROVIDER_URLS: Record<ExpenseProvider, string> = {
  expensify: 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations',
  concur: 'https://us.api.concursolutions.com',
  manual: '',
}

const EXPENSE_GL_CATEGORY_MAP: Record<string, string> = {
  'Travel': '6200',
  'Meals': '6210',
  'Entertainment': '6220',
  'Office Supplies': '6300',
  'Software': '6310',
  'Professional Development': '6400',
  'Telephone': '6500',
  'Parking': '6210',
  'Mileage': '6200',
  'Accommodation': '6200',
  'Other': '6900',
}

// ── Client ──────────────────────────────────────────────────────────────────

let _config: ExpenseProviderConfig | null = null

function getConfig(): ExpenseProviderConfig {
  if (_config) return _config

  const provider = (process.env.EXPENSE_PROVIDER ?? 'manual') as ExpenseProvider
  if (provider === 'manual') {
    _config = { provider, baseUrl: '', apiKey: '', apiSecret: '' }
    return _config
  }

  const apiKey = process.env.EXPENSE_API_KEY
  const apiSecret = process.env.EXPENSE_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error(`Expense integration requires EXPENSE_API_KEY and EXPENSE_API_SECRET for ${provider}`)
  }

  _config = {
    provider,
    baseUrl: process.env.EXPENSE_BASE_URL ?? PROVIDER_URLS[provider],
    apiKey,
    apiSecret,
  }

  return _config
}

async function expenseRequest<T>(
  endpoint: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const config = getConfig()

  try {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('Expense provider API error', {
        provider: config.provider,
        endpoint,
        status: response.status,
      })
      return { ok: false, error: `${config.provider} API ${response.status}: ${errorBody}` }
    }

    const data = await response.json() as T
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown expense provider error'
    logger.error('Expense request failed', { endpoint, error: msg })
    return { ok: false, error: msg }
  }
}

// ── Expensify ───────────────────────────────────────────────────────────────

async function fetchExpensifyReports(): Promise<{ ok: true; reports: ExpenseReport[] } | { ok: false; error: string }> {
  const config = getConfig()

  const result = await expenseRequest<{ responseCode: number; data: unknown[] }>('', {
    method: 'POST',
    body: {
      type: 'get',
      credentials: { partnerUserID: config.apiKey, partnerUserSecret: config.apiSecret },
      inputSettings: {
        type: 'combinedReportData',
        filters: { startDate: '', approved: '' },
      },
    },
  })

  if (!result.ok) return result
  return { ok: true, reports: normalizeExpensifyReports(result.data.data) }
}

function normalizeExpensifyReports(raw: unknown[]): ExpenseReport[] {
  return (raw as Record<string, unknown>[]).map((r): ExpenseReport => ({
    externalId: String(r.reportID ?? ''),
    provider: 'expensify',
    employeeId: String(r.submitter ?? ''),
    employeeName: String(r.submitterName ?? ''),
    title: String(r.reportName ?? ''),
    status: mapExpensifyStatus(String(r.status ?? '')),
    submittedAt: r.submitted ? String(r.submitted) : null,
    approvedAt: r.approved ? String(r.approved) : null,
    totalAmount: Number(r.total ?? 0) / 100,
    currency: String(r.currency ?? 'CAD'),
    expenses: normalizeExpensifyLineItems(r.transactionList as unknown[] ?? []),
    policyViolations: [],
  }))
}

function mapExpensifyStatus(status: string): ExpenseReport['status'] {
  const map: Record<string, ExpenseReport['status']> = {
    Open: 'draft',
    Submitted: 'submitted',
    Approved: 'approved',
    Reimbursed: 'reimbursed',
    Rejected: 'rejected',
  }
  return map[status] ?? 'draft'
}

function normalizeExpensifyLineItems(raw: unknown[]): ExpenseLineItem[] {
  return (raw as Record<string, unknown>[]).map((t): ExpenseLineItem => ({
    externalId: String(t.transactionID ?? ''),
    date: String(t.created ?? ''),
    merchant: String(t.merchant ?? ''),
    category: String(t.category ?? 'Other'),
    description: String(t.comment ?? ''),
    amount: Number(t.amount ?? 0) / 100,
    currency: String(t.currency ?? 'CAD'),
    receiptUrl: (t.receipt as Record<string, unknown>)?.url ? String((t.receipt as Record<string, unknown>).url) : null,
    isBillable: Boolean(t.billable),
    projectCode: t.tag ? String(t.tag) : null,
    accountCode: mapExpenseCategoryToGL(String(t.category ?? 'Other')),
    taxAmount: Number(t.taxAmount ?? 0) / 100,
    tags: [],
  }))
}

// ── Concur ──────────────────────────────────────────────────────────────────

async function fetchConcurReports(): Promise<{ ok: true; reports: ExpenseReport[] } | { ok: false; error: string }> {
  const config = getConfig()

  const result = await expenseRequest<{ Items: unknown[] }>('/api/v3.0/expense/reports', {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  })

  if (!result.ok) return result
  return { ok: true, reports: normalizeConcurReports(result.data.Items) }
}

function normalizeConcurReports(raw: unknown[]): ExpenseReport[] {
  return (raw as Record<string, unknown>[]).map((r): ExpenseReport => ({
    externalId: String(r.ID ?? ''),
    provider: 'concur',
    employeeId: String(r.OwnerLoginID ?? ''),
    employeeName: String(r.OwnerName ?? ''),
    title: String(r.Name ?? ''),
    status: mapConcurStatus(String(r.ApprovalStatusName ?? '')),
    submittedAt: r.SubmitDate ? String(r.SubmitDate) : null,
    approvedAt: r.ApprovedDate ? String(r.ApprovedDate) : null,
    totalAmount: Number(r.Total ?? 0),
    currency: String(r.CurrencyCode ?? 'CAD'),
    expenses: [],
    policyViolations: [],
  }))
}

function mapConcurStatus(status: string): ExpenseReport['status'] {
  const map: Record<string, ExpenseReport['status']> = {
    'Not Submitted': 'draft',
    'Submitted & Pending Approval': 'submitted',
    'Approved': 'approved',
    'Sent for Payment': 'reimbursed',
    'Rejected': 'rejected',
  }
  return map[status] ?? 'draft'
}

// ── Unified API ─────────────────────────────────────────────────────────────

export async function fetchExpenseReports(): Promise<{
  ok: true
  reports: ExpenseReport[]
} | { ok: false; error: string }> {
  const config = getConfig()

  switch (config.provider) {
    case 'expensify':
      return fetchExpensifyReports()
    case 'concur':
      return fetchConcurReports()
    case 'manual':
      return { ok: true, reports: [] }
  }
}

/**
 * Validate an expense report against policy rules.
 */
export function validateAgainstPolicy(
  report: ExpenseReport,
  policy: ExpensePolicy,
): { valid: boolean; violations: string[] } {
  const violations: string[] = []

  for (const expense of report.expenses) {
    if (expense.amount > policy.maxSingleExpense) {
      violations.push(`${expense.merchant}: $${expense.amount} exceeds max $${policy.maxSingleExpense}`)
    }

    if (policy.requireReceipt && expense.amount > policy.receiptThreshold && !expense.receiptUrl) {
      violations.push(`${expense.merchant}: receipt required for expenses over $${policy.receiptThreshold}`)
    }

    if (policy.allowedCategories.length > 0 && !policy.allowedCategories.includes(expense.category)) {
      violations.push(`${expense.merchant}: category "${expense.category}" not allowed`)
    }
  }

  return { valid: violations.length === 0, violations }
}

/**
 * Map an expense category to a GL account code.
 */
export function mapExpenseCategoryToGL(category: string): string {
  return EXPENSE_GL_CATEGORY_MAP[category] ?? EXPENSE_GL_CATEGORY_MAP['Other'] ?? '6900'
}

/**
 * Convert an expense report to GL journal entries.
 */
export function toJournalEntries(report: ExpenseReport): {
  date: string
  reference: string
  description: string
  lines: { accountCode: string; debit: number; credit: number; description: string }[]
}[] {
  return report.expenses.map((expense) => ({
    date: expense.date,
    reference: `EXP-${report.externalId}-${expense.externalId}`,
    description: `${expense.merchant} — ${expense.category}`,
    lines: [
      {
        accountCode: expense.accountCode ?? mapExpenseCategoryToGL(expense.category),
        debit: expense.amount - expense.taxAmount,
        credit: 0,
        description: expense.description,
      },
      ...(expense.taxAmount > 0
        ? [{
            accountCode: '2300', // GST/HST Input Tax Credit
            debit: expense.taxAmount,
            credit: 0,
            description: `Tax — ${expense.merchant}`,
          }]
        : []),
      {
        accountCode: '2100', // Accounts Payable / Employee Reimbursement
        debit: 0,
        credit: expense.amount,
        description: `Payable — ${expense.merchant}`,
      },
    ],
  }))
}

/**
 * Full expense sync — fetch all reports and validate.
 */
export async function fullExpenseSync(
  policy?: ExpensePolicy,
): Promise<ExpenseSyncResult> {
  const config = getConfig()
  const result: ExpenseSyncResult = {
    provider: config.provider,
    reports: { synced: 0, errors: [] },
    expenses: { synced: 0, errors: [] },
    lastSyncAt: new Date().toISOString(),
  }

  const reportsResult = await fetchExpenseReports()
  if (!reportsResult.ok) {
    result.reports.errors.push(reportsResult.error)
    return result
  }

  result.reports.synced = reportsResult.reports.length
  result.expenses.synced = reportsResult.reports.reduce((sum, r) => sum + r.expenses.length, 0)

  if (policy) {
    for (const report of reportsResult.reports) {
      const validation = validateAgainstPolicy(report, policy)
      if (!validation.valid) {
        report.policyViolations = validation.violations
      }
    }
  }

  logger.info('Expense sync complete', {
    provider: config.provider,
    reports: result.reports.synced,
    expenses: result.expenses.synced,
  })

  return result
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function checkExpenseProviderHealth(): Promise<{
  healthy: boolean
  provider: ExpenseProvider
  error?: string
}> {
  const config = getConfig()
  if (config.provider === 'manual') return { healthy: true, provider: 'manual' }

  const result = await fetchExpenseReports()
  if (!result.ok) return { healthy: false, provider: config.provider, error: result.error }
  return { healthy: true, provider: config.provider }
}
