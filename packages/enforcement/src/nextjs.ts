/**
 * Next.js App Router enforcement adapter.
 *
 * Wraps a Next.js API route handler with the enforcement pipeline,
 * mapping NextRequest → EnforcementContext and EnforcementResult → NextResponse.
 *
 * Usage:
 *   import { withEnforcement } from "@nzila/enforcement/nextjs";
 *
 *   export const POST = withEnforcement({
 *     action: "create",
 *     resourceType: "claim",
 *     route: "/api/claims",
 *     layers: [traceLayer(), authLayer(authConfig), auditLayer(auditConfig)],
 *   }, async (ctx) => {
 *     // Business logic — ctx has orgId, actorId, roles
 *     return { success: true, status: 200, body: { id: "123" } };
 *   });
 */

import type { EnforcementContext, EnforcementLayer, EnforcementResult } from "./pipeline.js";
import { createContext, type HandlerFn } from "./handler.js";
import { composePipeline } from "./pipeline.js";

export interface NextjsEnforcementConfig {
  /** HTTP method / action verb (e.g. "create", "read", "update", "delete"). */
  action: string;
  /** Resource type being accessed (e.g. "claim", "user", "payment"). */
  resourceType: string;
  /** The route path (e.g. "/api/claims"). */
  route: string;
  /** Optional: extract resourceId from URL params. */
  extractResourceId?: (url: URL) => string | undefined;
  /** Enforcement layers to apply (order matters). */
  layers: EnforcementLayer[];
}

/**
 * Extracts headers from a request into a plain object.
 */
function extractHeaders(request: Request): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

/**
 * Wrap a Next.js API route handler with the enforcement pipeline.
 *
 * Returns a function compatible with Next.js App Router route handlers.
 */
export function withEnforcement(
  config: NextjsEnforcementConfig,
  handler: HandlerFn,
): (request: Request) => Promise<Response> {
  const handlerLayer: EnforcementLayer = async (ctx, _next) => {
    return handler(ctx);
  };

  const pipeline = composePipeline([...config.layers, handlerLayer]);

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url, "http://localhost");
    const headers = extractHeaders(request);
    let body: string | undefined;

    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        body = await request.text();
      } catch {
        // Body may be already consumed or empty
      }
    }

    const ctx = createContext({
      action: config.action,
      resourceType: config.resourceType,
      resourceId: config.extractResourceId?.(url),
      route: config.route,
      headers,
      body,
    });

    const result = await pipeline(ctx);

    return new Response(
      result.body != null ? JSON.stringify(result.body) : null,
      {
        status: result.status,
        headers: {
          "Content-Type": "application/json",
          "X-Trace-Id": ctx.traceId,
          ...result.headers,
        },
      },
    );
  };
}

/**
 * Create a health check handler that bypasses enforcement.
 * Health endpoints need zero overhead for liveness probes.
 */
export function healthHandler(
  extras?: Record<string, unknown>,
): () => Promise<Response> {
  return async () =>
    new Response(
      JSON.stringify({ status: "ok", timestamp: new Date().toISOString(), ...extras }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
}
