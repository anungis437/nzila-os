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
let fallbackCounter = 0;

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  // Fallback: CSPRNG bytes when available, otherwise timestamp + monotonic counter (never Math.random).
  const ts = Date.now().toString(36);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${ts}${rand}`;
  }
  fallbackCounter = (fallbackCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}_${ts}${fallbackCounter.toString(36)}`;
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
