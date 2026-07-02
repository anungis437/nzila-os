/**
 * ABR user lookup — cross-org membership resolver.
 *
 * This is a controlled DB adapter for ABR auth verification. It lives under
 * `apps/abr/modules/` (which is exempt from INV-06's unscoped-`db` rule)
 * because verifying whether a user belongs to an org is a prerequisite
 * to any per-org scoping — we can't call `createScopedDb(orgId)` before
 * we know the user is entitled to that orgId.
 *
 * The query is intentionally narrow: it reads only the `abr_users` row
 * for the given (userId, orgId) pair and returns nothing else.
 *
 * Any consumer must still enforce membership in downstream logic before
 * reading org-scoped data.
 */

import { db } from '@nzila/db';
import { sql } from 'drizzle-orm';

export interface AbrUserLookupRow {
  role: string;
  active: boolean;
}

export interface AbrUserLookupNotFound {
  found: false;
}

export interface AbrUserLookupFound {
  found: true;
  row: AbrUserLookupRow;
}

export type AbrUserLookupResult = AbrUserLookupNotFound | AbrUserLookupFound;

export async function lookupAbrUserMembership(
  userId: string,
  orgId: string,
): Promise<AbrUserLookupResult> {
  const rows = (await db.execute(sql`
    SELECT role, active
    FROM abr_users
    WHERE id = ${userId} AND org_id = ${orgId}
    LIMIT 1
  `)) as Array<Record<string, unknown>>;

  if (rows.length === 0) return { found: false };

  return {
    found: true,
    row: {
      role: String(rows[0].role),
      active: rows[0].active === true,
    },
  };
}
