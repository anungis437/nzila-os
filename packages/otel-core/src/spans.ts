/**
 * Nzila-specific span creation and attribute injection.
 *
 * Enriches every span with org/workflow context for
 * cost attribution and evidence correlation.
 */

interface NzilaSpanAttributes {
  /** Organization ID — required for all org-scoped operations */
  'nzila.org.id'?: string;
  /** User ID performing the action */
  'nzila.user.id'?: string;
  /** Business process identifier */
  'nzila.workflow.id'?: string;
  /** Evidence pack ID if this operation creates evidence */
  'nzila.evidence.pack_id'?: string;
  /** Compute resource type for cost attribution */
  'compute.resource.type'?: 'lambda' | 'container' | 'edge' | 'serverless';
  /** Actual execution time in milliseconds */
  'compute.duration.ms'?: number;
  /** Memory allocation in MB */
  'compute.memory.mb'?: number;
  /** AI model ID if this is an AI invocation */
  'nzila.ai.model_id'?: string;
  /** AI risk tier */
  'nzila.ai.risk_tier'?: 'low' | 'medium' | 'high';
}

type SpanCallback<T> = (span: {
  setAttribute: (key: string, value: string | number | boolean) => void;
  addEvent: (name: string, attributes?: Record<string, string | number | boolean>) => void;
  setStatus: (status: { code: number; message?: string }) => void;
  end: () => void;
}) => Promise<T>;

/**
 * Create a Nzila-enriched span with automatic attribute injection.
 * Falls back to no-op if OpenTelemetry is not available.
 */
export async function createNzilaSpan<T>(
  name: string,
  attributes: NzilaSpanAttributes,
  fn: SpanCallback<T>,
): Promise<T> {
  try {
    const { trace, SpanStatusCode } = await import('@opentelemetry/api');
    const tracer = trace.getTracer('@nzila/otel-core');
    return tracer.startActiveSpan(name, async (span) => {
      // Inject all Nzila-specific attributes
      for (const [key, value] of Object.entries(attributes)) {
        if (value !== undefined) {
          span.setAttribute(key, value);
        }
      }
      try {
        const result = await fn({
          setAttribute: (k, v) => span.setAttribute(k, v),
          addEvent: (n, a) => span.addEvent(n, a),
          setStatus: (s) =>
            span.setStatus({
              code: s.code,
              message: s.message,
            }),
          end: () => span.end(),
        });
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  } catch {
    // OTel not available — execute without tracing
    const noopSpan = {
      setAttribute: () => {},
      addEvent: () => {},
      setStatus: () => {},
      end: () => {},
    };
    return fn(noopSpan);
  }
}

/**
 * Shorthand for wrapping an async function with Nzila span attributes.
 * Automatically extracts orgId from the request context.
 */
export async function withNzilaSpan<T>(
  name: string,
  orgId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return createNzilaSpan(
    name,
    {
      'nzila.org.id': orgId,
    },
    async () => fn(),
  );
}

/**
 * Add Nzila attributes to the currently active span.
 */
export async function addNzilaAttributes(
  attributes: NzilaSpanAttributes,
): Promise<void> {
  try {
    const { trace } = await import('@opentelemetry/api');
    const span = trace.getActiveSpan();
    if (span) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value !== undefined) {
          span.setAttribute(key, value);
        }
      }
    }
  } catch {
    // OTel not available — no-op
  }
}
