/**
 * Public API — REST API Layer for External Consumers
 *
 * Type definitions and helper functions for the CFO public API.
 * Provides versioned endpoint contracts, request validation, API key
 * management, and rate limiting configuration for external consumption
 * of financial data (GL, reports, invoices, tax filings).
 *
 * @module cfo/public-api
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type APIVersion = 'v1'

export interface APIKeyConfig {
  keyId: string
  orgId: string
  name: string
  scopes: APIScope[]
  rateLimit: { requestsPerMinute: number; requestsPerDay: number }
  createdAt: string
  expiresAt: string | null
  isActive: boolean
}

export type APIScope =
  | 'read:accounts'
  | 'read:transactions'
  | 'read:reports'
  | 'read:invoices'
  | 'read:contacts'
  | 'write:invoices'
  | 'write:transactions'
  | 'read:tax'
  | 'read:payroll'
  | 'read:kpis'
  | 'webhook:manage'

export interface APIRequest {
  version: APIVersion
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  keyId: string
  orgId: string
  params?: Record<string, string>
  body?: unknown
  timestamp: number
}

export interface APIResponse<T = unknown> {
  status: number
  data?: T
  error?: { code: string; message: string; details?: unknown }
  meta?: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
  requestId: string
}

export interface APIEndpoint {
  path: string
  method: string
  scope: APIScope
  description: string
  parameters?: { name: string; type: string; required: boolean; description: string }[]
}

export interface WebhookSubscription {
  id: string
  orgId: string
  url: string
  events: WebhookEvent[]
  secret: string
  isActive: boolean
  createdAt: string
  failureCount: number
  lastDeliveredAt: string | null
}

export type WebhookEvent =
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.overdue'
  | 'payment.received'
  | 'expense.approved'
  | 'report.generated'
  | 'tax.filed'
  | 'payroll.completed'

// ── API Catalog ─────────────────────────────────────────────────────────────

export const API_ENDPOINTS: APIEndpoint[] = [
  // Chart of Accounts
  { path: '/v1/accounts', method: 'GET', scope: 'read:accounts', description: 'List chart of accounts' },
  { path: '/v1/accounts/:id', method: 'GET', scope: 'read:accounts', description: 'Get account by ID' },

  // Transactions
  { path: '/v1/transactions', method: 'GET', scope: 'read:transactions', description: 'List GL transactions' },
  { path: '/v1/transactions', method: 'POST', scope: 'write:transactions', description: 'Create journal entry' },

  // Reports
  { path: '/v1/reports/trial-balance', method: 'GET', scope: 'read:reports', description: 'Trial balance report' },
  { path: '/v1/reports/income-statement', method: 'GET', scope: 'read:reports', description: 'Income statement' },
  { path: '/v1/reports/balance-sheet', method: 'GET', scope: 'read:reports', description: 'Balance sheet' },
  { path: '/v1/reports/cash-flow', method: 'GET', scope: 'read:reports', description: 'Cash flow statement' },
  { path: '/v1/reports/aging/ar', method: 'GET', scope: 'read:reports', description: 'AR aging report' },
  { path: '/v1/reports/aging/ap', method: 'GET', scope: 'read:reports', description: 'AP aging report' },

  // Invoices
  { path: '/v1/invoices', method: 'GET', scope: 'read:invoices', description: 'List invoices' },
  { path: '/v1/invoices', method: 'POST', scope: 'write:invoices', description: 'Create invoice' },
  { path: '/v1/invoices/:id', method: 'GET', scope: 'read:invoices', description: 'Get invoice' },
  { path: '/v1/invoices/:id', method: 'PUT', scope: 'write:invoices', description: 'Update invoice' },

  // Contacts
  { path: '/v1/contacts', method: 'GET', scope: 'read:contacts', description: 'List contacts' },
  { path: '/v1/contacts/:id', method: 'GET', scope: 'read:contacts', description: 'Get contact' },

  // Tax
  { path: '/v1/tax/filings', method: 'GET', scope: 'read:tax', description: 'List tax filings' },
  { path: '/v1/tax/filings/:id', method: 'GET', scope: 'read:tax', description: 'Get filing status' },

  // KPIs
  { path: '/v1/kpis', method: 'GET', scope: 'read:kpis', description: 'Current financial KPIs' },
  { path: '/v1/kpis/trends', method: 'GET', scope: 'read:kpis', description: 'KPI trend data' },

  // Webhooks
  { path: '/v1/webhooks', method: 'GET', scope: 'webhook:manage', description: 'List webhook subscriptions' },
  { path: '/v1/webhooks', method: 'POST', scope: 'webhook:manage', description: 'Create webhook subscription' },
  { path: '/v1/webhooks/:id', method: 'DELETE', scope: 'webhook:manage', description: 'Delete webhook' },
]

// ── Rate Limiting ───────────────────────────────────────────────────────────

const DEFAULT_RATE_LIMITS = {
  requestsPerMinute: 60,
  requestsPerDay: 10_000,
}

/** In-memory rate limit tracker (use Redis in production) */
const rateLimitCounters = new Map<string, { count: number; windowStart: number }>()

