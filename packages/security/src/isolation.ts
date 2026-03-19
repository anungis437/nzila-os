/**
 * Tenant-level data isolation helpers.
 *
 * Ensures every query is scoped to a tenant; prevents cross-tenant data leaks.
 */

export interface TenantContext {
  tenantId: string;
}

/**
 * Validate that a record belongs to the expected tenant.
 * Throws if the record's tenant does not match.
 */
export function assertTenantOwnership(
  record: { tenantId: string },
  expected: TenantContext,
): void {
  if (record.tenantId !== expected.tenantId) {
    throw new TenantIsolationError(
      `Tenant isolation violation: record belongs to ${record.tenantId}, expected ${expected.tenantId}`,
    );
  }
}

/**
 * Apply a tenant filter to a query-like object.
 * Generic helper for any ORM or query builder.
 */
export function withTenantScope<T extends Record<string, unknown>>(
  query: T,
  ctx: TenantContext,
): T & { tenantId: string } {
  return { ...query, tenantId: ctx.tenantId };
}

/**
 * Validate that a list of records all belong to the expected tenant.
 */
export function assertAllSameTenant(
  records: { tenantId: string }[],
  expected: TenantContext,
): void {
  for (const record of records) {
    assertTenantOwnership(record, expected);
  }
}

export class TenantIsolationError extends Error {
  public readonly code = "TENANT_ISOLATION_VIOLATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "TenantIsolationError";
  }
}
