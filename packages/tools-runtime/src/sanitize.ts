/**
 * @nzila/tools-runtime — Sanitize tool call logs
 *
 * Removes secrets, PII, and sensitive data from tool call inputs/outputs
 * before persisting to toolCallsJson.
 */
import { createHash } from 'node:crypto'

// ── Sensitive patterns ──────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'sessionId',
  'session_id',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'ssn',
  'sin',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'accountKey',
  'account_key',
  'connectionString',
  'connection_string',
])

// ── Sanitize ────────────────────────────────────────────────────────────────

/**
 * Deep-sanitize an object by redacting sensitive keys.
 * Returns a new object with sensitive values replaced by "[REDACTED]".
 */
export function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj

  if (Array.isArray(obj)) {
    return obj.map(sanitize)
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = sanitize(value)
      }
    }
    return result
  }

  return String(obj)
}

/**
 * Compute SHA-256 of sanitized JSON representation.
 */
export function hashSanitized(data: unknown): string {
  const sanitized = sanitize(data)
  return createHash('sha256').update(JSON.stringify(sanitized)).digest('hex')
}

// ── Tool call logger ────────────────────────────────────────────────────────

export interface ToolCallEntry {
  toolName: string
  startedAt: string
  finishedAt: string
  inputsHash: string
  outputsHash: string
  status: 'success' | 'error'
  error?: string
}

/**
 * Create a tool call log entry with sanitized hashes.
 */
export function createToolCallEntry(opts: {
  toolName: string
  startedAt: Date
  finishedAt: Date
  inputs: unknown
  outputs: unknown
  status: 'success' | 'error'
  error?: string
}): ToolCallEntry {
  return {
    toolName: opts.toolName,
    startedAt: opts.startedAt.toISOString(),
    finishedAt: opts.finishedAt.toISOString(),
    inputsHash: hashSanitized(opts.inputs),
    outputsHash: hashSanitized(opts.outputs),
    status: opts.status,
    error: opts.error,
  }
}