/**
 * Check if a request is within rate limits.
 */
export function checkRateLimit(
  keyId: string,
  limits: { requestsPerMinute: number } = DEFAULT_RATE_LIMITS,
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now()
  const windowMs = 60_000
  const entry = rateLimitCounters.get(keyId)

  if (!entry || (now - entry.windowStart) > windowMs) {
    rateLimitCounters.set(keyId, { count: 1, windowStart: now })
    return { allowed: true, remaining: limits.requestsPerMinute - 1 }
  }

  entry.count++
  const remaining = Math.max(0, limits.requestsPerMinute - entry.count)

  if (entry.count > limits.requestsPerMinute) {
    const retryAfterMs = windowMs - (now - entry.windowStart)
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  return { allowed: true, remaining }
}

// ── Request Validation ──────────────────────────────────────────────────────

/**
 * Validate an API key has the required scope for an endpoint.
 */
export function validateScope(
  apiKey: APIKeyConfig,
  requiredScope: APIScope,
): { valid: boolean; error?: string } {
  if (!apiKey.isActive) {
    return { valid: false, error: 'API key is inactive' }
  }

  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return { valid: false, error: 'API key has expired' }
  }

  if (!apiKey.scopes.includes(requiredScope)) {
    return { valid: false, error: `Missing scope: ${requiredScope}` }
  }

  return { valid: true }
}

/**
 * Match a request path to an endpoint definition.
 */
export function matchEndpoint(method: string, path: string): APIEndpoint | null {
  return API_ENDPOINTS.find((ep) => {
    if (ep.method !== method) return false
    const epParts = ep.path.split('/')
    const reqParts = path.split('/')
    if (epParts.length !== reqParts.length) return false
    return epParts.every((part, i) => part.startsWith(':') || part === reqParts[i])
  }) ?? null
}

// ── Response Helpers ────────────────────────────────────────────────────────

/**
 * Create a paginated API response.
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  perPage: number,
  requestId: string,
): APIResponse<T[]> {
  const total = data.length
  const totalPages = Math.ceil(total / perPage)
  const start = (page - 1) * perPage
  const paged = data.slice(start, start + perPage)

  return {
    status: 200,
    data: paged,
    meta: { page, perPage, total, totalPages },
    requestId,
  }
}

/**
 * Create an error response.
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
): APIResponse {
  return { status, error: { code, message }, requestId }
}

// ── Webhook Delivery ────────────────────────────────────────────────────────

/**
 * Sign a webhook payload using HMAC-SHA256.
 * Uses the Web Crypto API (available in Node 18+ and edge runtimes).
 */
export async function signWebhookPayload(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify a webhook signature.
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await signWebhookPayload(payload, secret)
  // Constant-time comparison
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}
