/**
 * Nzila OS — Comms Email: Resend Adapter
 */
import type {
  IntegrationAdapter,
  RateLimitInfo,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'

interface ResendCredentials {
  apiKey: string
  fromAddress: string
  replyToAddress?: string
  defaultTags: ReadonlyArray<{ name: string; value: string }>
  maxRetries: number
}

interface ResendErrorShape {
  message?: unknown
  statusCode?: unknown
  name?: unknown
  headers?: unknown
}

interface ResendSendMetadata {
  text?: string
  replyTo?: string
  cc?: string | ReadonlyArray<string>
  bcc?: string | ReadonlyArray<string>
  tags?: Record<string, unknown> | ReadonlyArray<{ name: string; value: string }>
  headers?: Record<string, unknown>
  scheduledAt?: string
  disableRetry?: boolean
}

const TRANSIENT_RETRY_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeEmailList(value: unknown): ReadonlyArray<string> | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : undefined
  }

  if (!Array.isArray(value)) return undefined

  const list = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)

  return list.length > 0 ? list : undefined
}

function normalizeTags(value: unknown): ReadonlyArray<{ name: string; value: string }> {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!isRecord(entry)) return null
        const name = toNonEmptyString(entry['name'])
        const tagValue = toNonEmptyString(entry['value'])
        if (!name || !tagValue) return null
        return { name, value: tagValue }
      })
      .filter((entry): entry is { name: string; value: string } => entry !== null)
  }

  if (!isRecord(value)) return []

  return Object.entries(value)
    .map(([name, tagValue]) => {
      const normalizedName = toNonEmptyString(name)
      const normalizedValue = toNonEmptyString(tagValue)
      if (!normalizedName || !normalizedValue) return null
      return { name: normalizedName, value: normalizedValue }
    })
    .filter((entry): entry is { name: string; value: string } => entry !== null)
}

function normalizeHeaders(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, headerValue]) => {
    const normalizedKey = toNonEmptyString(key)
    const normalizedValue = toNonEmptyString(headerValue)
    if (normalizedKey && normalizedValue) {
      acc[normalizedKey] = normalizedValue
    }
    return acc
  }, {})
}

function asFiniteInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function parseRateLimitInfo(error: ResendErrorShape): RateLimitInfo | undefined {
  const statusCode = asFiniteInt(error.statusCode)
  const headers = isRecord(error.headers) ? error.headers : {}

  const retryAfterSeconds = asFiniteInt(headers['retry-after'])
  const limit = asFiniteInt(headers['x-ratelimit-limit'])
  const remaining = asFiniteInt(headers['x-ratelimit-remaining'])
  const resetEpoch = asFiniteInt(headers['x-ratelimit-reset'])
  const retryAfterMs = retryAfterSeconds !== undefined ? Math.max(retryAfterSeconds, 0) * 1000 : undefined
  const resetAt = resetEpoch !== undefined ? new Date(resetEpoch * 1000).toISOString() : undefined

  const isRateLimited = statusCode === 429 || retryAfterMs !== undefined || remaining === 0
  if (!isRateLimited && limit === undefined && remaining === undefined && resetAt === undefined) {
    return undefined
  }

  return {
    isRateLimited,
    retryAfterMs,
    limit,
    remaining,
    resetAt,
  }
}

function parseResendError(error: unknown): { message: string; statusCode?: number; rateLimitInfo?: RateLimitInfo } {
  const fallbackMessage = error instanceof Error ? error.message : String(error)
  if (!isRecord(error)) {
    return { message: fallbackMessage }
  }

  const statusCode = asFiniteInt(error['statusCode'])
  const message = toNonEmptyString(error['message']) ?? fallbackMessage
  const rateLimitInfo = parseRateLimitInfo(error as ResendErrorShape)

  return {
    message,
    statusCode,
    rateLimitInfo,
  }
}

function computeBackoffMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return retryAfterMs
  }
  const cappedAttempt = Math.min(attempt, 4)
  return 100 * 2 ** cappedAttempt
}

