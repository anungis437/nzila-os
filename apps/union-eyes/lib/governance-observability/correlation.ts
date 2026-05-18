/**
 * Governance correlation ID generation.
 *
 * Creates and propagates `GovernanceCorrelationContext` objects that link
 * related governance events across a request chain into a single traceable
 * governance unit.
 *
 * All IDs are generated with a stable prefix for easy grep/filter:
 *   gcid_ — governance correlation ID
 *   gsid_ — governance session ID
 *   gtid_ — governance trace ID
 *
 * This module is pure and has no I/O dependencies — safe for edge runtime.
 *
 * @module lib/governance-observability/correlation
 */

import type { GovernanceCorrelationContext } from './types';

// ── ID generation ─────────────────────────────────────────────────────────────

/**
 * Generate a unique prefixed governance ID.
 * Uses `crypto.randomUUID()` when available (Node 14.17+, edge runtime).
 * Falls back to a timestamp-based ID in constrained environments.
 */
function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  // Fallback: timestamp + Math.random (not cryptographically unique but good enough for correlation)
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}${rand}`;
}

// ── Context creation ──────────────────────────────────────────────────────────

/**
 * Create a new governance correlation context for a request.
 * Call once at the entry point (middleware, withApi, or handler).
 */
export function createCorrelationContext(opts?: {
  orgId?: string;
  actorId?: string;
  /** Optional incoming trace ID (e.g. from X-Trace-Id header). */
  incomingTraceId?: string;
  /** Optional session ID for multi-step workflows. */
  sessionId?: string;
}): GovernanceCorrelationContext {
  return {
    governanceCorrelationId: generateId('gcid'),
    governanceSessionId: opts?.sessionId ?? generateId('gsid'),
    governanceTraceId: opts?.incomingTraceId
      ? `gtid_${opts.incomingTraceId}`
      : generateId('gtid'),
    createdAt: new Date().toISOString(),
    orgId: opts?.orgId,
    actorId: opts?.actorId,
  };
}

/**
 * Derive a child correlation context that inherits the session and trace IDs
 * from a parent context but generates a new correlation ID.
 * Used for sub-operations within a larger governance workflow.
 */
export function deriveChildContext(
  parent: GovernanceCorrelationContext,
  opts?: { actorId?: string; orgId?: string },
): GovernanceCorrelationContext {
  return {
    governanceCorrelationId: generateId('gcid'),
    governanceSessionId: parent.governanceSessionId,
    governanceTraceId: parent.governanceTraceId,
    createdAt: new Date().toISOString(),
    orgId: opts?.orgId ?? parent.orgId,
    actorId: opts?.actorId ?? parent.actorId,
  };
}

/**
 * Extract correlation headers from the context for injection into outbound
 * responses or downstream requests.
 *
 * Returns only headers whose values are defined to avoid setting empty headers.
 */
export function correlationToHeaders(
  ctx: GovernanceCorrelationContext,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Governance-Correlation': ctx.governanceCorrelationId,
  };
  if (ctx.governanceTraceId) {
    headers['X-Governance-Trace'] = ctx.governanceTraceId;
  }
  return headers;
}

/**
 * Parse a correlation context from request headers.
 * If no governance headers are present, returns `null` — the caller
 * should then call `createCorrelationContext()` to generate a fresh context.
 */
export function correlationFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): Partial<GovernanceCorrelationContext> | null {
  const correlationId = headers['x-governance-correlation'] as string | undefined;
  const traceId = headers['x-governance-trace'] as string | undefined;

  if (!correlationId) return null;

  return {
    governanceCorrelationId: correlationId,
    governanceTraceId: traceId,
    createdAt: new Date().toISOString(),
  };
}
