/**
 * Org-Scope Enforcement Utilities for Union-Eyes
 *
 * Provides helpers to ensure all database queries are scoped to the
 * authenticated user's organization. Use these in route handlers to
 * guarantee org isolation.
 *
 * @module lib/db/org-scoped
 */
import { sql, type SQL } from 'drizzle-orm'
import { ApiError } from '@/lib/api/errors'

/**
 * Validate and return the org ID, throwing a 403 ApiError if missing.
 * Use in `withRoleAuth` legacy handlers where `withApi`'s built-in
 * `requireOrg` enforcement is unavailable.
 *
 * @example
 * ```ts
 * export const POST = withRoleAuth('steward', async (req, ctx) => {
 *   const orgId = requireOrgId(ctx.organizationId)
 *   // orgId is guaranteed non-null here
 * })
 * ```
 */
export function requireOrgId(orgId: string | null | undefined): string {
  if (!orgId) {
    throw ApiError.forbidden(
      'Organization context required — select an organization before accessing this resource',
    )
  }
  return orgId
}

/**
 * Build a Drizzle SQL fragment that scopes a query to an organization.
 *
 * @param orgId - Verified organization UUID
 * @param column - Column name to filter on (default: 'organization_id')
 * @returns SQL fragment: `AND <column> = <orgId>::uuid`
 *
 * @example
 * ```ts
 * const orgId = requireOrgId(ctx.organizationId)
 * const rows = await db.execute(sql`
 *   SELECT * FROM cases WHERE status = 'open' ${orgScope(orgId)}
 * `)
 * ```
 */
export function orgScope(orgId: string, column = 'organization_id'): SQL {
  // Use sql template literal for parameterized binding — never interpolate orgId into raw SQL
  return sql`AND ${sql.identifier(column)} = ${orgId}::uuid`
}
