/**
 * Ambient module declarations for optional OpenTelemetry packages.
 *
 * These provide a safe `any`-typed fallback so TypeScript compiles even when
 * the OTel packages are not installed in the environment. When the real packages
 * ARE installed, TypeScript uses their bundled types instead of these declarations.
 *
 * See: https://www.typescriptlang.org/docs/handbook/modules.html#ambient-modules
 */

declare module '@opentelemetry/sdk-node' {
  export const NodeSDK: unknown
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export function getNodeAutoInstrumentations(config?: Record<string, unknown>): unknown
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export const OTLPTraceExporter: unknown
}

declare module '@opentelemetry/resources' {
  export const Resource: unknown
  export function resourceFromAttributes(attrs: Record<string, unknown>): unknown
}

declare module '@opentelemetry/semantic-conventions' {
  export const SEMRESATTRS_SERVICE_NAME: string
  export const SEMRESATTRS_SERVICE_VERSION: string
  export const ATTR_SERVICE_NAME: string
  export const ATTR_SERVICE_VERSION: string
}

declare module '@opentelemetry/api' {
  export const trace: unknown
  export const context: unknown
  export const SpanStatusCode: { OK: number; ERROR: number; UNSET: number }
}
