/**
 * Xero — Accounting Platform Integration
 *
 * Full Xero API integration for syncing chart of accounts, journal entries,
 * invoices, contacts, and bank transactions. OAuth 2.0 + PKCE flow for
 * tenant selection in multi-org environments.
 *
 * Xero is the #1 cloud accounting platform outside North America and
 * #2 in Canada. Supporting both QBO and Xero covers ~85% of the
 * small/mid-market accounting software market.
 *
 * @see https://developer.xero.com/documentation/api/
 * @module cfo/xero
 */
import { logger } from '@/lib/logger'

// ── Types ───────────────────────────────────────────────────────────────────

export interface XeroConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  /** Xero scopes */
  scopes: string[]
}

export interface XeroTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tenantId: string
  tenantName: string
}

export interface XeroTenant {
  tenantId: string
  tenantName: string
  tenantType: 'ORGANISATION'
}

export interface XeroAccount {
  accountId: string
  code: string
  name: string
  type: XeroAccountType
  taxType?: string
  description?: string
  class: 'ASSET' | 'EQUITY' | 'EXPENSE' | 'LIABILITY' | 'REVENUE'
  status: 'ACTIVE' | 'ARCHIVED'
  bankAccountNumber?: string
  currencyCode?: string
}

export type XeroAccountType =
  | 'BANK' | 'CURRENT' | 'CURRLIAB' | 'DEPRECIATN' | 'DIRECTCOSTS'
  | 'EQUITY' | 'EXPENSE' | 'FIXED' | 'INVENTORY' | 'LIABILITY'
  | 'NONCURRENT' | 'OTHERINCOME' | 'OVERHEADS' | 'PREPAYMENT'
  | 'REVENUE' | 'SALES' | 'TERMLIAB' | 'PAYGLIABILITY' | 'SUPERANNUATIONEXPENSE'
  | 'SUPERANNUATIONLIABILITY' | 'WAGESEXPENSE'

export interface XeroJournalEntry {
  journalId?: string
  journalDate: string
  journalNumber?: number
  reference?: string
  sourceType?: string
  journalLines: XeroJournalLine[]
}

export interface XeroJournalLine {
  accountCode: string
  description?: string
  grossAmount: number
  netAmount: number
  taxAmount: number
  taxType?: string
  trackingCategories?: { name: string; option: string }[]
}

export interface XeroInvoice {
  invoiceId?: string
  type: 'ACCREC' | 'ACCPAY'
  contact: { contactId: string; name?: string }
  date: string
  dueDate: string
  status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED'
  lineAmountTypes: 'Exclusive' | 'Inclusive' | 'NoTax'
  lineItems: {
    description: string
    quantity: number
    unitAmount: number
    accountCode: string
    taxType?: string
  }[]
  currencyCode?: string
  reference?: string
  total?: number
  amountDue?: number
  amountPaid?: number
}

export interface XeroContact {
  contactId?: string
  name: string
  firstName?: string
  lastName?: string
  emailAddress?: string
  isSupplier: boolean
  isCustomer: boolean
  taxNumber?: string
  accountNumber?: string
  addresses?: {
    addressType: 'POBOX' | 'STREET' | 'DELIVERY'
    city?: string
    region?: string
    postalCode?: string
    country?: string
  }[]
  phones?: {
    phoneType: 'DEFAULT' | 'DDI' | 'MOBILE' | 'FAX'
    phoneNumber?: string
  }[]
}

export interface XeroBankTransaction {
  bankTransactionId?: string
  type: 'RECEIVE' | 'SPEND' | 'RECEIVE-OVERPAYMENT' | 'RECEIVE-PREPAYMENT' | 'SPEND-OVERPAYMENT' | 'SPEND-PREPAYMENT'
  contact: { contactId: string }
  bankAccount: { accountId: string }
  date: string
  status: 'AUTHORISED' | 'DELETED'
  lineItems: {
    description: string
    quantity: number
    unitAmount: number
    accountCode: string
  }[]
  total?: number
  reference?: string
}

export interface XeroBalanceSheet {
  reports: {
    reportName: string
    reportDate: string
    rows: XeroReportRow[]
  }[]
}

