/**
 * Payroll Provider Sync — ADP / Ceridian Dayforce / Gusto
 *
 * Unified adapter for syncing payroll data (employees, pay runs,
 * deductions, T4/W-2 slips) from external payroll providers.
 * Normalizes data so the CFO payroll-engine can consume it without
 * caring which provider is connected.
 *
 * @module cfo/payroll-provider
 */
import { logger } from '@/lib/logger'

// ── Types ───────────────────────────────────────────────────────────────────

export type PayrollProvider = 'adp' | 'ceridian' | 'gusto' | 'manual'

export interface PayrollProviderConfig {
  provider: PayrollProvider
  baseUrl: string
  clientId: string
  clientSecret: string
  /** ADP certificate thumbprint or Ceridian API key */
  apiKey?: string
}

export interface PayrollTokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  provider: PayrollProvider
}

export interface PayrollEmployee {
  externalId: string
  firstName: string
  lastName: string
  email: string | null
  department: string | null
  jobTitle: string | null
  hireDate: string
  terminationDate: string | null
  status: 'active' | 'terminated' | 'on_leave'
  annualSalary: number | null
  payFrequency: 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly'
  currency: string
  sin?: string
  ssn?: string
  province?: string
  state?: string
}

export interface PayrollPayRun {
  externalId: string
  payDate: string
  periodStart: string
  periodEnd: string
  status: 'draft' | 'processing' | 'complete' | 'void'
  totalGross: number
  totalNet: number
  totalDeductions: number
  totalEmployerCost: number
  currency: string
  entries: PayrollPayEntry[]
}

export interface PayrollPayEntry {
  employeeId: string
  grossPay: number
  netPay: number
  federalTax: number
  provincialTax: number
  cpp: number
  ei: number
  otherDeductions: { name: string; amount: number }[]
  employerCpp: number
  employerEi: number
  employerOther: { name: string; amount: number }[]
}

export interface PayrollTaxSlip {
  externalId: string
  employeeId: string
  type: 'T4' | 'T4A' | 'W2' | 'W2G' | '1099'
  taxYear: number
  grossIncome: number
  taxDeducted: number
  cpp: number
  ei: number
  rpsp: number
  pensionAdjustment: number
  otherBoxes: Record<string, number>
}

export interface PayrollSyncResult {
  provider: PayrollProvider
  employees: { synced: number; errors: string[] }
  payRuns: { synced: number; errors: string[] }
  taxSlips: { synced: number; errors: string[] }
  lastSyncAt: string
}

// ── Provider URLs ───────────────────────────────────────────────────────────

const PROVIDER_DEFAULTS: Record<PayrollProvider, { baseUrl: string; tokenUrl: string }> = {
  adp: {
    baseUrl: 'https://api.adp.com',
    tokenUrl: 'https://accounts.adp.com/auth/oauth/v2/token',
  },
  ceridian: {
    baseUrl: 'https://api.dayforce.com/Api',
    tokenUrl: 'https://dfid.dayforcehcm.com/connect/token',
  },
  gusto: {
    baseUrl: 'https://api.gusto.com/v1',
    tokenUrl: 'https://api.gusto.com/oauth/token',
  },
  manual: {
    baseUrl: '',
    tokenUrl: '',
  },
}

// ── Client ──────────────────────────────────────────────────────────────────

let _config: PayrollProviderConfig | null = null

function getConfig(): PayrollProviderConfig {
  if (_config) return _config

  const provider = (process.env.PAYROLL_PROVIDER ?? 'manual') as PayrollProvider
  if (provider === 'manual') {
    _config = { provider, baseUrl: '', clientId: '', clientSecret: '' }
    return _config
  }

  const clientId = process.env.PAYROLL_CLIENT_ID
  const clientSecret = process.env.PAYROLL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(`Payroll integration requires PAYROLL_CLIENT_ID and PAYROLL_CLIENT_SECRET for ${provider}`)
  }

  _config = {
    provider,
    baseUrl: process.env.PAYROLL_BASE_URL ?? PROVIDER_DEFAULTS[provider].baseUrl,
    clientId,
    clientSecret,
    apiKey: process.env.PAYROLL_API_KEY,
  }

  return _config
}

async function providerRequest<T>(
  endpoint: string,
  tokenSet: PayrollTokenSet,
  options: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const config = getConfig()

  try {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: options.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${tokenSet.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('Payroll provider API error', {
        provider: config.provider,
        endpoint,
        status: response.status,
        body: errorBody,
      })
      return { ok: false, error: `${config.provider} API ${response.status}: ${errorBody}` }
    }

    const data = await response.json() as T
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown payroll provider error'
    logger.error('Payroll provider request failed', { endpoint, error: msg })
    return { ok: false, error: msg }
  }
}

// ── OAuth ───────────────────────────────────────────────────────────────────

