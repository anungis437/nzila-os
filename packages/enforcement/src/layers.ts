/**
 * Pre-built enforcement layers.
 *
 * Each follows the (ctx, next) → EnforcementResult pattern and can be
 * plugged into `composePipeline`.
 */

import type { EnforcementContext, EnforcementLayer, EnforcementResult, NextFn } from "./pipeline.js";

// ── Trace Layer ─────────────────────────────────────────────

/**
 * Adds a trace ID to the context and records timing.
 */
export function traceLayer(): EnforcementLayer {
  return async (ctx: EnforcementContext, next: NextFn): Promise<EnforcementResult> => {
    // traceId should already be set by caller; this layer enriches metadata
    ctx.metadata.traceStart = ctx.startedAt;
    const result = await next();
    ctx.metadata.durationMs = performance.now() - ctx.startedAt;
    return result;
  };
}

// ── Auth Layer ──────────────────────────────────────────────

export interface AuthLayerConfig {
  /** Callback to extract actor info from headers. */
  extractActor: (headers: Record<string, string | undefined>) => Promise<{
    tenantId: string;
    actorId: string;
    roles: string[];
  } | null>;
}

/**
 * Authentication layer: rejects if no valid actor found.
 */
export function authLayer(config: AuthLayerConfig): EnforcementLayer {
  return async (ctx: EnforcementContext, next: NextFn): Promise<EnforcementResult> => {
    const actor = await config.extractActor(ctx.headers);
    if (!actor) {
      return { success: false, status: 401, body: { error: "Unauthorized" } };
    }
    ctx.tenantId = actor.tenantId;
    ctx.actorId = actor.actorId;
    ctx.roles = actor.roles;
    return next();
  };
}

// ── Rate-Limit Layer ────────────────────────────────────────

export interface RateLimitLayerConfig {
  check: (tenantId: string, route: string) => Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }>;
}

export function rateLimitLayer(config: RateLimitLayerConfig): EnforcementLayer {
  return async (ctx: EnforcementContext, next: NextFn): Promise<EnforcementResult> => {
    if (!ctx.tenantId) return next(); // No tenant = skip rate limit

    const result = await config.check(ctx.tenantId, ctx.route);
    if (!result.allowed) {
      return {
        success: false,
        status: 429,
        body: { error: "Rate limit exceeded" },
        headers: {
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      };
    }
    return next();
  };
}

// ── Governance Layer ────────────────────────────────────────

export interface GovernanceLayerConfig {
  /** Evaluate access. Returns { outcome: "allow"|"deny", reason: string }. */
  evaluate: (ctx: EnforcementContext) => Promise<{
    outcome: "allow" | "deny";
    reason: string;
  }>;
}

export function governanceLayer(config: GovernanceLayerConfig): EnforcementLayer {
  return async (ctx: EnforcementContext, next: NextFn): Promise<EnforcementResult> => {
    const decision = await config.evaluate(ctx);
    if (decision.outcome === "deny") {
      return {
        success: false,
        status: 403,
        body: { error: "Forbidden", reason: decision.reason },
      };
    }
    return next();
  };
}

// ── Audit Layer ─────────────────────────────────────────────

export interface AuditLayerConfig {
  /** Record an audit entry. Called after the handler completes. */
  record: (entry: {
    actorId: string;
    tenantId: string;
    action: string;
    resource: string;
    resourceId?: string;
    traceId: string;
    status: number;
    durationMs: number;
  }) => Promise<void>;
}

export function auditLayer(config: AuditLayerConfig): EnforcementLayer {
  return async (ctx: EnforcementContext, next: NextFn): Promise<EnforcementResult> => {
    const result = await next();

    // Fire-and-forget audit (don't block response, but still await for safety)
    await config.record({
      actorId: ctx.actorId ?? "anonymous",
      tenantId: ctx.tenantId ?? "unknown",
      action: ctx.action,
      resource: ctx.resourceType,
      resourceId: ctx.resourceId,
      traceId: ctx.traceId,
      status: result.status,
      durationMs: performance.now() - ctx.startedAt,
    });

    return result;
  };
}
