import { and, eq } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OrgReference {
  /** The body field that carries the id, for the error message. */
  field: string;
  value: unknown;
  table: PgTable & { id: PgColumn; organizationId: PgColumn };
}

/**
 * A foreign key taken from a request body names a row, not an authority: it must be a row of the caller's own organization. An absent
 * or null value is left to the column's own rules; a present one that is malformed is a 400 and one that is not the organization's is a
 * 404, so a body cannot link a record to another tenant's employer, worksite or agreement.
 */
export async function assertOrganizationOwns(references: OrgReference[], organizationId: string | null | undefined): Promise<void> {
  const present = references.filter((reference) => reference.value !== undefined && reference.value !== null);
  if (present.length === 0) return;
  if (!organizationId) throw ApiError.forbidden('Organization context required');
  for (const { field, value, table } of present) {
    if (typeof value !== 'string' || !UUID.test(value)) throw ApiError.badRequest(`${field} must be a valid id`);
    const [row] = await db
      .select({ id: table.id })
      .from(table as PgTable)
      .where(and(eq(table.id, value), eq(table.organizationId, organizationId)))
      .limit(1);
    if (!row) throw ApiError.notFound(field);
  }
}