export async function authenticate(): Promise<{ ok: true; tokenSet: PayrollTokenSet } | { ok: false; error: string }> {
  const config = getConfig()
  if (config.provider === 'manual') {
    return { ok: true, tokenSet: { accessToken: '', provider: 'manual', expiresAt: Infinity } }
  }

  const defaults = PROVIDER_DEFAULTS[config.provider]

  try {
    const response = await fetch(defaults.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      return { ok: false, error: `Auth failed for ${config.provider}: ${error}` }
    }

    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number }
    return {
      ok: true,
      tokenSet: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        provider: config.provider,
      },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Auth failed' }
  }
}

// ── Sync Operations ─────────────────────────────────────────────────────────

export async function syncEmployees(
  tokenSet: PayrollTokenSet,
): Promise<{ ok: true; employees: PayrollEmployee[] } | { ok: false; error: string }> {
  const endpoints: Record<PayrollProvider, string> = {
    adp: '/hr/v2/workers',
    ceridian: '/V1/Employees',
    gusto: '/companies/current/employees',
    manual: '',
  }

  if (tokenSet.provider === 'manual') {
    return { ok: true, employees: [] }
  }

  const result = await providerRequest<unknown>(endpoints[tokenSet.provider], tokenSet)
  if (!result.ok) return result

  const employees = normalizeEmployees(tokenSet.provider, result.data)
  logger.info('Payroll employees synced', { provider: tokenSet.provider, count: employees.length })
  return { ok: true, employees }
}

export async function syncPayRuns(
  tokenSet: PayrollTokenSet,
  fromDate?: string,
): Promise<{ ok: true; payRuns: PayrollPayRun[] } | { ok: false; error: string }> {
  const endpoints: Record<PayrollProvider, string> = {
    adp: '/payroll/v1/payroll-output',
    ceridian: '/V1/Payroll/PayRuns',
    gusto: '/companies/current/payrolls',
    manual: '',
  }

  if (tokenSet.provider === 'manual') {
    return { ok: true, payRuns: [] }
  }

  const qs = fromDate ? `?from=${fromDate}` : ''
  const result = await providerRequest<unknown>(`${endpoints[tokenSet.provider]}${qs}`, tokenSet)
  if (!result.ok) return result

  const payRuns = normalizePayRuns(tokenSet.provider, result.data)
  logger.info('Payroll pay runs synced', { provider: tokenSet.provider, count: payRuns.length })
  return { ok: true, payRuns }
}

export async function syncTaxSlips(
  tokenSet: PayrollTokenSet,
  taxYear: number,
): Promise<{ ok: true; slips: PayrollTaxSlip[] } | { ok: false; error: string }> {
  const endpoints: Record<PayrollProvider, string> = {
    adp: `/payroll/v1/tax-statements/${taxYear}`,
    ceridian: `/V1/TaxForms?year=${taxYear}`,
    gusto: `/companies/current/forms?year=${taxYear}`,
    manual: '',
  }

  if (tokenSet.provider === 'manual') {
    return { ok: true, slips: [] }
  }

  const result = await providerRequest<unknown>(endpoints[tokenSet.provider], tokenSet)
  if (!result.ok) return result

  const slips = normalizeTaxSlips(tokenSet.provider, result.data)
  logger.info('Tax slips synced', { provider: tokenSet.provider, year: taxYear, count: slips.length })
  return { ok: true, slips }
}

// ── Full Sync ───────────────────────────────────────────────────────────────

export async function fullPayrollSync(
  tokenSet: PayrollTokenSet,
  options?: { fromDate?: string; taxYear?: number },
): Promise<PayrollSyncResult> {
  const result: PayrollSyncResult = {
    provider: tokenSet.provider,
    employees: { synced: 0, errors: [] },
    payRuns: { synced: 0, errors: [] },
    taxSlips: { synced: 0, errors: [] },
    lastSyncAt: new Date().toISOString(),
  }

  const empResult = await syncEmployees(tokenSet)
  if (empResult.ok) {
    result.employees.synced = empResult.employees.length
  } else {
    result.employees.errors.push(empResult.error)
  }

  const prResult = await syncPayRuns(tokenSet, options?.fromDate)
  if (prResult.ok) {
    result.payRuns.synced = prResult.payRuns.length
  } else {
    result.payRuns.errors.push(prResult.error)
  }

  if (options?.taxYear) {
    const tsResult = await syncTaxSlips(tokenSet, options.taxYear)
    if (tsResult.ok) {
      result.taxSlips.synced = tsResult.slips.length
    } else {
      result.taxSlips.errors.push(tsResult.error)
    }
  }

  logger.info('Full payroll sync complete', result as unknown as Record<string, unknown>)
  return result
}

// ── Normalizers ─────────────────────────────────────────────────────────────

