/**
 * @nzila/os-core — Telemetry module barrel export
 *
 * Import from '@nzila/os-core/telemetry'
 */
export { createRequestContext, getRequestContext, runWithContext, contextToHeaders } from './requestContext'
export type { RequestContext } from './requestContext'
export { createLogger, logger, childLogger, redactFields } from './logger'
export type { Logger, LogLevel, LogEntry } from './logger'
export { initOtel, withSpan } from './otel'
export type { OtelConfig } from './otel'
export { metrics, initMetrics, SLO_DEFINITIONS } from './metrics'
export type { SloDefinition, MetricCounter, MetricHistogram } from './metrics'
export { createAppBoot } from './boot'
export type { AppBootOptions } from './boot'
