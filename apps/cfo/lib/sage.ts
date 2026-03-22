/**
 * Sage — Cloud Accounting Integration
 *
 * Sage Business Cloud Accounting API integration for syncing ledger accounts,
 * contacts, journal entries, invoices, and bank transactions.
 * Sage is the #1 enterprise accounting platform in the UK/EU and #3 worldwide.
 *
 * @see https://developer.sage.com/accounting/reference/
 * @module cfo/sage
 */
import { logger } from '@/lib/logger'

// ── Types ───────────────────────────────────────────────────────────────────

export interface SageConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface SageTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  resourceOwnerId: string
}

export interface SageLedgerAccount {
  id: string
  displayedAs: string
  nominalCode: number
  ledgerAccountType: { id: string; displayedAs: string }
  ledgerAccountClassification: { id: string; displayedAs: string }
  taxRate?: { id: string; displayedAs: string; percentage: number }
  balance: number
  isControlAccount: boolean
}

export interface SageContact {
  id: string
  displayedAs: string
  name: string
  contactTypeIds: string[]
  reference?: string
  email?: string
  taxNumber?: string
  mainAddress?: {
    addressLine1?: string
    city?: string
    region?: string
    postalCode?: string
    country?: { id: string; displayedAs: string }
  }
}

export interface SageJournalEntry {
  date: string
  reference?: string
  description?: string
  journalLines: {
    ledgerAccountId: string
    debit?: number
    credit?: number
    details?: string
  }[]
}

export interface SageInvoice {
  id?: string
  contactId: string
  date: string
  dueDate: string
  reference?: string
  invoiceLines: {
    description: string
    ledgerAccountId: string
    quantity: number
    unitPrice: number
    taxRateId?: string
  }[]
  status?: string
  totalAmount?: number
  outstandingAmount?: number
}

export interface SageBankTransaction {
  id?: string
  bankAccountId: string
  date: string
  transactionType: { id: string }
  reference?: string
  totalAmount: number
  paymentMethod?: { id: string }
  contactId?: string
}

export interface SageSyncResult {
  provider: 'sage'
  synced: number
  created: number
  updated: number
  errors: string[]
  lastSyncAt: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const SAGE_AUTH_URL = 'https://www.sageone.com/oauth2/auth/central'
const SAGE_TOKEN_URL = 'https://oauth.accounting.sage.com/token'
const SAGE_API_URL = 'https://api.accounting.sage.com/v3.1'

// ── Client ──────────────────────────────────────────────────────────────────

let _config: SageConfig | null = null

function getConfig(): SageConfig {
  if (_config) return _config
  const clientId = process.env.SAGE_CLIENT_ID
  const clientSecret = process.env.SAGE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Sage integration requires SAGE_CLIENT_ID and SAGE_CLIENT_SECRET')
  }
  _config = {
    clientId,
    clientSecret,
    redirectUri: process.env.SAGE_REDIRECT_URI ?? 'http://localhost:3008/api/sage/callback',
  }
  return _config
}

async function sageRequest<T>(
  endpoint: string,
  tokenSet: SageTokenSet,
  options: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  try {
    const response = await fetch(`${SAGE_API_URL}${endpoint}`, {
      method: options.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${tokenSet.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })

    if (response.status === 429) {
      logger.error('Sage rate limited', { endpoint })
      return { ok: false, error: 'Rate limited', status: 429 }
    }

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('Sage API error', { endpoint, status: response.status, body: errorBody })
      return { ok: false, error: `Sage API ${response.status}: ${errorBody}`, status: response.status }
    }

    const data = await response.json() as T
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Sage error'
    logger.error('Sage request failed', { endpoint, error: msg })
    return { ok: false, error: msg }
  }
}

// ── OAuth 2.0 ───────────────────────────────────────────────────────────────

