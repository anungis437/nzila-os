/**
 * Fastify enforcement adapter.
 *
 * Provides a preHandler hook that runs the enforcement pipeline before
 * the route handler executes.
 *
 * Usage:
 *   import { enforcementPlugin } from "@nzila/enforcement/fastify";
 *
 *   fastify.register(enforcementPlugin, {
 *     layers: [traceLayer(), authLayer(authConfig), auditLayer(auditConfig)],
 *     resourceType: "workflow",
 *     exclude: ["/health"],
 *   });
 */

import type { EnforcementContext, EnforcementLayer, EnforcementResult } from "./pipeline.js";
import { createContext } from "./handler.js";
import { composePipeline } from "./pipeline.js";

export interface FastifyEnforcementConfig {
  /** Enforcement layers to apply (order matters). */
  layers: EnforcementLayer[];
  /** Default resource type for all routes under this plugin. */
  resourceType: string;
  /** Routes to exclude from enforcement (e.g. ["/health"]). */
  exclude?: string[];
}

/**
 * Route-level enforcement options.
 * Attach to a route's config to override plugin-level defaults.
 */
export interface RouteEnforcementConfig {
  /** Override resourceType for this route. */
  resourceType?: string;
  /** Override action for this route. */
  action?: string;
  /** Additional layers for this route. */
  additionalLayers?: EnforcementLayer[];
  /** Skip enforcement for this route. */
  skip?: boolean;
}

/**
 * Map HTTP method to action verb.
 */
function methodToAction(method: string): string {
  switch (method.toUpperCase()) {
    case "GET": return "read";
    case "POST": return "create";
    case "PUT": return "update";
    case "PATCH": return "update";
    case "DELETE": return "delete";
    default: return method.toLowerCase();
  }
}

/**
 * Extract headers from a Fastify-compatible request object.
 */
function extractFastifyHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

/**
 * Fastify plugin that adds enforcement as a preHandler.
 *
 * Compatible with Fastify v4+ plugin signature.
 * Register with `fastify.register(enforcementPlugin, opts)`.
 */
export function enforcementPlugin(
  fastify: {
    addHook: (
      hook: string,
      handler: (request: unknown, reply: unknown) => Promise<void>,
    ) => void;
  },
  opts: FastifyEnforcementConfig,
  done: () => void,
): void {
  const excludeSet = new Set(opts.exclude ?? []);

  fastify.addHook(
    "preHandler",
    async (
      rawRequest: unknown,
      rawReply: unknown,
    ) => {
      const request = rawRequest as {
        method: string;
        url: string;
        headers: Record<string, string | string[] | undefined>;
        body?: unknown;
        routeOptions?: { config?: { enforcement?: RouteEnforcementConfig } };
      };
      const reply = rawReply as {
        code: (status: number) => { send: (body: unknown) => void };
        header: (name: string, value: string) => void;
      };
      // Check exclusions
      const path = request.url.split("?")[0] ?? request.url;
      if (excludeSet.has(path)) return;

      // Check route-level skip
      const routeConfig = request.routeOptions?.config?.enforcement;
      if (routeConfig?.skip) return;

      const resourceType = routeConfig?.resourceType ?? opts.resourceType;
      const action = routeConfig?.action ?? methodToAction(request.method);
      const layers = routeConfig?.additionalLayers
        ? [...opts.layers, ...routeConfig.additionalLayers]
        : opts.layers;

      const ctx = createContext({
        action,
        resourceType,
        route: path,
        headers: extractFastifyHeaders(request.headers),
        body: request.body != null ? JSON.stringify(request.body) : undefined,
      });

      // Build a pipeline with a pass-through terminal layer
      // (the actual Fastify handler runs after preHandler if enforcement passes)
      const passThroughLayer: EnforcementLayer = async (_ctx) => {
        return { success: true, status: 200 };
      };

      const pipeline = composePipeline([...layers, passThroughLayer]);
      const result: EnforcementResult = await pipeline(ctx);

      // Attach traceId to response headers
      reply.header("X-Trace-Id", ctx.traceId);

      if (!result.success) {
        reply.code(result.status).send(result.body ?? { error: "Forbidden" });
        return;
      }

      // Attach enforcement context to request for downstream use
      (request as Record<string, unknown>).enforcementContext = ctx;
    },
  );

  done();
}