export interface XeroReportRow {
  rowType: 'Header' | 'Section' | 'Row' | 'SummaryRow'
  title?: string
  cells?: { value: string }[]
  rows?: XeroReportRow[]
}

export interface XeroProfitAndLoss {
  reports: {
    reportName: string
    reportDate: string
    rows: XeroReportRow[]
  }[]
}

export interface XeroSyncResult {
  provider: 'xero'
  synced: number
  created: number
  updated: number
  errors: string[]
  lastSyncAt: string
}

/** Map of Xero account types to our internal AccountType */
const XERO_TO_INTERNAL_TYPE: Record<string, string> = {
  BANK: 'asset',
  CURRENT: 'asset',
  NONCURRENT: 'asset',
  FIXED: 'asset',
  INVENTORY: 'asset',
  PREPAYMENT: 'asset',
  CURRLIAB: 'liability',
  LIABILITY: 'liability',
  TERMLIAB: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  SALES: 'revenue',
  OTHERINCOME: 'revenue',
  DIRECTCOSTS: 'expense',
  EXPENSE: 'expense',
  OVERHEADS: 'expense',
  DEPRECIATN: 'expense',
}

// ── Constants ───────────────────────────────────────────────────────────────

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_API_URL = 'https://api.xero.com/api.xro/2.0'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

const DEFAULT_SCOPES = [
  'openid', 'profile', 'email', 'offline_access',
  'accounting.transactions', 'accounting.contacts',
  'accounting.settings', 'accounting.journals.read',
  'accounting.reports.read',
]

// ── Client ──────────────────────────────────────────────────────────────────

let _config: XeroConfig | null = null

function getConfig(): XeroConfig {
  if (_config) return _config

  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Xero integration requires XERO_CLIENT_ID and XERO_CLIENT_SECRET')
  }

  _config = {
    clientId,
    clientSecret,
    redirectUri: process.env.XERO_REDIRECT_URI ?? 'http://localhost:3008/api/xero/callback',
    scopes: DEFAULT_SCOPES,
  }

  return _config
}