export function getAuthorizationUrl(state: string): string {
  const config = getConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'full_access',
    state,
  })
  return `${SAGE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<{ ok: true; tokens: Omit<SageTokenSet, 'resourceOwnerId'> } | { ok: false; error: string }> {
  const config = getConfig()
  try {
    const response = await fetch(SAGE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }).toString(),
    })
    if (!response.ok) return { ok: false, error: `Token exchange failed: ${response.status}` }
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

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ ok: true; tokens: Omit<SageTokenSet, 'resourceOwnerId'> } | { ok: false; error: string }> {
  const config = getConfig()
  try {
    const response = await fetch(SAGE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    })
    if (!response.ok) return { ok: false, error: `Token refresh failed: ${response.status}` }
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

// ── Accounting API ──────────────────────────────────────────────────────────

export async function getLedgerAccounts(
  tokenSet: SageTokenSet,
): Promise<{ ok: true; accounts: SageLedgerAccount[] } | { ok: false; error: string }> {
  const result = await sageRequest<{ $items: SageLedgerAccount[] }>('/ledger_accounts?items_per_page=200', tokenSet)
  if (!result.ok) return result
  return { ok: true, accounts: result.data.$items }
}

export async function getContacts(
  tokenSet: SageTokenSet,
  updatedSince?: string,
): Promise<{ ok: true; contacts: SageContact[] } | { ok: false; error: string }> {
  const endpoint = updatedSince
    ? `/contacts?updated_from=${updatedSince}&items_per_page=200`
    : '/contacts?items_per_page=200'
  const result = await sageRequest<{ $items: SageContact[] }>(endpoint, tokenSet)
  if (!result.ok) return result
  return { ok: true, contacts: result.data.$items }
}

export async function createJournal(
  tokenSet: SageTokenSet,
  journal: SageJournalEntry,
): Promise<{ ok: true; journalId: string } | { ok: false; error: string }> {
  const result = await sageRequest<{ id: string }>(
    '/journals',
    tokenSet,
    {
      method: 'POST',
      body: {
        journal: {
          date: journal.date,
          reference: journal.reference ?? '',
          description: journal.description ?? '',
          journal_lines: journal.journalLines.map((l) => ({
            ledger_account_id: l.ledgerAccountId,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            details: l.details ?? '',
          })),
        },
      },
    },
  )
  if (!result.ok) return result
  return { ok: true, journalId: result.data.id }
}

export async function createSalesInvoice(
  tokenSet: SageTokenSet,
  invoice: SageInvoice,
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  const result = await sageRequest<{ id: string }>(
    '/sales_invoices',
    tokenSet,
    {
      method: 'POST',
      body: {
        sales_invoice: {
          contact_id: invoice.contactId,
          date: invoice.date,
          due_date: invoice.dueDate,
          reference: invoice.reference,
          invoice_lines: invoice.invoiceLines.map((l) => ({
            description: l.description,
            ledger_account_id: l.ledgerAccountId,
            quantity: l.quantity,
            unit_price: l.unitPrice,
            tax_rate_id: l.taxRateId,
          })),
        },
      },
    },
  )
  if (!result.ok) return result
  return { ok: true, invoiceId: result.data.id }
}

export async function getBankTransactions(
  tokenSet: SageTokenSet,
  fromDate?: string,
): Promise<{ ok: true; transactions: SageBankTransaction[] } | { ok: false; error: string }> {
  const endpoint = fromDate
    ? `/bank_transactions?from_date=${fromDate}&items_per_page=200`
    : '/bank_transactions?items_per_page=200'
  const result = await sageRequest<{ $items: SageBankTransaction[] }>(endpoint, tokenSet)
  if (!result.ok) return result
  return { ok: true, transactions: result.data.$items }
}

export async function checkSageHealth(
  tokenSet: SageTokenSet,
): Promise<{ healthy: boolean; businessName?: string; error?: string }> {
  const result = await sageRequest<{ displayed_as: string }>('/business', tokenSet)
  if (!result.ok) return { healthy: false, error: result.error }
  return { healthy: true, businessName: result.data.displayed_as }
}
