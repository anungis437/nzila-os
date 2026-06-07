/**
 * Tracing Utilities - Business Logic Instrumentation
 * 
 * Provides helper functions for adding custom tracing to business logic:
 * - Automatic span creation with error handling
 * - Attribute management for spans
 * - Context propagation
 * - Integration with structured logging
 * 
 * Usage Examples:
 * 
 * 1. Trace an async function:
 * ```typescript
 * import { traced } from '@/lib/tracing/utils';
 * 
 * const result = await traced('process-claim', async (span) => {
 *   span.setAttribute('claim.id', claimId);
 *   span.setAttribute('claim.type', claimType);
 *   
 *   const claim = await processClaim(claimId);
 *   return claim;
 * });
 * ```
 * 
 * 2. Trace a specific code block:
 * ```typescript
 * import { startSpan } from '@/lib/tracing/utils';
 * 
 * const span = startSpan('calculate-pension');
 * try {
 *   span.setAttribute('member.id', memberId);
 *   const result = calculatePension(memberId);
 *   span.setStatus({ code: SpanStatusCode.OK });
 *   return result;
 * } catch (error) {
 *   span.recordException(error);
 *   span.setStatus({ code: SpanStatusCode.ERROR });
 *   throw error;
 * } finally {
 *   span.end();
 * }
 * ```
 * 
 * 3. Add trace context to logs:
 * ```typescript
 * import { getTraceContext } from '@/lib/tracing/utils';
 * 
 * logger.info('Processing claim', {
 *   claimId,
 *   ...getTraceContext(), // Adds trace_id and span_id
 * });
 * ```
 */

import { logger } from '@/lib/logger';

// Type definitions for OpenTelemetry (to avoid import errors when not installed)
export enum SpanStatusCode {
  /** The default status. */
  UNSET = 0,
  /** The operation has been validated by an Application developer or Operator to have completed successfully. */
  OK = 1,
  /** The operation contains an error. */
  ERROR = 2,
}

export interface Span {
  setAttribute(key: string, value: unknown): this;
  setAttributes(attributes: Record<string, unknown>): this;
  addEvent(name: string, attributes?: Record<string, unknown>): this;
  spanContext(): { traceId: string; spanId: string };
  recordException(exception: Error | string, time?: number): this;
  setStatus(status: { code: SpanStatusCode; message?: string }): this;
  end(endTime?: number): void;
  isRecording(): boolean;
}

export interface Tracer {
  startSpan(name: string, options?: unknown): Span;
  startActiveSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
  startActiveSpan<T>(name: string, options: unknown, fn: (span: Span) => Promise<T>): Promise<T>;
}

interface OTelAPI {
  trace: {
    getTracer(name: string, version?: string): Tracer;
    getSpan(context: unknown): Span | undefined;
  };
  context: {
    active(): unknown;
  };
  SpanStatusCode: typeof SpanStatusCode;
}

// Lazy-loaded OpenTelemetry API
let otelApi: OTelAPI | null = null;

/**
 * Get OpenTelemetry API (lazy-loaded)
 */
function getOTelAPI() {
  if (otelApi) {
    return otelApi;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    otelApi = require('@opentelemetry/api') as OTelAPI;
    return otelApi;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // Return no-op implementation if OpenTelemetry not installed
    return null;
  }
}

/**
 * Get the default tracer for the application
 */
export function getTracer(name: string = 'unioneyes'): Tracer {
  const api = getOTelAPI();
  
  if (!api) {
    // Return no-op tracer if OpenTelemetry not available
    return createNoOpTracer();
  }

  return api.trace.getTracer(name, process.env.npm_package_version || '1.0.0');
}

/**
 * Trace an async function with automatic span management
 * Automatically handles errors and span lifecycle
 */