function shouldRetry(statusCode: number | undefined, attempt: number, maxRetries: number, disableRetry: boolean): boolean {
  if (disableRetry) return false
  if (attempt >= maxRetries) return false
  if (statusCode === undefined) return false
  return TRANSIENT_RETRY_STATUS_CODES.has(statusCode)
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function getSendMetadata(request: SendRequest): ResendSendMetadata {
  if (!isRecord(request.metadata)) return {}
  const providerMetadata = isRecord(request.metadata['resend']) ? request.metadata['resend'] : request.metadata
  return providerMetadata as ResendSendMetadata
}

function parseDefaultTags(value: unknown): ReadonlyArray<{ name: string; value: string }> {
  return normalizeTags(value).slice(0, 10)
}

function parseCredentials(creds: Record<string, unknown>): ResendCredentials {
  const apiKey = creds['apiKey']
  const fromAddress = creds['fromAddress']
  const replyToAddress = toNonEmptyString(creds['replyToAddress']) ?? undefined
  const maxRetriesInput = asFiniteInt(creds['maxRetries'])
  const maxRetries = Math.max(0, Math.min(maxRetriesInput ?? 2, 5))
  const defaultTags = parseDefaultTags(creds['defaultTags'])
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('Missing Resend apiKey')
  if (typeof fromAddress !== 'string' || !fromAddress) throw new Error('Missing Resend fromAddress')
  return { apiKey, fromAddress, replyToAddress, defaultTags, maxRetries }
}

export const resendAdapter: IntegrationAdapter = {
  provider: 'resend',
  channel: 'email',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const startedAt = Date.now()
    const { apiKey, fromAddress, replyToAddress, defaultTags, maxRetries } = parseCredentials(credentials)
    const { Resend } = await import('resend')
    const client = new Resend(apiKey)
    const metadata = getSendMetadata(request)

    const tags = [
      ...defaultTags,
      ...normalizeTags(metadata.tags),
      { name: 'correlation_id', value: request.correlationId },
      { name: 'org_id', value: request.orgId },
      { name: 'channel', value: request.channel },
      ...(request.templateId ? [{ name: 'template_id', value: request.templateId }] : []),
    ].slice(0, 10)

    const headers: Record<string, string> = {
      ...normalizeHeaders(metadata.headers),
      'X-Correlation-Id': request.correlationId,
      'X-Org-Id': request.orgId,
      'X-Channel': request.channel,
    }
    if (request.templateId) {
      headers['X-Template-Id'] = request.templateId
    }

    const payload: Record<string, unknown> = {
      from: fromAddress,
      to: request.to,
      subject: request.subject ?? '(no subject)',
      html: request.body ?? '',
      text: toNonEmptyString(metadata.text) ?? undefined,
      replyTo: toNonEmptyString(metadata.replyTo) ?? replyToAddress,
      cc: normalizeEmailList(metadata.cc),
      bcc: normalizeEmailList(metadata.bcc),
      headers,
      tags,
      scheduledAt: toNonEmptyString(metadata.scheduledAt) ?? undefined,
    }

    let attempt = 0
    let latestError: { message: string; statusCode?: number; rateLimitInfo?: RateLimitInfo } | null = null
    const disableRetry = metadata.disableRetry === true

    while (attempt <= maxRetries) {
      const { data, error } = await client.emails.send(payload as never)

      if (!error) {
        return {
          ok: true,
          providerMessageId: isRecord(data) ? (toNonEmptyString(data['id']) ?? undefined) : undefined,
          latencyMs: Date.now() - startedAt,
        }
      }

      latestError = parseResendError(error)
      if (!shouldRetry(latestError.statusCode, attempt, maxRetries, disableRetry)) {
        return {
          ok: false,
          error: latestError.message,
          rateLimitInfo: latestError.rateLimitInfo,
          latencyMs: Date.now() - startedAt,
        }
      }

      const backoffMs = computeBackoffMs(attempt, latestError.rateLimitInfo?.retryAfterMs)
      await delay(backoffMs)
      attempt += 1
    }

    return {
      ok: false,
      error: latestError?.message ?? 'Email delivery failed',
      rateLimitInfo: latestError?.rateLimitInfo,
      latencyMs: Date.now() - startedAt,
    }
  },

  async healthCheck(credentials: Record<string, unknown>): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const { apiKey } = parseCredentials(credentials)
      const { Resend } = await import('resend')
      const client = new Resend(apiKey)
      await client.domains.list()
      return {
        provider: 'resend',
        status: 'ok',
        latencyMs: Date.now() - start,
        details: null,
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'resend',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
