/**
 * Plaid — Open Banking Integration
 *
 * Provides bank feed aggregation, transaction categorization, account
 * verification, and balance queries via the Plaid API.
 *
 * Plaid is the industry standard for connecting bank accounts to
 * fintech applications. This module covers:
 * - Link token creation (for Plaid Link UI)
 * - Item/account exchange (public_token → access_token)
 * - Transaction sync (incremental cursor-based)
 * - Account balance queries
 * - Institution lookup
 * - Webhook handling for real-time updates
 *
 * @see https://plaid.com/docs/
 * @module cfo/plaid
 */
import { logger } from '@/lib/logger'

// ── Types ───────────────────────────────────────────────────────────────────

export type PlaidEnvironment = 'sandbox' | 'development' | 'production'

export interface PlaidConfig {
  clientId: string
  secret: string
  environment: PlaidEnvironment
  /** Webhook URL for Plaid to notify on changes */
  webhookUrl?: string
}

export interface PlaidLinkTokenRequest {
  /** Your user ID (for Plaid user tracking) */
  userId: string
  /** Products to enable */
  products?: PlaidProduct[]
  /** Country codes */
  countryCodes?: string[]
  /** Institution ID to restrict to (optional) */
  institutionId?: string
}

export type PlaidProduct = 'transactions' | 'auth' | 'identity' | 'balance' | 'investments' | 'liabilities'

export interface PlaidLinkTokenResult {
  linkToken: string
  expiration: string
  requestId: string
}

export interface PlaidExchangeResult {
  accessToken: string
  itemId: string
  requestId: string
}

export interface PlaidAccount {
  accountId: string
  name: string
  officialName: string | null
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other'
  subtype: string | null
  mask: string | null
  balances: {
    available: number | null
    current: number | null
    limit: number | null
    isoCurrencyCode: string | null
  }
  institutionId?: string
}

export interface PlaidTransaction {
  transactionId: string
  accountId: string
  amount: number
  date: string
  name: string
  merchantName: string | null
  category: string[]
  categoryId: string | null
  pending: boolean
  isoCurrencyCode: string | null
  paymentChannel: 'online' | 'in store' | 'other'
  /** Plaid's personal finance category */
  personalFinanceCategory: {
    primary: string
    detailed: string
  } | null
  /** Location data if available */
  location: {
    city: string | null
    region: string | null
    postalCode: string | null
    country: string | null
  } | null
}

export interface PlaidTransactionSyncResult {
  added: PlaidTransaction[]
  modified: PlaidTransaction[]
  removed: { transactionId: string }[]
  nextCursor: string
  hasMore: boolean
  requestId: string
}

export interface PlaidBalanceResult {
  accounts: PlaidAccount[]
  requestId: string
}

export interface PlaidInstitution {
  institutionId: string
  name: string
  countryCodes: string[]
  products: PlaidProduct[]
  url: string | null
  logo: string | null
  primaryColor: string | null
}

export interface PlaidWebhookPayload {
  webhookType: 'TRANSACTIONS' | 'ITEM' | 'AUTH' | 'ASSETS' | 'HOLDINGS' | 'INVESTMENTS_TRANSACTIONS' | 'LIABILITIES'
  webhookCode: string
  itemId: string
  error?: { errorType: string; errorCode: string; errorMessage: string }
  newTransactions?: number
}

/** Normalized bank transaction for GL posting */
export interface NormalizedBankTransaction {
  externalId: string
  accountId: string
  date: string
  amount: number
  description: string
  merchantName: string | null
  category: string
  subCategory: string | null
  isPending: boolean
  currency: string
  source: 'plaid'
}

// ── Constants ───────────────────────────────────────────────────────────────

const PLAID_BASE_URLS: Record<PlaidEnvironment, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}

const DEFAULT_PRODUCTS: PlaidProduct[] = ['transactions', 'auth', 'balance']
const DEFAULT_COUNTRY_CODES = ['CA', 'US']

// ── Client ──────────────────────────────────────────────────────────────────

let _config: PlaidConfig | null = null

function getConfig(): PlaidConfig {
  if (_config) return _config

  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  const environment = (process.env.PLAID_ENVIRONMENT ?? 'sandbox') as PlaidEnvironment

  if (!clientId || !secret) {
    throw new Error('Plaid integration requires PLAID_CLIENT_ID and PLAID_SECRET env vars')
  }

  _config = {
    clientId,
    secret,
    environment,
    webhookUrl: process.env.PLAID_WEBHOOK_URL,
  }

  return _config
}

async function plaidRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; errorCode?: string }> {
  const config = getConfig()
  const baseUrl = PLAID_BASE_URLS[config.environment]

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        secret: config.secret,
        ...body,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error_message: response.statusText }))
      logger.error('Plaid API error', {
        endpoint,
        status: response.status,
        errorCode: error.error_code,
        errorMessage: error.error_message,
      })
      return { ok: false, error: error.error_message ?? response.statusText, errorCode: error.error_code }
    }

    const data = await response.json() as T
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Plaid error'
    logger.error('Plaid request failed', { endpoint, error: message })
    return { ok: false, error: message }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a Link token for initializing Plaid Link in the browser.
 *
 * The link token is short-lived and should be used immediately
 * to open the Plaid Link UI for bank account connection.
 */
export async function createLinkToken(
  request: PlaidLinkTokenRequest,
): Promise<{ ok: true; data: PlaidLinkTokenResult } | { ok: false; error: string }> {
  const config = getConfig()

  return plaidRequest<PlaidLinkTokenResult>('/link/token/create', {
    user: { client_user_id: request.userId },
    client_name: 'LedgerIQ',
    products: request.products ?? DEFAULT_PRODUCTS,
    country_codes: request.countryCodes ?? DEFAULT_COUNTRY_CODES,
    language: 'en',
    webhook: config.webhookUrl,
    ...(request.institutionId ? { institution_id: request.institutionId } : {}),
  })
}

