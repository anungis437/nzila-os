/**
 * @nzila/os-core — Telemetry module barrel export
 *
 * Import from '@nzila/os-core/telemetry'
 */
export { createRequestContext, getRequestContext, runWithContext, contextToHeaders } from './requestContext'
export type { RequestContext } from './requestContext'
export { createLogger, logger, childLogger } from './logger'
export type { Logger, LogLevel, LogEntry } from './logger'
export { initOtel, withSpan } from './otel'
export type { OtelConfig } from './otel'
