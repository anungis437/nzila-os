/**
 * Runtime policy evaluator for `withApi()` registry metadata.
 *
 * Converts static `registry` annotations on `WithApiOptions` into executable
 * runtime directives. This closes the governance loop:
 *
 *   annotation → enforcement → evidence → auditability
 *
 * `evaluateRoutePolicy()` is called once per route at module load time
 * (outside the returned async handler) so it has **zero per-request overhead**
 * — no I/O, no dynamic lookups.
 *
 * `executePostHandlerPolicies()` is called after a successful handler execution
 * for routes with `evidenceRequired: true`. It is always fire-and-forget:
 * audit failures are logged but never propagate to the caller.
 *
 * @module lib/api/route-policy
 */

import { AuditEventType, AuditSeverity, auditLog } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';
import type { WithApiOptions } from './with-api';

// ── Policy directives ─────────────────────────────────────────────────────────

/**
 * Runtime directives derived from a route's `registry` metadata.
 * Produced once per route by `evaluateRoutePolicy()`.
 */
export interface PolicyDirectives {
  /**
   * Whether to automatically emit an audit log entry after the handler
   * succeeds. Derived from `registry.evidenceRequired === true`.
   */
  autoAudit: boolean;

  /** Audit event type to use for the automatic emission. */
  auditEventType: AuditEventType;

  /** Severity classification for the automatic audit log entry. */
  auditSeverity: AuditSeverity;

  /**
   * Value for the `X-Route-Status` response header.
   * `null` = no header (production-active routes).
   *
   * Non-null values signal to API clients and monitoring tooling that the
   * route is not fully production-stabilised.
   */
  routeStatusHeader: 'experimental' | 'pilot-only' | 'deprecated' | null;

  /**
   * Whether `withApi()` should enforce platform-admin-level access independently
   * of the route's declared `auth.minRole` option. Derived from
   * `registry.orgScoping === 'platform-admin-only'`.
   *
   * This is belt-and-suspenders enforcement: routes with this scoping are
   * rejected for non-admins even if `minRole` was accidentally omitted.
   */
  enforceAdminOnly: boolean;
}

// ── Policy evaluation ─────────────────────────────────────────────────────────

/**
 * Derive runtime `PolicyDirectives` from a route's optional `registry` field.
 *
 * Returns a permissive no-op policy when `registry` is undefined (the common
 * case for routes that have not yet been annotated).
 */
export function evaluateRoutePolicy(
  registry: WithApiOptions['registry'],
): PolicyDirectives {
  if (!registry) {
    return {
      autoAudit: false,
      auditEventType: AuditEventType.DATA_ACCESS,
      auditSeverity: AuditSeverity.LOW,
      routeStatusHeader: null,
      enforceAdminOnly: false,
    };
  }

  // Derive audit event type from audience
  let auditEventType: AuditEventType;
  switch (registry.audience) {
    case 'admin':
    case 'platform':
      auditEventType = AuditEventType.ADMIN_CONFIG_CHANGED;
      break;
    default:
      auditEventType = AuditEventType.DATA_ACCESS;
  }

  // Derive severity from audience + orgScoping (most restrictive wins)
  let auditSeverity: AuditSeverity;
  if (
    registry.orgScoping === 'platform-admin-only' ||
    registry.audience === 'platform'
  ) {
    auditSeverity = AuditSeverity.CRITICAL;
  } else if (registry.audience === 'admin') {
    auditSeverity = AuditSeverity.HIGH;
  } else if (
    registry.audience === 'officer' ||
    registry.audience === 'governance'
  ) {
    auditSeverity = AuditSeverity.MEDIUM;
  } else {
    auditSeverity = AuditSeverity.LOW;
  }

  const routeStatusHeader: PolicyDirectives['routeStatusHeader'] =
    registry.productionStatus === 'experimental'
      ? 'experimental'
      : registry.productionStatus === 'pilot-only'
        ? 'pilot-only'
        : registry.productionStatus === 'deprecated'
          ? 'deprecated'
          : null;

  return {
    autoAudit: registry.evidenceRequired === true,
    auditEventType,
    auditSeverity,
    routeStatusHeader,
    enforceAdminOnly: registry.orgScoping === 'platform-admin-only',
  };
}

// ── Post-handler policy execution ─────────────────────────────────────────────

/** Execution context supplied by `withApi()` for post-handler policy hooks. */
export interface PolicyAuditContext {
  /** Authenticated user's ID. */
  userId: string;
  /** Resolved organization ID, or null for org-less routes. */
  organizationId: string | null;
  /** The full /api/... pathname, e.g. '/api/cases/123'. */
  routePath: string;
  /** HTTP method (uppercase), e.g. 'POST'. */
  method: string;
  /** Trace ID for the current request. */
  traceId: string;
}

/**
 * Execute policies that must run after the handler has succeeded.
 *
 * Currently implements automatic audit log emission for routes annotated with
 * `registry.evidenceRequired: true`. Future policies (evidence pack generation,
 * export classification, PII telemetry hooks) will be added here.
 *
 * **Always fire-and-forget.** Any failure is logged but never propagated.
 * Policy execution must never degrade, delay, or modify the user response.
 */
export async function executePostHandlerPolicies(
  directives: PolicyDirectives,
  context: PolicyAuditContext,
): Promise<void> {
  if (!directives.autoAudit) return;

  try {
    await auditLog({
      eventType: directives.auditEventType,
      severity: directives.auditSeverity,
      userId: context.userId,
      organizationId: context.organizationId ?? undefined,
      resource: context.routePath,
      action: context.method.toLowerCase(),
      outcome: 'success',
      details: {
        traceId: context.traceId,
        automated: true,
        source: 'route-policy',
      },
    });
  } catch (err) {
    // Audit failure must never block or alter the response.
    logger.error('[route-policy] Auto-audit emission failed', {
      routePath: context.routePath,
      traceId: context.traceId,
      error: (err as Error).message,
    });
  }
}
