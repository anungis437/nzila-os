/**
 * Shared-clause metadata disclosure rule.
 *
 * A clause can be readable across organizations without its source being
 * disclosable: anonymized shared clauses must not identify the source union.
 * Apply this consistently to list, search and compare, not only the item view.
 * The caller's own organization retains its source attribution.
 */
export function clauseSourceProjection(
  row: { sourceOrganizationId: string; organizationName?: string | null; isAnonymized?: boolean | null },
  callerOrganizationId: string,
): { id: string; organizationName: string | null } | undefined {
  if (!callerOrganizationId || !row.sourceOrganizationId) return undefined;
  if (row.isAnonymized !== false && row.sourceOrganizationId !== callerOrganizationId) return undefined;
  return { id: row.sourceOrganizationId, organizationName: row.organizationName ?? null };
}