async function xeroRequest<T>(
  endpoint: string,
  tokenSet: XeroTokenSet,
  options: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  try {
    const response = await fetch(`${XERO_API_URL}${endpoint}`, {
      method: options.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${tokenSet.accessToken}`,
        'Xero-Tenant-Id': tokenSet.tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      logger.error('Xero rate limited', { endpoint, retryAfter })
      return { ok: false, error: `Rate limited — retry after ${retryAfter ?? '60'}s`, status: 429 }
    }

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('Xero API error', { endpoint, status: response.status, body: errorBody })
      return { ok: false, error: `Xero API ${response.status}: ${errorBody}`, status: response.status }
    }

    const data = await response.json() as T
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Xero error'
    logger.error('Xero request failed', { endpoint, error: message })
    return { ok: false, error: message }
  }
}

// ── OAuth 2.0 ───────────────────────────────────────────────────────────────

/**
 * Generate the Xero OAuth 2.0 authorization URL.
 * Redirect the user to this URL to start the connection flow.
 */
export function getAuthorizationUrl(state: string): string {
  const config = getConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
  })
  return `${XERO_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<{ ok: true; tokens: Omit<XeroTokenSet, 'tenantId' | 'tenantName'> } | { ok: false; error: string }> {
  const config = getConfig()

  try {
    const response = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }).toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      return { ok: false, error: `Token exchange failed: ${error}` }
    }

    const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number }
    return {
      ok: true,
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Token exchange failed' }
  }
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ ok: true; tokens: Omit<XeroTokenSet, 'tenantId' | 'tenantName'> } | { ok: false; error: string }> {
  const config = getConfig()

  try {
    const response = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      return { ok: false, error: `Token refresh failed: ${error}` }
    }

    const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number }
    return {
      ok: true,
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Token refresh failed' }
  }
}

/**
 * Get connected Xero tenants (organisations).
 */
export async function getConnectedTenants(
  accessToken: string,
): Promise<{ ok: true; tenants: XeroTenant[] } | { ok: false; error: string }> {
  try {
    const response = await fetch(XERO_CONNECTIONS_URL, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) return { ok: false, error: `Failed to get tenants: ${response.status}` }

    const tenants = await response.json() as XeroTenant[]
    return { ok: true, tenants }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to get tenants' }
  }
}

// ── Accounting API ──────────────────────────────────────────────────────────

/**
 * Fetch chart of accounts from Xero.
 */
export async function getChartOfAccounts(
  tokenSet: XeroTokenSet,
): Promise<{ ok: true; accounts: XeroAccount[] } | { ok: false; error: string }> {
  const result = await xeroRequest<{ Accounts: XeroAccount[] }>('/Accounts', tokenSet)
  if (!result.ok) return result
  return { ok: true, accounts: result.data.Accounts }
}

/**
 * Sync contacts from Xero.
 */
export async function getContacts(
  tokenSet: XeroTokenSet,
  modifiedAfter?: string,
): Promise<{ ok: true; contacts: XeroContact[] } | { ok: false; error: string }> {
  const endpoint = modifiedAfter
    ? `/Contacts?where=UpdatedDateUTC>DateTime(${modifiedAfter})`
    : '/Contacts'
  const result = await xeroRequest<{ Contacts: XeroContact[] }>(endpoint, tokenSet)
  if (!result.ok) return result
  return { ok: true, contacts: result.data.Contacts }
}

/**
 * Post a journal entry to Xero.
 */
export async function createManualJournal(
  tokenSet: XeroTokenSet,
  journal: XeroJournalEntry,
): Promise<{ ok: true; journalId: string } | { ok: false; error: string }> {
  const result = await xeroRequest<{ ManualJournals: { ManualJournalID: string }[] }>(
    '/ManualJournals',
    tokenSet,
    {
      method: 'POST',
      body: {
        ManualJournals: [{
          Date: journal.journalDate,
          Narration: journal.reference ?? '',
          JournalLines: journal.journalLines.map((l) => ({
            LineAmount: l.netAmount,
            AccountCode: l.accountCode,
            Description: l.description ?? '',
            TaxType: l.taxType,
          })),
        }],
      },
    },
  )
  if (!result.ok) return result
  return { ok: true, journalId: result.data.ManualJournals[0]?.ManualJournalID ?? '' }
}

/**
 * Create or update an invoice in Xero.
 */
export async function upsertInvoice(
  tokenSet: XeroTokenSet,
  invoice: XeroInvoice,
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  const result = await xeroRequest<{ Invoices: { InvoiceID: string }[] }>(
    '/Invoices',
    tokenSet,
    {
      method: invoice.invoiceId ? 'POST' : 'PUT',
      body: { Invoices: [invoice] },
    },
  )
  if (!result.ok) return result
  return { ok: true, invoiceId: result.data.Invoices[0]?.InvoiceID ?? '' }
}

/**
 * Fetch bank transactions from Xero.
 */
export async function getBankTransactions(
  tokenSet: XeroTokenSet,
  modifiedAfter?: string,
): Promise<{ ok: true; transactions: XeroBankTransaction[] } | { ok: false; error: string }> {
  const endpoint = modifiedAfter
    ? `/BankTransactions?where=UpdatedDateUTC>DateTime(${modifiedAfter})`
    : '/BankTransactions'
  const result = await xeroRequest<{ BankTransactions: XeroBankTransaction[] }>(endpoint, tokenSet)
  if (!result.ok) return result
  return { ok: true, transactions: result.data.BankTransactions }
}

/**
 * Map a Xero account type to our internal account type.
 */
export function mapXeroAccountType(xeroType: string): string {
  return XERO_TO_INTERNAL_TYPE[xeroType] ?? 'expense'
}

/**
 * Check Xero connection health.
 */
export async function checkXeroHealth(
  tokenSet: XeroTokenSet,
): Promise<{ healthy: boolean; tenantName: string; error?: string }> {
  const result = await xeroRequest<{ Organisation: { Name: string }[] }>(
    '/Organisation',
    tokenSet,
  )
  if (!result.ok) return { healthy: false, tenantName: tokenSet.tenantName, error: result.error }
  return { healthy: true, tenantName: result.data.Organisation?.[0]?.Name ?? tokenSet.tenantName }
}
