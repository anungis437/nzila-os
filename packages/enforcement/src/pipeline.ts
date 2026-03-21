/**
 * Enforcement pipeline: composable middleware stack.
 *
 * Order: trace → auth → rate-limit → governance → handler → audit
 *
 * Each layer is a function that receives a context and a `next` callback.
 * Layers can short-circuit by NOT calling `next()`.
 */

export interface EnforcementContext {
  /** Unique trace/request ID. */
  traceId: string;
  /** Authenticated org ID (set by auth layer). */
  orgId?: string;
  /** Authenticated actor ID (set by auth layer). */
  actorId?: string;
  /** Roles of the authenticated actor. */
  roles?: string[];
  /** HTTP method / action verb. */
  action: string;
  /** Resource type being accessed. */
  resourceType: string;
  /** Resource identifier. */
  resourceId?: string;
  /** Route or path. */
  route: string;
  /** Raw request body (stringified). */
  body?: string;
  /** Inbound headers. */
  headers: Record<string, string | undefined>;
  /** Arbitrary metadata added by layers. */
  metadata: Record<string, unknown>;
  /** Start time for duration tracking. */
  startedAt: number;
}

export interface EnforcementResult {
  success: boolean;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type NextFn = () => Promise<EnforcementResult>;

export type EnforcementLayer = (
  ctx: EnforcementContext,
  next: NextFn,
) => Promise<EnforcementResult>;

/**
 * Compose an ordered list of layers into a single executable pipeline.
 */
export function composePipeline(
  layers: EnforcementLayer[],
): (ctx: EnforcementContext) => Promise<EnforcementResult> {
  return async (ctx: EnforcementContext): Promise<EnforcementResult> => {
    let index = 0;

    const run = async (): Promise<EnforcementResult> => {
      if (index >= layers.length) {
        // No more layers — should never happen if a handler layer is included
        return { success: false, status: 500, body: { error: "No handler layer" } };
      }
      const layer = layers[index++]!;
      return layer(ctx, run);
    };

    return run();
  };
}