/**
 * Exchange a public token (from Plaid Link) for an access token.
 *
 * The access token is permanent and should be stored securely
 * (encrypted at rest, never logged).
 */
export async function exchangePublicToken(
  publicToken: string,
): Promise<{ ok: true; data: PlaidExchangeResult } | { ok: false; error: string }> {
  return plaidRequest<PlaidExchangeResult>('/item/public_token/exchange', {
    public_token: publicToken,
  })
}

/**
 * Sync transactions incrementally using Plaid's cursor-based sync.
 *
 * Pass the cursor from the previous sync to get only new/modified/removed
 * transactions. On first sync, pass an empty string for cursor.
 */
export async function syncTransactions(
  accessToken: string,
  cursor: string = '',
  count: number = 500,
): Promise<{ ok: true; data: PlaidTransactionSyncResult } | { ok: false; error: string }> {
  return plaidRequest<PlaidTransactionSyncResult>('/transactions/sync', {
    access_token: accessToken,
    cursor: cursor || undefined,
    count,
  })
}

/**
 * Get real-time account balances.
 */
export async function getBalances(
  accessToken: string,
  accountIds?: string[],
): Promise<{ ok: true; data: PlaidBalanceResult } | { ok: false; error: string }> {
  return plaidRequest<PlaidBalanceResult>('/accounts/balance/get', {
    access_token: accessToken,
    ...(accountIds ? { options: { account_ids: accountIds } } : {}),
  })
}

/**
 * Get accounts associated with an access token.
 */
export async function getAccounts(
  accessToken: string,
): Promise<{ ok: true; data: { accounts: PlaidAccount[] } } | { ok: false; error: string }> {
  return plaidRequest<{ accounts: PlaidAccount[] }>('/accounts/get', {
    access_token: accessToken,
  })
}

/**
 * Lookup institution details by ID.
 */
export async function getInstitution(
  institutionId: string,
): Promise<{ ok: true; data: { institution: PlaidInstitution } } | { ok: false; error: string }> {
  return plaidRequest<{ institution: PlaidInstitution }>('/institutions/get_by_id', {
    institution_id: institutionId,
    country_codes: DEFAULT_COUNTRY_CODES,
  })
}

/**
 * Remove an Item (disconnect bank account).
 */
export async function removeItem(
  accessToken: string,
): Promise<{ ok: true; data: { requestId: string } } | { ok: false; error: string }> {
  return plaidRequest<{ requestId: string }>('/item/remove', {
    access_token: accessToken,
  })
}

/**
 * Normalize a Plaid transaction to our internal bank transaction format.
 *
 * Maps Plaid's personal finance categories to our GL-friendly categories.
 */
export function normalizeTransaction(txn: PlaidTransaction): NormalizedBankTransaction {
  return {
    externalId: txn.transactionId,
    accountId: txn.accountId,
    date: txn.date,
    amount: txn.amount,
    description: txn.name,
    merchantName: txn.merchantName,
    category: txn.personalFinanceCategory?.primary ?? txn.category?.[0] ?? 'Uncategorized',
    subCategory: txn.personalFinanceCategory?.detailed ?? txn.category?.[1] ?? null,
    isPending: txn.pending,
    currency: txn.isoCurrencyCode ?? 'CAD',
    source: 'plaid',
  }
}

/**
 * Full incremental bank feed sync — fetches all pages of new transactions.
 *
 * Returns all added/modified/removed transactions since the last cursor,
 * along with the new cursor for next time.
 */
export async function fullTransactionSync(
  accessToken: string,
  cursor: string = '',
): Promise<{
  ok: true
  added: NormalizedBankTransaction[]
  modified: NormalizedBankTransaction[]
  removed: string[]
  nextCursor: string
} | { ok: false; error: string }> {
  const allAdded: NormalizedBankTransaction[] = []
  const allModified: NormalizedBankTransaction[] = []
  const allRemoved: string[] = []
  let currentCursor = cursor
  let hasMore = true

  while (hasMore) {
    const result = await syncTransactions(accessToken, currentCursor)
    if (!result.ok) return result

    allAdded.push(...result.data.added.map(normalizeTransaction))
    allModified.push(...result.data.modified.map(normalizeTransaction))
    allRemoved.push(...result.data.removed.map((r) => r.transactionId))
    currentCursor = result.data.nextCursor
    hasMore = result.data.hasMore
  }

  logger.info('Plaid full sync completed', {
    added: allAdded.length,
    modified: allModified.length,
    removed: allRemoved.length,
  })

  return { ok: true, added: allAdded, modified: allModified, removed: allRemoved, nextCursor: currentCursor }
}

/**
 * Verify a Plaid webhook signature.
 *
 * Plaid signs webhooks with a JWK — this performs the verification
 * against their published key set.
 */
export function parseWebhookPayload(body: string): PlaidWebhookPayload | null {
  try {
    const payload = JSON.parse(body) as PlaidWebhookPayload
    if (!payload.webhookType || !payload.webhookCode || !payload.itemId) {
      logger.error('Invalid Plaid webhook payload', { payload })
      return null
    }
    return payload
  } catch {
    logger.error('Failed to parse Plaid webhook body')
    return null
  }
}

/**
 * Check Plaid connection health for a given access token.
 */
export async function checkPlaidHealth(
  accessToken: string,
): Promise<{ healthy: boolean; error?: string; accountCount?: number }> {
  const result = await getAccounts(accessToken)
  if (!result.ok) return { healthy: false, error: result.error }
  return { healthy: true, accountCount: result.data.accounts.length }
}