export async function traced<T>(
  spanName: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  const tracer = getTracer();
  const api = getOTelAPI();

  if (!api) {
    // Execute function without tracing if OpenTelemetry not available
    const noOpSpan = createNoOpSpan();
    return await fn(noOpSpan);
  }

  return tracer.startActiveSpan(spanName, async (span: Span) => {
    try {
      // Add initial attributes
      if (attributes) {
        span.setAttributes(attributes);
      }

      // Execute the traced function
      const result = await fn(span);

      // Mark as successful
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error) {
      // Record the exception
      span.recordException(error as Error);
      span.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });

      // Log with trace context
      logger.error(`Traced function error: ${spanName}`, {
        error,
        ...getTraceContext(),
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Start a new span manually
 * Remember to call span.end() when done
 */
export function startSpan(
  spanName: string,
  attributes?: Record<string, unknown>
): Span {
  const tracer = getTracer();
  const span = tracer.startSpan(spanName);

  if (attributes) {
    span.setAttributes(attributes);
  }

  return span;
}

/**
 * Get current trace context for logging correlation
 * Returns trace_id and span_id
 */
export function getTraceContext(): { trace_id?: string; span_id?: string } {
  const api = getOTelAPI();
  
  if (!api) {
    return {};
  }

  try {
    const span = api.trace.getSpan(api.context.active());
    if (!span) {
      return {};
    }

    const spanContext = span.spanContext();
    return {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
    };
  } catch {
    return {};
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, unknown>
): void {
  const api = getOTelAPI();
  
  if (!api) {
    return;
  }

  try {
    const span = api.trace.getSpan(api.context.active());
    if (span) {
      span.addEvent(name, attributes);
    }
  } catch {
    // Silently ignore if tracing unavailable
  }
}

/**
 * Set attributes on the current span
 */
export function setSpanAttributes(
  attributes: Record<string, unknown>
): void {
  const api = getOTelAPI();
  
  if (!api) {
    return;
  }

  try {
    const span = api.trace.getSpan(api.context.active());
    if (span) {
      span.setAttributes(attributes);
    }
  } catch (error) {
    logger.warn('Failed to set span attributes', { error });
  }
}

/**
 * Record an exception in the current span
 */
export function recordException(error: Error | string): void {
  const api = getOTelAPI();
  
  if (!api) {
    return;
  }

  try {
    const span = api.trace.getSpan(api.context.active());
    if (span) {
      span.recordException(error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
    }
  } catch (err) {
    logger.warn('Failed to record exception in span', { error: err });
  }
}

/**
 * Common attribute keys for consistent tracing
 */
export const TraceAttributes = {
  // User/Member
  USER_ID: 'user.id',
  MEMBER_ID: 'member.id',
  ORGANIZATION_ID: 'organization.id',
  UNION_ID: 'union.id',
  
  // Claims
  CLAIM_ID: 'claim.id',
  CLAIM_TYPE: 'claim.type',
  CLAIM_STATUS: 'claim.status',
  CLAIM_AMOUNT: 'claim.amount',
  
  // Payments
  PAYMENT_ID: 'payment.id',
  PAYMENT_TYPE: 'payment.type',
  PAYMENT_AMOUNT: 'payment.amount',
  PAYMENT_CURRENCY: 'payment.currency',
  
  // Documents
  DOCUMENT_ID: 'document.id',
  DOCUMENT_TYPE: 'document.type',
  DOCUMENT_SIZE_BYTES: 'document.size_bytes',
  
  // Database
  DB_OPERATION: 'db.operation',
  DB_TABLE: 'db.table',
  DB_QUERY_DURATION_MS: 'db.query.duration_ms',
  
  // HTTP
  HTTP_METHOD: 'http.method',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_ROUTE: 'http.route',
  HTTP_USER_AGENT: 'http.user_agent',
  
  // Business Logic
  OPERATION_TYPE: 'operation.type',
  OPERATION_NAME: 'operation.name',
  OPERATION_SUCCESS: 'operation.success',
} as const;

/**
 * Create a no-op tracer for when OpenTelemetry is not available
 */
function createNoOpTracer(): Tracer {
  return {
    startSpan: () => createNoOpSpan(),
    startActiveSpan: async <T>(_nameOrOptions: unknown, fnOrOptions?: unknown, fn?: unknown): Promise<T> => {
      const actualFn = (typeof fnOrOptions === 'function' ? fnOrOptions : fn) as ((span: Span) => Promise<T>) | undefined;
      if (!actualFn) {
        throw new Error('No-op tracer requires a callback');
      }
      return await actualFn(createNoOpSpan());
    },
  };
}

/**
 * Create a no-op span for when OpenTelemetry is not available
 */
function createNoOpSpan(): Span {
  return {
    setAttribute: () => createNoOpSpan(),
    setAttributes: () => createNoOpSpan(),
    addEvent: () => createNoOpSpan(),
    spanContext: () => ({ traceId: '00000000000000000000000000000000', spanId: '0000000000000000' }),
    recordException: () => createNoOpSpan(),
    setStatus: () => createNoOpSpan(),
    end: () => {},
    isRecording: () => false,
  };
}
