/**
 * Nzila OS — Integration Runtime: Rate-Limit Parser
 *
 * Unified rate-limit parsing across all integration providers.
 * Each provider adapter surfaces RateLimitInfo on failures.
 *
 * Supported providers:
 * - Slack (429 + retry-after header)
 * - HubSpot (429 patterns + daily limit headers)
 * - Teams webhook (429 if present)
 * - Resend/SendGrid/Mailgun (standard 429 + retry-after)
 * - Twilio (rate-limit headers)
 *
 * Dispatcher uses this to schedule bounded retries on rate-limit.
 */
import type { RateLimitInfo } from '@nzila/integrations-core'

// ── Parser function type ────────────────────────────────────────────────────

export type RateLimitParser = (
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
  body?: unknown,
) => RateLimitInfo

// ── Header utilities ────────────────────────────────────────────────────────

function getHeader(headers: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = headers[key] ?? headers[key.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value ?? undefined
}

function parseRetryAfterHeader(headers: Record<string, string | string[] | undefined>): number | undefined {
  const raw = getHeader(headers, 'retry-after') ?? getHeader(headers, 'Retry-After')
  if (!raw) return undefined

  const seconds = Number(raw)
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
  }

  // Try HTTP-date format
  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) {
    const ms = date.getTime() - Date.now()
    return ms > 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : undefined
  }

  return undefined
}

/** Maximum retry-after we'll honor: 5 minutes */
const MAX_RETRY_AFTER_MS = 5 * 60 * 1000

// ── Not rate-limited result ─────────────────────────────────────────────────

const NOT_RATE_LIMITED: RateLimitInfo = { isRateLimited: false }

// ── Slack ───────────────────────────────────────────────────────────────────

/**
 * Slack rate-limit parser.
 * Responds with 429 + `Retry-After` header (in seconds).
 * Ref: https://api.slack.com/docs/rate-limits
 */
export function parseSlackRateLimit(
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
): RateLimitInfo {
  if (statusCode !== 429) return NOT_RATE_LIMITED

  const retryAfterMs = parseRetryAfterHeader(headers)
  return {
    isRateLimited: true,
    retryAfterMs: retryAfterMs ?? 30_000,
    limit: undefined,
    remaining: undefined,
    resetAt: undefined,
  }
}

// ── HubSpot ─────────────────────────────────────────────────────────────────

/**
 * HubSpot rate-limit parser.
 * Returns 429 with optional headers:
 *   X-HubSpot-RateLimit-Daily, X-HubSpot-RateLimit-Daily-Remaining
 *   Retry-After
 * Ref: https://developers.hubspot.com/docs/api/usage-details
 */
export function parseHubSpotRateLimit(
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
): RateLimitInfo {
  if (statusCode !== 429) return NOT_RATE_LIMITED

  const retryAfterMs = parseRetryAfterHeader(headers)
  const limit = getHeader(headers, 'x-hubspot-ratelimit-daily')
  const remaining = getHeader(headers, 'x-hubspot-ratelimit-daily-remaining')

  return {
    isRateLimited: true,
    retryAfterMs: retryAfterMs ?? 10_000,
    limit: limit ? Number(limit) : undefined,
    remaining: remaining ? Number(remaining) : undefined,
    resetAt: undefined,
  }
}

// ── Microsoft Teams ─────────────────────────────────────────────────────────

/**
 * Teams webhook rate-limit parser.
 * Less common, but treats 429 with Retry-After if present.
 */
export function parseTeamsRateLimit(
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
): RateLimitInfo {
  if (statusCode !== 429) return NOT_RATE_LIMITED

  const retryAfterMs = parseRetryAfterHeader(headers)
  return {
    isRateLimited: true,
    retryAfterMs: retryAfterMs ?? 60_000,
  }
}

// ── Generic (Resend, SendGrid, Mailgun, Twilio, etc.) ───────────────────────

/**
 * Generic rate-limit parser for providers that follow standard HTTP 429
 * with Retry-After header. Also checks X-RateLimit-* headers.
 */
export function parseGenericRateLimit(
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
): RateLimitInfo {
  if (statusCode !== 429) return NOT_RATE_LIMITED

  const retryAfterMs = parseRetryAfterHeader(headers)
  const limit = getHeader(headers, 'x-ratelimit-limit')
  const remaining = getHeader(headers, 'x-ratelimit-remaining')
  const resetRaw = getHeader(headers, 'x-ratelimit-reset')

  let resetAt: string | undefined
  if (resetRaw) {
    // Could be epoch seconds or ISO string
    const epoch = Number(resetRaw)
    if (!Number.isNaN(epoch) && epoch > 1_000_000_000) {
      resetAt = new Date(epoch * 1000).toISOString()
    }
  }

  return {
    isRateLimited: true,
    retryAfterMs: retryAfterMs ?? 30_000,
    limit: limit ? Number(limit) : undefined,
    remaining: remaining ? Number(remaining) : undefined,
    resetAt,
  }
}

// ── Unified dispatcher-facing parser ────────────────────────────────────────

const providerParsers: Record<string, RateLimitParser> = {
  slack: parseSlackRateLimit,
  hubspot: parseHubSpotRateLimit,
  teams: parseTeamsRateLimit,
  resend: parseGenericRateLimit,
  sendgrid: parseGenericRateLimit,
  mailgun: parseGenericRateLimit,
  twilio: parseGenericRateLimit,
  firebase: parseGenericRateLimit,
}

/**
 * Parse rate-limit info from a provider response.
 * Falls back to generic parser for unknown providers.
 */
export function parseRateLimitInfo(
  provider: string,
  statusCode: number,
  headers: Record<string, string | string[] | undefined>,
  body?: unknown,
): RateLimitInfo {
  const parser = providerParsers[provider] ?? parseGenericRateLimit
  return parser(statusCode, headers, body)
}