function normalizeEmployees(provider: PayrollProvider, raw: unknown): PayrollEmployee[] {
  if (!raw || !Array.isArray(raw)) return []

  return (raw as Record<string, unknown>[]).map((r): PayrollEmployee => {
    switch (provider) {
      case 'adp':
        return {
          externalId: String(r.associateOID ?? ''),
          firstName: String(((r.person as Record<string, unknown>)?.legalName as Record<string, unknown>)?.givenName ?? ''),
          lastName: String(((r.person as Record<string, unknown>)?.legalName as Record<string, unknown>)?.familyName1 ?? ''),
          email: null,
          department: null,
          jobTitle: null,
          hireDate: String((r.workerDates as Record<string, unknown>)?.originalHireDate ?? ''),
          terminationDate: null,
          status: 'active',
          annualSalary: null,
          payFrequency: 'biweekly',
          currency: 'CAD',
        }
      case 'ceridian':
        return {
          externalId: String(r.XRefCode ?? ''),
          firstName: String(r.FirstName ?? ''),
          lastName: String(r.LastName ?? ''),
          email: String(r.LoginId ?? ''),
          department: String(r.DepartmentCode ?? ''),
          jobTitle: String(r.JobTitle ?? ''),
          hireDate: String(r.HireDate ?? ''),
          terminationDate: r.TerminationDate ? String(r.TerminationDate) : null,
          status: r.EmploymentStatusCode === 'Active' ? 'active' : 'terminated',
          annualSalary: Number(r.BaseSalary ?? 0),
          payFrequency: 'biweekly',
          currency: String(r.Currency ?? 'CAD'),
        }
      case 'gusto':
        return {
          externalId: String(r.id ?? ''),
          firstName: String(r.first_name ?? ''),
          lastName: String(r.last_name ?? ''),
          email: String(r.email ?? ''),
          department: String(r.department ?? ''),
          jobTitle: null,
          hireDate: String(r.date_of_birth ?? ''),
          terminationDate: r.terminated ? String(r.termination_date ?? '') : null,
          status: r.terminated ? 'terminated' : 'active',
          annualSalary: null,
          payFrequency: 'biweekly',
          currency: 'USD',
        }
      default:
        return {
          externalId: String(r.id ?? ''),
          firstName: String(r.firstName ?? ''),
          lastName: String(r.lastName ?? ''),
          email: null,
          department: null,
          jobTitle: null,
          hireDate: '',
          terminationDate: null,
          status: 'active',
          annualSalary: null,
          payFrequency: 'biweekly',
          currency: 'CAD',
        }
    }
  })
}

function normalizePayRuns(_provider: PayrollProvider, raw: unknown): PayrollPayRun[] {
  if (!raw || !Array.isArray(raw)) return []
  return (raw as Record<string, unknown>[]).map((r): PayrollPayRun => ({
    externalId: String(r.id ?? r.payRunId ?? ''),
    payDate: String(r.payDate ?? r.check_date ?? ''),
    periodStart: String(r.periodStart ?? (r.pay_period as Record<string, unknown>)?.start_date ?? ''),
    periodEnd: String(r.periodEnd ?? (r.pay_period as Record<string, unknown>)?.end_date ?? ''),
    status: 'complete',
    totalGross: Number(r.totalGross ?? r.gross_pay ?? 0),
    totalNet: Number(r.totalNet ?? r.net_pay ?? 0),
    totalDeductions: Number(r.totalDeductions ?? 0),
    totalEmployerCost: Number(r.totalEmployerCost ?? 0),
    currency: String(r.currency ?? 'CAD'),
    entries: [],
  }))
}

function normalizeTaxSlips(_provider: PayrollProvider, raw: unknown): PayrollTaxSlip[] {
  if (!raw || !Array.isArray(raw)) return []
  return (raw as Record<string, unknown>[]).map((r): PayrollTaxSlip => ({
    externalId: String(r.id ?? ''),
    employeeId: String(r.employeeId ?? r.employee_id ?? ''),
    type: 'T4',
    taxYear: Number(r.taxYear ?? r.year ?? new Date().getFullYear()),
    grossIncome: Number(r.grossIncome ?? r.wages ?? 0),
    taxDeducted: Number(r.taxDeducted ?? r.federal_tax ?? 0),
    cpp: Number(r.cpp ?? r.social_security ?? 0),
    ei: Number(r.ei ?? 0),
    rpsp: Number(r.rpsp ?? 0),
    pensionAdjustment: Number(r.pensionAdjustment ?? 0),
    otherBoxes: {},
  }))
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function checkPayrollProviderHealth(): Promise<{
  healthy: boolean
  provider: PayrollProvider
  error?: string
}> {
  const config = getConfig()
  if (config.provider === 'manual') return { healthy: true, provider: 'manual' }

  const authResult = await authenticate()
  if (!authResult.ok) return { healthy: false, provider: config.provider, error: authResult.error }
  return { healthy: true, provider: config.provider }
}
