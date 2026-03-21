/**
 * Org-level data isolation helpers.
 *
 * Ensures every query is scoped to an org; prevents cross-org data leaks.
 */

export interface OrgContext {
  orgId: string;
}

/**
 * Validate that a record belongs to the expected org.
 * Throws if the record's org does not match.
 */
export function assertOrgOwnership(
  record: { orgId: string },
  expected: OrgContext,
): void {
  if (record.orgId !== expected.orgId) {
    throw new OrgIsolationError(
      `Org isolation violation: record belongs to ${record.orgId}, expected ${expected.orgId}`,
    );
  }
}

/**
 * Apply an org filter to a query-like object.
 * Generic helper for any ORM or query builder.
 */
export function withOrgScope<T extends Record<string, unknown>>(
  query: T,
  ctx: OrgContext,
): T & { orgId: string } {
  return { ...query, orgId: ctx.orgId };
}

/**
 * Validate that a list of records all belong to the expected org.
 */
export function assertAllSameOrg(
  records: { orgId: string }[],
  expected: OrgContext,
): void {
  for (const record of records) {
    assertOrgOwnership(record, expected);
  }
}

export class OrgIsolationError extends Error {
  public readonly code = "ORG_ISOLATION_VIOLATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "OrgIsolationError";
  }
}
