/**
 * @nzila/governance-otel — Adapter
 *
 * Maps a governance event envelope to an OpenTelemetry span. The host
 * application is responsible for SDK initialisation; this adapter only
 * uses the global OTel API.
 *
 * @module @nzila/governance-otel/adapter
 */
import {
  context as otelContext,
  trace,
  SpanStatusCode,
  type Span,
  type Tracer,
} from '@opentelemetry/api'

import type { GovernanceEventEnvelopeLike, GovernanceSeverity } from './types'

const TRACER_NAME = 'nzila.governance'

/** Forbidden attribute keys — mirror of the schema-layer payload screen. */
const FORBIDDEN_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  'userId',
  'user_id',
  'employeeId',
  'employee_id',
  'email',
  'phone',
  'ip',
  'ipAddress',
  'sessionId',
  'session_id',
])

export interface GovernanceTracerOptions {
  readonly version?: string
}

export function createGovernanceTracer(options: GovernanceTracerOptions = {}): Tracer {
  return trace.getTracer(TRACER_NAME, options.version)
}

/**
 * Open a span for one envelope, set governance attributes, and end it.
 * Returns the span name for caller logging.
 */
export function emitGovernanceSpan(
  envelope: GovernanceEventEnvelopeLike,
  tracer: Tracer = createGovernanceTracer(),
): string {
  const spanName = `governance.${envelope.type}`
  const span = tracer.startSpan(spanName)
  applyEnvelopeAttributes(span, envelope)
  span.setStatus({ code: severityToStatus(envelope.severity) })
  span.end()
  return spanName
}

/**
 * Wrap a function call in a governance span. The envelope is recorded
 * up-front; the optional `enrich` callback may amend attributes (e.g.,
 * with a final decision) before the span ends.
 */
export async function withGovernanceSpan<T>(
  envelope: GovernanceEventEnvelopeLike,
  fn: (span: Span) => Promise<T> | T,
  options: { readonly tracer?: Tracer; readonly enrich?: (result: T, span: Span) => void } = {},
): Promise<T> {
  const tracer = options.tracer ?? createGovernanceTracer()
  const spanName = `governance.${envelope.type}`
  const span = tracer.startSpan(spanName)
  applyEnvelopeAttributes(span, envelope)

  try {
    const result = await otelContext.with(
      trace.setSpan(otelContext.active(), span),
      () => fn(span),
    )
    options.enrich?.(result, span)
    span.setStatus({ code: severityToStatus(envelope.severity) })
    return result
  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  } finally {
    span.end()
  }
}

function applyEnvelopeAttributes(
  span: Span,
  envelope: GovernanceEventEnvelopeLike,
): void {
  span.setAttribute('nzila.governance.event_type', envelope.type)
  span.setAttribute('nzila.governance.severity', envelope.severity)
  span.setAttribute('nzila.governance.schema_version', envelope.schemaVersion)
  span.setAttribute('nzila.governance.product', envelope.scope.product)
  span.setAttribute('nzila.governance.environment_class', envelope.scope.environmentClass)
  span.setAttribute('nzila.governance.subject_kind', envelope.subject.kind)
  span.setAttribute('nzila.governance.subject_id', envelope.subject.id)
  span.setAttribute('nzila.governance.release_id', envelope.releaseId)
  span.setAttribute('nzila.governance.event_id', envelope.id)

  if (envelope.decision) {
    span.setAttribute('nzila.governance.decision', envelope.decision)
  }

  const firstCitation = envelope.doctrineCitations?.[0]
  if (firstCitation) {
    span.setAttribute('nzila.governance.doctrine_doc', firstCitation.document)
  }

  if (envelope.correlationKey) {
    span.setAttribute('nzila.governance.correlation_key', envelope.correlationKey)
  }

  // Refuse forbidden payload keys at the attribute boundary. Allow other
  // primitive payload values, truncated to keep spans short.
  for (const [key, value] of Object.entries(envelope.payload)) {
    if (FORBIDDEN_ATTRIBUTE_KEYS.has(key)) continue
    if (value === undefined || value === null) continue
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      continue
    }
    const stringValue = String(value)
    if (stringValue.length > 128) continue
    span.setAttribute(`nzila.governance.payload.${key}`, stringValue)
  }
}

function severityToStatus(severity: GovernanceSeverity): SpanStatusCode {
  switch (severity) {
    case 'critical':
      return SpanStatusCode.ERROR
    case 'warning':
    case 'info':
    default:
      return SpanStatusCode.OK
  }
}

export const FORBIDDEN_OTEL_ATTRIBUTE_KEYS = FORBIDDEN_ATTRIBUTE_KEYS
