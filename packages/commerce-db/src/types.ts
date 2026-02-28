/**
 * @nzila/commerce-db — Shared types for commerce data access layer.
 *
 * Every repository function requires a CommerceDbContext to guarantee
 * org isolation (entityId) and audit attribution (actorId).
 *
 * @module @nzila/commerce-db/types
 */

// ── Context types ─────────────────────────────────────────────────────────

/**
 * Context required for all commerce database operations.
 *
 * - `entityId` → org scope (entity_id FK). Cannot be omitted.
 * - `actorId`  → Clerk user ID for audit trails. Cannot be omitted.
 * - `correlationId` → optional request-level trace ID.
 * - `actorRole` → optional role for audit enrichment.
 */
export interface CommerceDbContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  /**
   * @deprecated Use `orgId` instead. Kept for backward compatibility.
   */
  readonly entityId: string
  /** Clerk user ID — recorded in every audit event. */
  readonly actorId: string
  /** Optional correlation/request ID for distributed tracing. */
  readonly correlationId?: string
  /** Optional actor role for audit enrichment. */
  readonly actorRole?: string
}

/**
 * Read-only context (subset with just orgId).
 * Used for repository queries that don't mutate data.
 */
export interface CommerceReadContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  /**
   * @deprecated Use `orgId` instead. Kept for backward compatibility.
   */
  readonly entityId: string
}

// ── Pagination ────────────────────────────────────────────────────────────

export interface PaginationOpts {
  /** Max rows to return (default: 50, max: 200). */
  limit?: number
  /** Offset for pagination. */
  offset?: number
}

export interface PaginatedResult<T> {
  rows: T[]
  total: number
  limit: number
  offset: number
}

// ── Common insert/update shapes ───────────────────────────────────────────

/**
 * Strip auto-generated fields (id, entityId, timestamps) from a table row
 * to produce the shape callers must supply on insert.
 */
export type InsertShape<T> = Omit<T, 'id' | 'entityId' | 'createdAt' | 'updatedAt'>

/**
 * Partial update shape — every field is optional.
 */
export type UpdateShape<T> = Partial<Omit<T, 'id' | 'entityId' | 'createdAt'>>
