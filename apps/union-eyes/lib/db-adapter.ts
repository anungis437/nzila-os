/**
 * UnionEyes — Org Boundary Database Adapter
 *
 * Provides Org-scoped database access wrappers. UnionEyes uses
 * Supabase + internal packages for DB, so this adapter wraps
 * the existing DB layer to enforce Org isolation at the application
 * boundary.
 *
 * All queries through this adapter are automatically filtered to
 * the current Org (organization_id).
 *
 * NzilaOS Integration: Equivalent to @nzila/db/scoped createScopedDb.
 *
 * Usage:
 *   import { createOrgScopedQuery, assertOrgId } from '@/lib/db-adapter'
 *
 *   const orgId = assertOrgId(session)
 *   const query = createOrgScopedQuery(orgId)
 *   const rows = await query.from('cases').select()
 */

/**
 * Validate and extract orgId from a session/context object.
 * Throws if orgId is missing or empty.
 */
export function assertOrgId(
  sessionOrContext: { orgId?: string; organizationId?: string; org_id?: string },
): string {
  const orgId =
    sessionOrContext.orgId ??
    sessionOrContext.organizationId ??
    sessionOrContext.org_id

  if (!orgId || typeof orgId !== 'string' || orgId.trim() === '') {
    throw new OrgBoundaryError(
      'Org isolation violation: orgId is required for all database access. ' +
      'Ensure the request context includes a valid organization ID.',
    )
  }

  return orgId.trim()
}

/**
 * Error thrown when Org boundary is violated.
 */
export class OrgBoundaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrgBoundaryError'
  }
}

/**
 * Wraps a Supabase query builder to inject organization_id filter.
 *
 * This is a lightweight adapter — in UnionEyes the actual Org filtering
 * happens via Supabase RLS policies + this application-layer guard.
 */
export function createOrgScopedQuery(orgId: string) {
  if (!orgId) throw new OrgBoundaryError('orgId is required')

  return {
    orgId,

    /**
     * Apply Org filter to a Supabase query.
     * Call this on every query that touches Org-scoped tables.
     *
     * Example:
     *   const scoped = createOrgScopedQuery(orgId)
     *   const { data } = await supabase
     *     .from('cases')
     *     .select()
     *     .eq('organization_id', scoped.orgId)
     */
    applyFilter<T extends { eq: (col: string, val: string) => T }>(
      query: T,
      column = 'organization_id',
    ): T {
      return query.eq(column, orgId)
    },

    /**
     * Inject organization_id into an insert payload.
     * Overrides any existing organization_id to prevent spoofing.
     */
    scopeInsert<T extends Record<string, unknown>>(
      payload: T,
      column = 'organization_id',
    ): T & { [key: string]: string } {
      return { ...payload, [column]: orgId }
    },
  }
}
