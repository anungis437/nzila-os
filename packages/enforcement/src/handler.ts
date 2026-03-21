/**
 * Convenience: create a fully-enforced handler from a business-logic function.
 *
 * Wires up the standard pipeline: trace → auth → rate-limit → governance → audit → handler
 */

import { randomUUID } from "node:crypto";
import type { EnforcementContext, EnforcementLayer, EnforcementResult } from "./pipeline.js";
import { composePipeline } from "./pipeline.js";

export type HandlerFn = (ctx: EnforcementContext) => Promise<EnforcementResult>;

/**
 * Create an enforcement context from a minimal set of inputs.
 */
export function createContext(opts: {
  action: string;
  resourceType: string;
  resourceId?: string;
  route: string;
  headers: Record<string, string | undefined>;
  body?: string;
  traceId?: string;
}): EnforcementContext {
  return {
    traceId: opts.traceId ?? randomUUID(),
    action: opts.action,
    resourceType: opts.resourceType,
    resourceId: opts.resourceId,
    route: opts.route,
    headers: opts.headers,
    body: opts.body,
    metadata: {},
    startedAt: performance.now(),
  };
}

/**
 * Build a fully-enforced handler.
 *
 * The handler function is the final layer in the pipeline.
 * It receives the enriched context (with orgId, actorId, roles populated
 * by earlier layers).
 */
export function createEnforcedHandler(
  layers: EnforcementLayer[],
  handler: HandlerFn,
): (ctx: EnforcementContext) => Promise<EnforcementResult> {
  // The handler itself is wrapped as the terminal layer
  const handlerLayer: EnforcementLayer = async (ctx, _next) => {
    return handler(ctx);
  };

  return composePipeline([...layers, handlerLayer]);
}
