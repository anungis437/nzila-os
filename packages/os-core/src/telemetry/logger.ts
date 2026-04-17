/**
 * @nzila/os-core — Structured Logger
 *
 * All application logging must use this logger to ensure:
 * - JSON-structured output in production
 * - Automatic requestId + traceId injection from context
 * - Consistent log levels across all apps
 */
import { getRequestContext } from './requestContext'

// ── Types ─────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  requestId?: string
  traceId?: string
  userId?: string
  orgId?: string
  appName?: string
  [key: string]: unknown
}

// ── Logger factory ────────────────────────────────────────────────────────

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown> | Error): void
}

function isError(val: unknown): val is Error {
  return val instanceof Error
}

function buildEntry(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown> | Error,
  namespace?: string,
): LogEntry {
  const ctx = getRequestContext()
  const errorFields: Record<string, unknown> = {}

  if (isError(meta)) {
    errorFields.errorName = meta.name
    errorFields.errorMessage = meta.message
    errorFields.errorStack = meta.stack
    meta = undefined
  }

  return {
    level,
    message: namespace ? `[${namespace}] ${message}` : message,
    timestamp: new Date().toISOString(),
    requestId: ctx?.requestId,
    traceId: ctx?.traceId,
    userId: ctx?.userId,
    orgId: ctx?.orgId,
    appName: ctx?.appName,
    ...errorFields,
    ...(meta ?? {}),
  }
}

function writeEntry(entry: LogEntry): void {
  const output = JSON.stringify(entry)
  if (entry.level === 'error' || entry.level === 'warn') {
    console.error(output)
  } else {
    console.log(output)
  }
}

// ── PII redaction ─────────────────────────────────────────────────────────

/**
 * List of field keys (case-insensitive) whose values should be redacted.
 * Extend this list to cover any new sensitive fields.
 */
const REDACT_KEYS = new Set([
  'email',
  'phone',
  'phonenumber',
  'ssn',
  'taxid',
  'bankaccount',
  'accountnumber',
  'routingnumber',
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'authorization',
  'databaseurl',
  'database_url',
  'connectionstring',
  'connection_string',
])

/**
 * Recursively walk an object and replace the _values_ of any key whose
 * lowercase name appears in REDACT_KEYS with the string `"[REDACTED]"`.
 *
 * - Top-level string values that look like `Bearer …` are also redacted
 *   regardless of key name.
 * - Arrays are traversed element-by-element.
 * - The original object is never mutated; a deep copy is returned.
 *
 * @example
 * ```ts
 * logger.info('checkout', redactFields({ userId, email, amount }))
 * // => { userId: '…', email: '[REDACTED]', amount: 9.99 }
 * ```
 */
export function redactFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  return _redactValue(obj) as Record<string, unknown>
}

function _redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(_redactValue)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = _redactValue(v)
      }
    }
    return out
  }
  // Redact raw Bearer tokens even when not nested under a recognised key
  if (
    typeof value === 'string' &&
    /^Bearer\s+\S+$/i.test(value.trim())
  ) {
    return '[REDACTED]'
  }
  return value
}

// ── Logger factory ────────────────────────────────────────────────────────

/**
 * Creates a namespaced logger.
 *
 * Usage:
 *   const logger = createLogger('evidence')
 *   logger.info('Pack sealed', { packId, runId })
 */
export function createLogger(namespace?: string): Logger {
  return {
    debug(message, meta) {
      if (process.env.LOG_LEVEL === 'debug') {
        writeEntry(buildEntry('debug', message, meta, namespace))
      }
    },
    info(message, meta) {
      writeEntry(buildEntry('info', message, meta, namespace))
    },
    warn(message, meta) {
      writeEntry(buildEntry('warn', message, meta, namespace))
    },
    error(message, meta) {
      writeEntry(buildEntry('error', message, meta, namespace))
    },
  }
}

/** Global root logger. */
export const logger = createLogger()

/** Create a child logger that inherits the namespace and adds subnamespace. */
export function childLogger(parent: string, child: string): Logger {
  return createLogger(`${parent}:${child}`)
}
