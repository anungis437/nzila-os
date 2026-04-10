import { getTraceContext } from './context'

// ─── Log Levels ─────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// ─── Log Entry ──────────────────────────────────────────────────────────────

export interface LogEntry {
  readonly timestamp: string
  readonly level: LogLevel
  readonly event: string
  readonly trace_id: string | undefined
  readonly span_id: string | undefined
  readonly tenant_id: string | undefined
  readonly actor_id: string | undefined
  readonly request_id: string | undefined
  readonly metadata: Record<string, unknown>
}

// ─── Logger Configuration ───────────────────────────────────────────────────

export interface LoggerConfig {
  readonly service: string
  readonly minLevel: LogLevel
  readonly sink: (entry: LogEntry) => void
}

const defaultSink = (entry: LogEntry): void => {
  const output = JSON.stringify(entry)
  if (entry.level === 'error') {
    process.stderr.write(output + '\n')
  } else {
    process.stdout.write(output + '\n')
  }
}

// ─── Logger ─────────────────────────────────────────────────────────────────

export class TracedLogger {
  private readonly config: LoggerConfig

  constructor(config: Partial<LoggerConfig> & { service: string }) {
    this.config = {
      service: config.service,
      minLevel: config.minLevel ?? 'info',
      sink: config.sink ?? defaultSink,
    }
  }

  debug(event: string, metadata: Record<string, unknown> = {}): void {
    this.log('debug', event, metadata)
  }

  info(event: string, metadata: Record<string, unknown> = {}): void {
    this.log('info', event, metadata)
  }

  warn(event: string, metadata: Record<string, unknown> = {}): void {
    this.log('warn', event, metadata)
  }

  error(event: string, metadata: Record<string, unknown> = {}): void {
    this.log('error', event, metadata)
  }

  child(extra: Record<string, unknown>): TracedLogger {
    const childLogger = new TracedLogger(this.config)
    const originalLog = childLogger.log.bind(childLogger)
    childLogger.log = (level: LogLevel, event: string, metadata: Record<string, unknown>) => {
      originalLog(level, event, { ...extra, ...metadata })
    }
    return childLogger
  }

  private log(level: LogLevel, event: string, metadata: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) {
      return
    }

    const ctx = getTraceContext()

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      trace_id: ctx?.traceId,
      span_id: ctx?.spanId,
      tenant_id: ctx?.tenantId,
      actor_id: ctx?.actorId,
      request_id: ctx?.requestId,
      metadata: {
        service: this.config.service,
        ...metadata,
      },
    }

    this.config.sink(entry)
  }
}

export function createLogger(service: string, options?: Partial<LoggerConfig>): TracedLogger {
  return new TracedLogger({ service, ...options })
}
