import winston from 'winston'

export interface FinancialLogMeta {
  operation?: string
  correlationId?: string
  organizationId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
})

// Keep error serialization consistent and payload-safe at runtime boundaries.
const toErrorMeta = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: String(error),
  }
}

export const financialLogger = {
  info: (message: string, meta: FinancialLogMeta = {}) => {
    baseLogger.info(message, meta)
  },
  warn: (message: string, meta: FinancialLogMeta = {}) => {
    baseLogger.warn(message, meta)
  },
  error: (message: string, error?: unknown, meta: FinancialLogMeta = {}) => {
    const errMeta = error === undefined ? {} : { error: toErrorMeta(error) }
    baseLogger.error(message, { ...meta, ...errMeta })
  },
}
