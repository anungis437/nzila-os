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
    appName: ctx?.appName,
    ...errorFields,
    ...(meta ?? {}),
  }
}

function writeEntry(entry: LogEntry): void {
  const output = JSON.stringify(entry)
  if (entry.level === 'error' || entry.level === 'warn') {
    process.stderr.write(output + '\n')
  } else {
    process.stdout.write(output + '\n')
  }
}

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
