/**
 * Fastify OpenTelemetry Plugin for orchestrator-api
 *
 * Wraps @fastify/otel with Nzila-specific context enrichment:
 * - Injects orgId from x-org-id header
 * - Cost attribution per request
 * - Evidence correlation for governance operations
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

interface NzilaOtelPluginOptions {
  serviceName: string;
  enableCostAttribution?: boolean;
  enableEvidenceCorrelation?: boolean;
}

async function nzilaOtelPlugin(
  fastify: FastifyInstance,
  opts: NzilaOtelPluginOptions,
): Promise<void> {
  // Register @fastify/otel if available
  try {
    const { default: fastifyOtel } = await import('@fastify/otel');
    // Cast required: @fastify/otel exports a class (InstrumentationBase); the
    // actual runtime value is compatible with fastify.register() but TypeScript
    // cannot verify it without the package installed.
    await fastify.register(fastifyOtel as unknown as Parameters<typeof fastify.register>[0], {
      wrapRoutes: true,
      exposeApi: true,
    });
    fastify.log.info(`OTel registered for ${opts.serviceName}`);
  } catch {
    fastify.log.warn('OTel plugin not available — running without trace instrumentation');
  }

  // Inject Nzila-specific attributes on every request
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    try {
      const { trace } = await import('@opentelemetry/api');
      const span = trace.getActiveSpan();
      if (!span) return;

      const orgId = request.headers['x-org-id'] as string | undefined;
      const userId = request.headers['x-user-id'] as string | undefined;
      const requestId = request.headers['x-request-id'] as string | undefined;

      if (orgId) {
        span.setAttribute('nzila.org.id', orgId);
      }
      if (userId) {
        span.setAttribute('nzila.user.id', userId);
      }
      if (requestId) {
        span.setAttribute('nzila.request.id', requestId);
      }

      // Set compute resource type
      span.setAttribute('compute.resource.type', 'container');
    } catch {
      // OTel not available
    }
  });

  // Record response metrics for SLO tracking
  fastify.addHook('onResponse', async (request, reply) => {
    try {
      const { trace } = await import('@opentelemetry/api');
      const span = trace.getActiveSpan();
      if (!span) return;

      span.setAttribute('http.response.status_code', reply.statusCode);
      span.setAttribute('compute.duration.ms', reply.elapsedTime);

      // Cost attribution
      if (opts.enableCostAttribution) {
        const memoryMb = process.memoryUsage().heapUsed / (1024 * 1024);
        span.setAttribute('compute.memory.mb', Math.round(memoryMb));
      }
    } catch {
      // OTel not available
    }
  });
}

export default fp(nzilaOtelPlugin, {
  name: '@nzila/otel-fastify',
  fastify: '5.x',
});
