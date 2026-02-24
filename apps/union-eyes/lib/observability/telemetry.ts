/**
 * OpenTelemetry Distributed Tracing Configuration
 * 
 * Implements distributed tracing across the application to track
 * request flows, identify bottlenecks, and monitor service dependencies.
 * 
 * Features:
 * - Automatic HTTP request instrumentation
 * - Database query tracing
 * - Custom span creation for business logic
 * - Integration with Sentry for error correlation
 * - OTLP export to observability platforms
 * 
 * Usage:
 * ```typescript
 * import { trace } from './lib/observability/telemetry';
 * 
 * const tracer = trace.getTracer('claims-service');
 * const span = tracer.startSpan('processClaimSubmission');
 * 
 * try {
 *   // Business logic
 *   span.setAttribute('claim.id', claimId);
 *   span.addEvent('claim_validated');
 * } finally {
 *   span.end();
 * }
 * ```
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - @opentelemetry packages may not be installed
import { NodeSDK } from '@opentelemetry/sdk-node';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Resource } from '@opentelemetry/resources';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, propagation } from '@opentelemetry/api';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

/**
 * Initialize OpenTelemetry SDK
 * 
 * Call this once at application startup (instrumentation.ts)
 */
export function initializeTelemetry(): NodeSDK | null {
  // Only enable in production or if explicitly configured
  const telemetryEnabled = process.env.OTEL_ENABLED === 'true' || 
                          process.env.NODE_ENV === 'production';
  
  if (!telemetryEnabled) {
return null;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'union-eyes-app';
  const environment = process.env.NODE_ENV || 'development';
  const version = process.env.npm_package_version || 
                 process.env.VERCEL_GIT_COMMIT_SHA || 
                 'unknown';

  // Configure resource attributes
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Resource constructor from @opentelemetry/resources
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: version,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
  });

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS 
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {},
  });

  // Initialize SDK
  const sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(traceExporter),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable specific instrumentations if needed
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // File system calls can be noisy
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (request) => {
            // Don&apos;t trace health checks and static assets
            const url = request.url || '';
            return url.includes('/api/health') || 
                   url.includes('/_next/') ||
                   url.includes('/favicon.ico');
          },
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true, // PostgreSQL query tracing
        },
      }),
    ],
  });

  try {
    sdk.start();
// Graceful shutdown on process termination
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => undefined)
        .catch((_error) => undefined)
        .finally(() => process.exit(0));
    });

    return sdk;
  } catch (_error) {
return null;
  }
}

/**
 * Create a custom span for business logic tracing
 * 
 * @example
 * ```typescript
 * await withSpan('processPayment', async (span) => {
 *   span.setAttribute('payment.amount', amount);
 *   span.setAttribute('payment.method', 'stripe');
 *   
 *   const result = await stripe.charges.create(...);
 *   
 *   span.addEvent('payment_completed', { chargeId: result.id });
 *   return result;
 * });
 * ```
 */
export async function withSpan<T>(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (span: any) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = trace.getTracer('union-eyes');
  const span = tracer.startSpan(name, { attributes });
  
  try {
    const result = await context.with(trace.setSpan(context.active(), span), async () => {
      return await fn(span);
    });
    
    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (error) {
    span.setStatus({ 
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add a custom event to the current active span
 */
export function addSpanEvent(
  name: string, 
  attributes?: Record<string, string | number | boolean>
): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current active span
 */
export function setSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
  const span = trace.getActiveSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
}

/**
 * Get current trace context for propagation
 */
export function getCurrentTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

// Export trace API for direct access
export { trace };

