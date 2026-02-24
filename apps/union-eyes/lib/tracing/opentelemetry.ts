/**
 * OpenTelemetry Distributed Tracing Configuration
 * 
 * Provides comprehensive distributed tracing across all services with:
 * - Automatic instrumentation of HTTP, Database, Redis
 * - Custom span creation for business logic
 * - Trace context propagation across services
 * - OTLP export to observability platforms (Honeycomb, Jaeger, etc.)
 * 
 * REQUIRED PACKAGES (install with: pnpm add -w):
 * - @opentelemetry/api
 * - @opentelemetry/sdk-node
 * - @opentelemetry/auto-instrumentations-node
 * - @opentelemetry/exporter-trace-otlp-http
 * - @opentelemetry/resources
 * - @opentelemetry/semantic-conventions
 * 
 * ENVIRONMENT VARIABLES:
 * - OTEL_SERVICE_NAME: Service name for traces (default: unioneyes)
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint URL (e.g., https://api.honeycomb.io)
 * - OTEL_EXPORTER_OTLP_HEADERS: Headers for authentication (e.g., x-honeycomb-team=your-api-key)
 * - OTEL_TRACES_SAMPLER: Sampling strategy (default: parentbased_always_on)
 * - OTEL_TRACES_SAMPLER_ARG: Sampling rate for probabilistic sampling
 * - OTEL_ENABLED: Enable/disable tracing (default: true in production)
 * 
 * Usage:
 *   import { initializeTracing } from '@/lib/tracing/opentelemetry';
 *   initializeTracing(); // Call once at app startup (instrumentation.ts)
 */

import { logger } from '@/lib/logger';

// Type-only imports to avoid runtime errors when packages not installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeSDK = any;
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
type Resource = any;
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
type OTLPTraceExporter = any;

let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry tracing
 * Must be called before any other application code
 */
export async function initializeTracing(): Promise<void> {
  // Skip if already initialized
  if (isInitialized) {
    logger.warn('OpenTelemetry already initialized, skipping');
    return;
  }

  // Skip if disabled
  const isEnabled = process.env.OTEL_ENABLED !== 'false';
  if (!isEnabled) {
    logger.info('OpenTelemetry tracing disabled via OTEL_ENABLED=false');
    return;
  }

  try {
    // Dynamic import to gracefully handle missing packages
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Resource } = await import('@opentelemetry/resources') as any;
    const { 
      SEMRESATTRS_SERVICE_NAME,
      SEMRESATTRS_SERVICE_VERSION,
      SEMRESATTRS_DEPLOYMENT_ENVIRONMENT 
    } = await import('@opentelemetry/semantic-conventions');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');

    const serviceName: string = process.env.OTEL_SERVICE_NAME || 'unioneyes';
    const environment: string = process.env.NODE_ENV || 'development';
    const version: string = process.env.npm_package_version || '1.0.0';

    // Configure resource attributes
    const resource = Resource.default().merge(
      new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: version,
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      })
    );

    // Configure OTLP exporter
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: parseOTLPHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
    });

    // Initialize SDK with auto-instrumentation
    sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable specific instrumentations if needed
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // File system operations are too noisy
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ignoreIncomingRequestHook: (request: any) => {
              // Ignore health checks and static assets
              const url: string = request.url || '';
              return url.includes('/health') || 
                     url.includes('/_next/static') ||
                     url.includes('/favicon.ico');
            },
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
          },
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - redis instrumentation may not be in type map
          '@opentelemetry/instrumentation-redis-4': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    await sdk.start();

    isInitialized = true;

    logger.info('OpenTelemetry tracing initialized', {
      serviceName,
      environment,
      version,
      exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });
  } catch (error) {
  if (error instanceof Error && error.message.includes('Cannot find module')) {
      logger.warn('OpenTelemetry packages not installed. Install with: pnpm add -w @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions');
    } else {
      logger.error('Failed to initialize OpenTelemetry tracing', { error });
    }
  }
}

/**
 * Shutdown OpenTelemetry gracefully
 * Call during application shutdown
 */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    logger.info('OpenTelemetry tracing shut down gracefully');
  } catch (error) {
    logger.error('Error shutting down OpenTelemetry', { error });
  }
}

/**
 * Parse OTLP headers from environment variable
 * Format: key1=value1,key2=value2
 */
function parseOTLPHeaders(headersStr: string | undefined): Record<string, string> {
  if (!headersStr) {
    return {};
  }

  const headers: Record<string, string> = {};
  
  headersStr.split(',').forEach(pair => {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      headers[key.trim()] = valueParts.join('=').trim();
    }
  });

  return headers;
}

/**
 * Get the current trace context for logging correlation
 * Returns trace_id and span_id for structured logging
 */
export function getTraceContext(): { trace_id?: string; span_id?: string } {
  try {
    // Dynamic import to avoid errors when packages not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { trace, context } = require('@opentelemetry/api');
    
    const span = trace.getSpan(context.active());
    if (!span) {
      return {};
    }

    const spanContext = span.spanContext();
    return {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
    };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return {};
  }
}
