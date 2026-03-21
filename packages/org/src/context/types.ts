/**
 * Nzila OS — Canonical Org Context Types
 *
 * Unified, immutable org context that all domain verticals must
 * align to. Each domain extends the base `OrgContext<R>` with
 * its own role union. DB contexts extend `DbContext`.
 *
 * All domains use `orgId` as the canonical org identity field.
 * The `orgId` alias has been removed.
 *
 * @module @nzila/org/context
 *
 * @invariant CONTEXT_ORGID_CANONICAL_001
 */

// ── Base Org Context ────────────────────────────────────────────────────────

/**
 * Canonical per-request org context. Every authenticated request
 * in any domain vertical carries this shape.
 *
 * @template R — Domain-specific role string union. Defaults to
 *   `string` for cross-cutting code that doesn't need role narrowing.
 */
export interface OrgContext<R extends string = string> {
  /** Organisation UUID — the org boundary. */
  readonly orgId: string

  /** Authenticated user performing the action. */
  readonly actorId: string

  /** Application identifier — which Nzila app originated the request. */
  readonly appId?: string

  /** User's role within this org (domain-specific union). */
  readonly role: R

  /** Granular permission keys (domain-scoped). */
  readonly permissions: readonly string[]

  /** Request-level correlation ID for distributed tracing. */
  readonly requestId: string

  /** Optional parent correlation ID for saga / workflow tracking. */
  readonly correlationId?: string
}

// ── DB Context ──────────────────────────────────────────────────────────────

/**
 * Minimal context required for database operations.
 * Carries only org identity and actor for RLS / audit logging.
 */
export interface DbContext {
  /** Organisation UUID — the org boundary. */
  readonly orgId: string

  /** Authenticated user performing the action. */
  readonly actorId: string

  /** Optional correlation ID for audit trail linkage. */
  readonly correlationId?: string

  /** Optional role for audit event enrichment. */
  readonly actorRole?: string
}

// ── Type Guards ─────────────────────────────────────────────────────────────

/** Type guard to verify a value satisfies the `OrgContext` shape. */
export function isOrgContext(value: unknown): value is OrgContext {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.orgId === 'string' &&
    typeof v.actorId === 'string' &&
    typeof v.role === 'string' &&
    Array.isArray(v.permissions) &&
    typeof v.requestId === 'string'
  )
}

/** Type guard to verify a value satisfies the `DbContext` shape. */
export function isDbContext(value: unknown): value is DbContext {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.orgId === 'string' && typeof v.actorId === 'string'
}

// ── Conversion Helpers ──────────────────────────────────────────────────────

/**
 * Extract a `DbContext` from a full `OrgContext`.
 * Use at the boundary between service layer and data layer.
 */
export function toDbContext(ctx: OrgContext): DbContext {
  return {
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId ?? ctx.requestId,
    actorRole: ctx.role,
  }
}


